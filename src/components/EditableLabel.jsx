// =============================================================================
// EditableLabel — click-to-edit text component used for the card site name.
// =============================================================================
//
// Two render states:
//
//   IDLE — A Typography that looks identical to a plain heading, plus
//          a subtle EditOutlined icon that fades in only on hover.
//          Cursor turns to pointer on hover. Clicking the label
//          enters EDITING.
//
//   EDITING — A TextField input pre-populated with the current value,
//             auto-focused. Submitting (Enter or blur) calls onSubmit
//             with the new value. Cancel (Escape) reverts to IDLE
//             without firing onSubmit.
//
// Validation, performed before onSubmit fires:
//
//   - Trim whitespace.
//   - If trimmed value is empty → silently revert (no submit, no toast).
//   - If trimmed value equals the existing label → silently revert.
//
// These rules mean a confirmation modal NEVER opens for a no-op or for
// a deliberate-blank input — the user has to type a meaningfully
// different name to be prompted.
//
// `locked` prop disables the editable behavior entirely. Used by the
// fleet card to lock the label when the user is viewing the immutable
// MAC / external-id (the underlying hardware identifier can't be
// renamed). When locked, the label renders as a plain Typography with
// no pencil, no cursor change, no click handler.
//
// Styling: leans on the `truncateLineSx` pattern used across the fleet
// cards so a long name ellipsis-truncates instead of pushing the row
// wider. The component is otherwise unopinionated about color/font —
// the caller passes Typography sx via `typographySx` so the same
// component can render in different contexts (h4 + green here, but
// could be subtitle1 + blue elsewhere).

import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import AntIcon from 'components/AntIcon';
import EditOutlined from '@ant-design/icons-svg/lib/asn/EditOutlined';

const TRUNCATE_LINE_SX = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0
};

