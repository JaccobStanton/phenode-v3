// =============================================================================
// ToastProvider — global notification system for the V3 frontend.
// =============================================================================
//
// Mounted once at the app root (see App.jsx). Any component anywhere in
// the tree calls:
//
//   const toast = useToast();
//   toast.success("'Shakoor Lab 020' renamed successfully");
//   toast.error('Failed to rename PheNode: label must not be empty');
//
// One toast at a time — calling toast.success() while another toast is
// visible replaces the previous one. If we ever need stacked toasts
// (e.g. user fires two operations in rapid succession and wants to see
// both results), the migration path is to swap the underlying Snackbar
// for `notistack` — the public API of useToast() stays the same, only
// the internals change.
//
// Theme: matches `tooltipSlotProps` in themes/sx-tokens.js — same
// rgba(0, 20, 61, 0.96) surface, same reflected-light border, same
// box-shadow recipe — so toasts read as part of the same chrome
// vocabulary as tooltips. Color of the message switches by severity:
// var(--green) for success, var(--orange) for error.
//
// Anchored bottom-right per product spec. 4-second auto-hide.
// Dismissable via the close (×) button on the snackbar, or by simply
// firing another toast (the new one replaces the old).

import PropTypes from 'prop-types';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import AntIcon from 'components/AntIcon';
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';

const ToastContext = createContext(null);

const TOAST_AUTO_HIDE_MS = 4000;

// Severity-to-text-color map. The toast surface itself stays the same
// dark-navy regardless — only the message color changes — so success
// vs error reads at a glance without the surface flashing.
const SEVERITY_COLOR = {
  success: 'var(--green)',
  error: 'var(--orange)'
};

export default function ToastProvider({ children }) {
  // Single toast slot. `toast` is null when nothing is showing,
  // otherwise { message, severity, key } — the key forces a fresh
  // Snackbar render when a new toast replaces an in-flight one
  // (without it MUI may not re-trigger the auto-hide timer).
  const [toast, setToast] = useState(null);

  const show = useCallback((message, severity) => {
    setToast({ message, severity, key: Date.now() });
  }, []);

  const handleClose = useCallback((_event, reason) => {
    // Prevent click-away from closing — the user could be mid-action
    // (typing into a search bar, hovering a card) when the toast
    // appears, and click-away dismissal would feel arbitrary. Auto-
    // hide and explicit close button are the only dismissal paths.
    if (reason === 'clickaway') return;
    setToast(null);
  }, []);

  // The hook surface — `success` and `error` methods plus a generic
  // `show`. Memoized so consumers calling useToast() don't re-render
  // every time anything in this provider re-renders.
  const value = useMemo(
    () => ({
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error'),
      show
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={TOAST_AUTO_HIDE_MS}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        // ContentProps drives the inner card. Mirroring tooltip
        // styling from sx-tokens.js so toasts share the chrome
        // vocabulary with tooltips — same border, same shadow, same
        // surface color.
        ContentProps={{
          sx: {
            backgroundColor: 'rgba(0, 20, 61, 0.96)',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
            border: '1px solid var(--reflected-light)',
            boxShadow: '0 11px 19px 1px #0000002e',
            backdropFilter: 'blur(6px)',
            color: toast ? SEVERITY_COLOR[toast.severity] : 'var(--green)',
            borderRadius: 1,
            minWidth: { xs: 280, sm: 320 }
          }
        }}
        message={
          <Typography
            variant="body2"
            sx={{
              color: toast ? SEVERITY_COLOR[toast.severity] : 'var(--green)',
              fontWeight: 500,
              fontSize: '0.88rem',
              // Soft shadow on the message text so it sits with the
              // same depth as the metric values inside cards.
              textShadow: '0 1px 5px #1a75e060'
            }}
          >
            {toast?.message}
          </Typography>
        }
        action={
          <IconButton
            aria-label="dismiss notification"
            size="small"
            onClick={() => setToast(null)}
            sx={{
              color: 'var(--blue)',
              '&:hover': {
                color: 'var(--green)',
                backgroundColor: 'rgba(72, 247, 245, 0.08)'
              }
            }}
          >
            <AntIcon icon={CloseOutlined} style={{ fontSize: 14 }} />
          </IconButton>
        }
      />
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = { children: PropTypes.node };

/**
 * Access the global toast notifier. Returns an object with:
 *
 *   success(message) — green-text toast, 4-second auto-hide.
 *   error(message)   — orange-text toast, 4-second auto-hide.
 *   show(message, severity) — generic, accepts 'success' | 'error'.
 *
 * Throws if called outside ToastProvider — that's a programmer error
 * (the provider should be mounted at the app root in App.jsx) so we
 * fail loudly during development rather than silently no-op.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() called outside ToastProvider — mount ToastProvider at the app root.');
  }
  return ctx;
}
