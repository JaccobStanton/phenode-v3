// =============================================================================
// ConfirmActionModal — themed confirmation dialog for destructive actions.
// =============================================================================
//
// Generalized sibling of ConfirmRenameModal. Pattern:
//
//   <ConfirmActionModal
//     open={Boolean(pendingDelete)}
//     title="Delete image?"
//     description="This will permanently remove the image from the device."
//     itemBadgeLabel="Filename"
//     itemBadgeValue={pendingDelete?.name}
//     confirmLabel="Delete"
//     confirmTone="critical"
//     onConfirm={async () => { ... }}
//     onCancel={() => setPendingDelete(null)}
//     submittingLabel="Deleting…"
//   />
//
// Why a parallel component instead of extending ConfirmRenameModal:
//   ConfirmRenameModal's UI shows an "old → new" name transition, which
//   doesn't generalize to deletes (no "new" value), uninstalls, force-
//   syncs, etc. Trying to bend it into a generic shape made every prop
//   conditional. A clean second component shares the surface styling
//   (extracted via the same Paper/backdrop/button sx recipes) but with
//   a body shape tuned for "are you sure you want to do this to THIS
//   thing?" rather than "are you sure about THIS rename?".
//
// Theme: identical surface vocabulary to ConfirmRenameModal — same
// rgba(0, 20, 61, 0.96) paper, same reflected-light border, same
// 6px-blur backdrop. The Continue button picks its hover-color tone
// from `confirmTone`:
//   - 'critical' → var(--critical) (delete, remove, uninstall)
//   - 'default'  → var(--green)    (run, apply, sync)
//
// `onConfirm` may return a Promise — the Continue button flips into a
// loading state for the duration. If onConfirm throws, the modal stays
// open so the user can read the error in a toast and retry, mirroring
// the contract ConfirmRenameModal already uses.

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

const cancelButtonSx = {
  ...buttonBaseSx,
  '&:hover:not(.Mui-disabled)': {
    color: 'var(--orange)',
    borderColor: 'var(--orange)',
    backgroundColor: 'rgba(255, 165, 0, 0.06)'
  }
};

const confirmToneSx = {
  critical: {
    color: 'var(--critical)',
    borderColor: 'var(--critical)',
    backgroundColor: 'rgba(255, 84, 84, 0.06)'
  },
  default: {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.08)'
  }
};

const buildConfirmButtonSx = (tone) => ({
  ...buttonBaseSx,
  '&:hover:not(.Mui-disabled)': confirmToneSx[tone] ?? confirmToneSx.default
});

export default function ConfirmActionModal({
  open,
  title,
  description,
  itemBadgeLabel,
  itemBadgeValue,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  confirmTone = 'default',
  submittingLabel,
  onConfirm,
  onCancel
}) {
  // Local in-flight state for the Continue button. Parents don't need
  // to thread an `isPending` prop in. Reset whether onConfirm
  // resolved or threw — parent decides whether to close.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onCancel}
      aria-labelledby="confirm-action-title"
      slotProps={{
        paper: { sx: dialogPaperSx },
        backdrop: { sx: dialogBackdropSx }
      }}
    >
      <DialogTitle
        id="confirm-action-title"
        sx={{
          color: 'var(--green)',
          fontSize: '1.1rem',
          fontWeight: 600,
          pb: 1
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        {description && (
          <Typography variant="body2" sx={{ color: 'var(--blue)', mb: itemBadgeValue ? 1.5 : 0 }}>
            {description}
          </Typography>
        )}

        {/*
          Optional identifier badge — same recipe ConfirmRenameModal
          uses for the read-only MAC / external-id chip. When the
          caller supplies an `itemBadgeValue` (e.g. the filename being
          deleted), it renders as a labeled chip the user can click
          into and copy. Skips entirely when no value is provided —
          a confirmation like "Run sync now?" doesn't have a single
          identifier to highlight.
        */}
        {itemBadgeValue && (
          <Box>
            {itemBadgeLabel && (
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
                {itemBadgeLabel}
              </Typography>
            )}
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
                title={itemBadgeValue}
                sx={{
                  color: 'var(--green)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  userSelect: 'all'
                }}
              >
                {itemBadgeValue}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onCancel} disabled={isSubmitting} sx={cancelButtonSx}>
          {cancelLabel}
        </Button>
        <Button onClick={handleConfirm} disabled={isSubmitting} sx={buildConfirmButtonSx(confirmTone)}>
          {isSubmitting ? submittingLabel || `${confirmLabel}…` : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ConfirmActionModal.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  // Caption above the identifier badge (e.g. "Filename", "Sensor ID").
  // Omit to render the badge with no label.
  itemBadgeLabel: PropTypes.string,
  // Value shown in the identifier badge (e.g. the filename being
  // deleted). Omit to hide the badge entirely.
  itemBadgeValue: PropTypes.string,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  // 'critical' uses the red destructive hover-color recipe; 'default'
  // uses the green confirmation recipe.
  confirmTone: PropTypes.oneOf(['default', 'critical']),
  // Label shown on the Continue button while onConfirm is awaiting.
  // Defaults to `${confirmLabel}…`.
  submittingLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};