export default function EditableLabel({
  value,
  onSubmit,
  locked = false,
  variant = 'h4',
  typographySx = {},
  containerSx = {},
  ariaLabel = 'Editable name',
  inputAriaLabel = 'Rename'
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Tracks whether a submission has already fired for the current
  // editing session. Without this guard, pressing Enter (which calls
  // submit and triggers blur) would fire submit twice — once from the
  // keydown handler, once from the blur handler. The flag short-
  // circuits the blur path when the keydown already submitted.
  const submittedRef = useRef(false);

  // Sync the input draft to the incoming `value` whenever it changes
  // OR whenever we exit editing. Two cases this covers:
  //
  //   1. Parent prop changes while we're idle — incoming new value
  //      becomes the new editing baseline.
  //   2. We just left editing (success or revert) — reset draft so
  //      the next click-to-edit starts from the current value, not
  //      whatever was typed last time.
  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  const startEditing = () => {
    if (locked) return;
    submittedRef.current = false;
    setDraft(value);
    setIsEditing(true);
  };

  const exitEditing = () => {
    setIsEditing(false);
    submittedRef.current = false;
  };

  const trySubmit = () => {
    if (submittedRef.current) return; // see submittedRef comment above
    submittedRef.current = true;

    const trimmed = draft.trim();

    // Validation — silently revert without firing onSubmit:
    //   - empty input
    //   - unchanged value
    if (!trimmed || trimmed === value) {
      exitEditing();
      return;
    }

    // Hand the new name up. The parent decides what to do (open the
    // confirmation modal, fire the API, etc). We just exit editing —
    // by the time onSubmit's promise resolves the user is looking at
    // the modal, not the input.
    onSubmit(trimmed);
    exitEditing();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      trySubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      exitEditing(); // cancel — no submit
    }
  };

  // EDITING state — render an OutlinedInput in place of the label.
  //
  // Chrome modeled on the "Enter new sensor name" rename TextField in
  // sections/wireless-sensors/sensor-network.jsx, which is the
  // pattern the project already trusts for inline rename inputs:
  //
  //   - Dark navy surface (#00143642) so the input visually sits ON
  //     the card rather than presenting as a stark black field
  //     overlaid on top.
  //   - Bottom-only hairline border (borderStyle: 'none none solid')
  //     instead of an all-around outline. Top/right/left widths are
  //     declared (1px) so the borderColor shorthand parses, but their
  //     style is `none` and nothing renders.
  //   - The MUI notched-outline fieldset is suppressed in every state
  //     (default, :hover, .Mui-focused). Without that suppression,
  //     MUI's default focus rule paints a 2px primary-palette ring
  //     around the entire input — that's the green glow the user was
  //     seeing.
  //   - Inset shadow gives the input the same in-card depth feel the
  //     search bar in the toolbar above has.
  if (isEditing) {
    return (
      <OutlinedInput
        autoFocus
        size="small"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={trySubmit}
        onKeyDown={handleKeyDown}
        inputProps={{ 'aria-label': inputAriaLabel }}
        sx={{
          // containerSx flows through so flex/minWidth from the
          // parent's layout context apply to the editing state too —
          // otherwise the input would size to its content and break
          // out of the flex row.
          ...containerSx,
          // Inherit the typography sx for color + size so the input
          // text reads at the same visual weight as the label it
          // replaced.
          ...typographySx,
          // Match the project's inline-rename input pattern — see
          // header comment for the full rationale.
          borderStyle: 'none none solid',
          borderWidth: '1px 1px 2px',
          borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
          backgroundColor: '#00143642',
          boxShadow: 'inset 1px 4px 5px #0003',
          borderRadius: 1,
          padding: 0,
          '& .MuiInputBase-input': {
            ...typographySx,
            padding: '2px 8px',
            // Override the label's truncation rule — the input needs
            // `text-overflow: clip` so the caret stays visible at the
            // end while the user is typing past the visible width.
            whiteSpace: 'nowrap',
            overflow: 'visible',
            textOverflow: 'clip'
          },
          // Suppress the notched outline (the source of MUI's default
          // green focus ring) in every interaction state.
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none'
          },
          '&:hover .MuiOutlinedInput-notchedOutline, &.Mui-focused .MuiOutlinedInput-notchedOutline': {
            border: 'none'
          },
          // Lock the bottom hairline to var(--reflected-light) on
          // hover/focus too — !important is required because MUI's
          // own :hover / .Mui-focused theme rules have higher
          // specificity than `&:hover` / `&.Mui-focused` and would
          // otherwise repaint with the primary color.
          '&:hover:not(.Mui-disabled), &.Mui-focused': {
            borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light) !important',
            boxShadow: 'inset 1px 4px 5px #0003'
          }
        }}
      />
    );
  }

  // IDLE state — Typography with a hover-revealed pencil icon.
  // The Box wrapper makes the whole "label + icon" area the
  // click target, so users don't have to aim at the icon
  // specifically — clicking anywhere on the row enters editing.
  return (
    <Box
      role={locked ? undefined : 'button'}
      tabIndex={locked ? undefined : 0}
      aria-label={locked ? undefined : ariaLabel}
      // stopPropagation on both pointer + keyboard activation so a
      // parent clickable wrapper (the fleet card, in particular) does
      // NOT also fire on rename clicks. Without this guard, clicking
      // the pencil to rename would simultaneously navigate the user
      // away from the page they're trying to edit on.
      //
      // Calls happen BEFORE the local startEditing handler runs — order
      // doesn't actually matter for stopPropagation (it controls
      // bubbling to ancestors, which happens after this handler
      // completes), but the local-then-stop sequence is also fine.
      // Locked labels never start editing, so we still stop
      // propagation when locked is true? No — we should only stop
      // propagation when we ourselves are handling the event. When
      // locked, the card click should pass through. So we gate on
      // !locked.
      onClick={(event) => {
        if (locked) return;
        event.stopPropagation();
        startEditing();
      }}
      onKeyDown={(event) => {
        if (locked) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          startEditing();
        }
      }}
      sx={{
        ...containerSx,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        minWidth: 0,
        cursor: locked ? 'default' : 'pointer',
        // Pencil icon fades in only on hover (and only when not
        // locked) — the idle state stays visually identical to the
        // pre-feature label so cards don't suddenly look busy.
        '& .editable-label-pencil': {
          opacity: 0,
          transition: 'opacity 120ms ease, color 120ms ease',
          color: 'var(--blue)'
        },
        '&:hover .editable-label-pencil': {
          opacity: locked ? 0 : 1,
          color: 'var(--green)'
        },
        '&:focus-visible': {
          outline: '1px solid var(--green)',
          outlineOffset: 2,
          borderRadius: 1
        }
      }}
    >
      <Typography
        variant={variant}
        title={value}
        sx={{
          ...typographySx,
          ...TRUNCATE_LINE_SX
        }}
      >
        {value}
      </Typography>
      {!locked && (
        <AntIcon icon={EditOutlined}
          aria-hidden="true"
          className="editable-label-pencil"
          style={{ fontSize: 14, flexShrink: 0 }}
        />
      )}
    </Box>
  );
}

EditableLabel.propTypes = {
  value: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  locked: PropTypes.bool,
  // MUI Typography variant — drives the IDLE label's font-size,
  // font-weight, line-height. Defaults to 'h4' to match the original
  // pre-feature card heading. Override per-context if needed.
  variant: PropTypes.string,
  typographySx: PropTypes.object,
  containerSx: PropTypes.object,
  ariaLabel: PropTypes.string,
  inputAriaLabel: PropTypes.string
};
