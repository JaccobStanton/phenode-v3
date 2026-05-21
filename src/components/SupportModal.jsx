// =============================================================================
// SupportModal — themed informational dialog directing users to email
// PheNode support.
// =============================================================================
//
// Pattern:
//
//   <SupportModal
//     open={supportModalOpen}
//     onClose={() => setSupportModalOpen(false)}
//   />
//
// The modal renders a short, professional explanation that any service
// request or product question should come from the email address
// associated with the user's account, and provides a Send-via-Email
// button that hands off to the user's default mail client with
// support@phenode.com pre-populated as the recipient. No subject or
// body is prefilled — the user composes freely from their own client,
// which means whatever From address they use is what support will see
// (matching the modal's guidance to use their account email).
//
// Theme: mirrors ConfirmRenameModal.jsx (dialogPaperSx,
// dialogBackdropSx) and matches the rest of the app's solid `#054085`
// chrome border. Disabled-button recipe matches the project's recent
// pattern (data-downloads.jsx:587-594, sensor-measurements.jsx:1845-1852):
// `var(--med-grey)` text + border on a flat `#01113d` fill, no hover
// brightening. The Send button is always enabled in this design — the
// disabled recipe is kept on `buttonBaseSx` for parity with other
// project buttons.

import PropTypes from 'prop-types';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

const SUPPORT_EMAIL = 'support@phenode.com';

const dialogPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.96)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1.5px solid #054085',
  boxShadow: '0 11px 19px 1px #0000002e',
  borderRadius: 1,
  color: 'var(--blue)',
  minWidth: { xs: 300, sm: 440 },
  maxWidth: 560
};

const dialogBackdropSx = {
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(6px)'
};

// Disabled state matches the project's current pattern — see
// data-downloads.jsx:587-594 and sensor-measurements.jsx:1845-1852.
// `var(--med-grey)` text + border on a flat `#01113d` fill, with the
// hover state pinned to the same fill so disabled buttons don't
// brighten on cursor-over. This replaces the earlier translucent-white
// recipe (rgba(255,255,255,0.35) text / rgba(255,255,255,0.15) border)
// that didn't read as the same chrome family as the rest of the app's
// buttons.
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
    color: 'var(--med-grey)',
    borderColor: 'var(--med-grey)',
    backgroundColor: '#01113d'
  },
  '&.Mui-disabled:hover': {
    backgroundColor: '#01113d'
  }
};

const sendButtonSx = {
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

export default function SupportModal({ open, onClose }) {
  const handleSend = () => {
    // window.location.href triggers the OS's mailto handler — opens
    // the user's default mail client with the recipient pre-filled.
    // No subject/body — the user composes the full message there,
    // which keeps the From address tied to whichever account is
    // configured in their client (the modal copy directs them to use
    // the email associated with their PheNode account).
    window.location.href = `mailto:${SUPPORT_EMAIL}`;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="support-modal-title"
      slotProps={{
        paper: { sx: dialogPaperSx },
        backdrop: { sx: dialogBackdropSx }
      }}
    >
      <DialogTitle
        id="support-modal-title"
        sx={{
          color: 'var(--green)',
          fontSize: '1.1rem',
          fontWeight: 600,
          pb: 1
        }}
      >
        Contact Support
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <Typography
          variant="body2"
          sx={{ color: 'var(--blue)', fontSize: '0.9rem', lineHeight: 1.6 }}
        >
          For service requests or inquiries regarding PheNode hardware or
          software, please contact our support team using the email address
          associated with your account. A member of our team will respond as
          promptly as possible.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={cancelButtonSx}>
          Cancel
        </Button>
        <Button onClick={handleSend} sx={sendButtonSx}>
          Send via Email
        </Button>
      </DialogActions>
    </Dialog>
  );
}

SupportModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
