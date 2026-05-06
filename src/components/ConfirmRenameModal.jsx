// =============================================================================
// ConfirmRenameModal — themed confirmation dialog for fleet rename actions.
// =============================================================================
//
// Pattern:
//
//   <ConfirmRenameModal
//     open={Boolean(renameDraft)}
//     entityNoun="PheNode"            // or "Sensor"
//     oldName={renameDraft?.oldName}
//     newName={renameDraft?.newName}
//     onConfirm={async () => { ...PUT call... }}
//     onCancel={() => setRenameDraft(null)}
//   />
//
// `onConfirm` may return a Promise — the modal flips its Continue
// button into a loading state for the duration and only closes after
// the promise resolves (success path: the parent calls onCancel-style
// cleanup itself after running the toast). If onConfirm throws, the
// modal stays open so the user can read the error and retry; the
// parent is responsible for surfacing the error toast and either
// calling onCancel to close, or leaving the modal open.
//
// Theme:
//
//   - Surface: rgba(0, 20, 61, 0.96) — the same dark navy the
//     tooltip slot uses. Border and box-shadow match too.
//   - Backdrop: blur(6px) — same recipe used by the date pickers
//     and neon menu papers in sx-tokens.js. Subtle but enough to
//     visually push the rest of the page back.
//   - Continue / Cancel buttons: outlined-style buttons that match
//     the toolbar Sort/Filter buttons (var(--reflected-light) border,
//     var(--green) on hover for Continue, var(--orange) on hover for
//     Cancel as a soft "destructive" cue).

import PropTypes from 'prop-types';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

const dialogPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.96)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  borderRadius: 1,
  color: 'var(--blue)',
  minWidth: { xs: 280, sm: 380 },
  maxWidth: 480
};

const dialogBackdropSx = {
  // Soft blur on the rest of the page so the modal pops without the
  // surface behind it pulling focus. Same blur radius as date pickers.
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(6px)'
};

const buttonBaseSx = {
  textTransform: 'none',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  color: 'var(--blue)',
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  boxShadow: '0 11px 19px 1px #0000002e',
  px: 2.5,
  py: 0.75,
  fontWeight: 500,
  letterSpacing: '0.04em',
  fontSize: '0.78rem',
  transition: 'color 0.18s ease, border-color 0.18s ease',
  '&.Mui-disabled': {
    color: 'rgba(255, 255, 255, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.15)'
  }
};

const continueButtonSx = {
  ...buttonBaseSx,
  '&:hover:not(.Mui-disabled)': {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.08)'
  }
};

const cancelButtonSx = {
  ...buttonBaseSx,
  '&:hover:not(.Mui-disabled)': {
    color: 'var(--critical)',
    borderColor: 'var(--critical)',
    backgroundColor: 'rgba(255, 165, 0, 0.06)'
  }
};

export default function ConfirmRenameModal({ open, entityNoun, externalId, oldName, newName, onConfirm, onCancel }) {
  // Loading state for the Continue button while the parent's onConfirm
  // promise is in flight. Local to the modal so the parent doesn't
  // have to thread an `isPending` prop in.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      // Reset whether onConfirm succeeded or threw. The parent decides
      // whether to close the modal (via setting the draft state to
      // null) — we don't unilaterally close on success because we want
      // the parent's success toast to fire before the dialog dismisses,
      // which is a sequencing concern the parent owns.
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onCancel}
      aria-labelledby="confirm-rename-title"
      slotProps={{
        paper: { sx: dialogPaperSx },
        backdrop: { sx: dialogBackdropSx }
      }}
    >
      <DialogTitle
        id="confirm-rename-title"
        sx={{
          color: 'var(--green)',
          fontSize: '1.1rem',
          fontWeight: 600,
          pb: 1
        }}
      >
        Are you sure you wish to rename?
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        {/*
          Read-only MAC / external-id badge at the top of the modal.
          The user-visible label can change with renames, but the
          external_id never does — it's the immutable hardware
          identifier. Showing it here lets the user double-confirm
          they're about to rename the right device/sensor before
          committing (especially valuable in a fleet where two
          devices might temporarily share a similar label, or where
          the user opened the modal from a search-filtered list and
          wants to re-verify which physical unit they're touching).

          Styled as a labeled chip rather than an input — `cursor:
          default` and the `.MuiInputBase` patterns are absent so it
          doesn't read as editable. `userSelect: 'all'` lets the
          user click into the value and copy it (handy for support
          tickets / cross-referencing dashboards). The font-family
          falls back through monospace stacks since the project
          doesn't define a `--mono` token; monospace is the right
          register for opaque hardware IDs.
        */}
        {externalId && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                color: 'var(--blue)',
                fontSize: '0.7rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: 0.75,
                display: 'block',
                mb: 0.5
              }}
            >
              MAC Address (read-only)
            </Typography>
            <Box
              sx={{
                backgroundColor: 'rgba(0, 17, 48, 0.5)',
                border: '1px solid var(--reflected-light)',
                borderRadius: 1,
                px: 1.5,
                py: 0.75,
                cursor: 'default'
              }}
            >
              <Typography
                title={externalId}
                sx={{
                  color: 'var(--blue)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  // Lets the user click-and-drag to copy the MAC.
                  // Cursor stays `default` (set on the parent) so it
                  // never reads as editable.
                  userSelect: 'all'
                }}
              >
                {externalId}
              </Typography>
            </Box>
          </Box>
        )}

        {/*
          Show the OLD → NEW transition explicitly. Users sometimes
          second-guess between modal-open and modal-confirm; spelling
          out exactly what's about to happen removes that ambiguity.
          The names use truncation styling so a really long label
          ellipsis-clips inside the dialog rather than blowing it out
          to ridiculous width.
        */}
        <Typography variant="body2" sx={{ color: 'var(--blue)', mb: 1.5 }}>
          Rename this {entityNoun.toLowerCase()} from:
        </Typography>
        <Box
          sx={{
            backgroundColor: 'rgba(0, 17, 48, 0.4)',
            border: '1px solid var(--reflected-light)',
            borderRadius: 1,
            px: 1.5,
            py: 1,
            mb: 1
          }}
        >
          <Typography
            sx={{
              color: 'var(--green)',
              fontSize: '0.95rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={oldName}
          >
            {oldName}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'var(--blue)', mb: 1.5 }}>
          to:
        </Typography>
        <Box
          sx={{
            backgroundColor: 'rgba(72, 247, 245, 0.06)',
            border: '1px solid var(--green)',
            borderRadius: 1,
            px: 1.5,
            py: 1
          }}
        >
          <Typography
            sx={{
              color: 'var(--green)',
              fontSize: '0.95rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={newName}
          >
            {newName}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onCancel} disabled={isSubmitting} sx={cancelButtonSx}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={isSubmitting} sx={continueButtonSx}>
          {isSubmitting ? 'Renaming…' : 'Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ConfirmRenameModal.propTypes = {
  open: PropTypes.bool.isRequired,
  entityNoun: PropTypes.string.isRequired,
  // Immutable hardware id (external_device_id / externalSensorId). Shown
  // as a read-only badge near the top of the modal so the user can
  // verify they're renaming the right physical unit before committing.
  externalId: PropTypes.string,
  oldName: PropTypes.string,
  newName: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};
