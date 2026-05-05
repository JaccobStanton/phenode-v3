import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import Logo from 'components/logo/LogoIcon';
import useAuth from 'hooks/useAuth';
import { refreshTokens } from 'services/fetcher';

// ============================|| AUTH - APPROVAL PENDING ||============================ //
//
// Users who have signed in via Google but haven't been approved by an admin
// land here. The backend signals approval state via:
//
//   - POST /api/auth/token  → 403 if is_approved=false (per
//     phenodeX/docs/frontend-backend-api.md, "Auth API")
//   - GET  /api/user/devices → 403 while still pending; 200 once approved.
//
// We poll /user/devices every 10s. On 200 we redirect to the dashboard.
// The user can also log out from here.
//
// User identity and the access token come from `useAuth()` (AuthContext).
// We don't touch localStorage directly here — the context owns it.
//
// All colors come from project CSS variables (src/assets/style.css). The
// "pending" state uses --orange to match the project's warning convention.

const POLL_INTERVAL_MS = 10000;

export default function AuthApprovalPending() {
  const navigate = useNavigate();
  const { user, accessToken, refreshToken, isAuthenticated, login, logout } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(POLL_INTERVAL_MS / 1000);
  // Once we've started the post-approval flow (refresh + navigate), gate
  // out concurrent polls — the 1-second tick can fire checkApproval
  // again before the previous run finishes its async refresh.
  const approvalHandlingRef = useRef(false);

  useEffect(() => {
    // If the AuthContext says we have no usable session, bounce back to
    // /login. `isAuthenticated` already covers "missing token" + "expired
    // token"; the explicit accessToken check is belt-and-suspenders for
    // the edge case where exp is missing on a malformed JWT.
    if (!isAuthenticated || !accessToken) {
      navigate('/login', { replace: true });
      return undefined;
    }

    let cancelled = false;

    /**
     * Fires once when the backend reports approval. Refresh the JWT
     * before navigating so the new token carries the updated
     * `is_approved=true` claim — without this, the user's existing
     * JWT still says is_approved=false (it was minted at login time,
     * before the admin approved). That's tolerable today (RequireAuth
     * doesn't gate on approval — see its docblock for why) but a
     * footgun for any future approval-aware UI or guard, so we mint
     * a fresh token now while we have a clean transition point.
     *
     * If the refresh itself fails, fall through to navigation anyway
     * — the dashboard pages will pick up the existing token, and the
     * fetcher's auto-refresh handles staleness on subsequent calls.
     * Worst case the user sees stale claim-driven labels for a beat;
     * better than blocking them out of a dashboard they've earned.
     */
    const handleApproved = async () => {
      if (approvalHandlingRef.current) return;
      approvalHandlingRef.current = true;

      try {
        if (refreshToken) {
          const newTokens = await refreshTokens(refreshToken);
          if (cancelled) return;
          login(newTokens);
        }
      } catch (refreshErr) {
        console.warn('[approval-pending] post-approval refresh failed:', refreshErr);
      }

      if (cancelled) return;
      navigate('/dashboard/fleet-overview', { replace: true });
    };

    const checkApproval = async () => {
      // Skip if we've already kicked off the approval handoff.
      if (approvalHandlingRef.current) return;
      try {
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${apiBase}/user/devices`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (cancelled) return;
        if (res.ok) {
          await handleApproved();
        }
        // 403 means still pending; do nothing and let the next tick try again.
      } catch (err) {
        // Network error — keep polling silently.
        console.warn('[approval-pending] check failed', err);
      }
    };

    // Kick off an immediate check, then a 1-second countdown that re-checks
    // when it hits zero.
    checkApproval();
    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          checkApproval();
          return POLL_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [navigate, isAuthenticated, accessToken, refreshToken, login]);

  // logout() handles the navigation itself (via the navigate captured
  // inside AuthContext), so we just call it.
  const handleLogout = () => logout();

  return (
    <Stack spacing={3}>
      {/* Brand mark + heading — orange glow for pending state */}
      <Stack alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 20, 61, 0.72)',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.0))',
            border: '1px solid var(--orange)',
            boxShadow: '0 0 12px -2px var(--orange), 0 11px 19px 1px #0000002e'
          }}
        >
          <Logo />
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: '#ffffff',
            fontSize: '1.05rem',
            letterSpacing: '0.01em',
            mt: 0.5,
            textAlign: 'center',
            textShadow: '0 1px 9px #1a75e0c9'
          }}
        >
          Welcome to PheNode!
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255, 255, 255, 0.65)', textAlign: 'center', fontSize: '0.85rem' }}
        >
          Thanks for signing up
        </Typography>
      </Stack>

      {user?.email && (
        <Box
          sx={{
            mx: 'auto',
            px: 1.5,
            py: 0.75,
            borderRadius: 999,
            border: '1px solid var(--reflected-light)',
            backgroundColor: 'rgba(0, 20, 61, 0.55)',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
            fontSize: '0.78rem',
            color: 'rgba(255, 255, 255, 0.85)'
          }}
        >
          {user.email}
        </Box>
      )}

      {/* Pending status panel — uses --orange in line with the project's
          warning convention */}
      <Box
        sx={{
          borderRadius: 1,
          px: 2.25,
          py: 2,
          backgroundColor: 'rgba(255, 140, 73, 0.06)',
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02))',
          border: '1px solid var(--orange)',
          boxShadow: '0 0 7px -2px var(--orange), 0 11px 19px 1px #0000002e'
        }}
      >
        <Stack spacing={0.75}>
          <Typography
            variant="subtitle2"
            sx={{ color: 'var(--orange)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.02em' }}
          >
            Account status: pending approval
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.78)', fontSize: '0.8rem' }}>
            A PheNode administrator is reviewing your request. You&apos;ll be redirected
            automatically once approved.
          </Typography>
        </Stack>
      </Box>

      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255, 255, 255, 0.55)',
          textAlign: 'center',
          display: 'block',
          fontSize: '0.75rem'
        }}
      >
        Re-checking in {secondsLeft} second{secondsLeft === 1 ? '' : 's'}...
      </Typography>

      {/* Logout — neutral chrome with the project's neon-on-hover treatment */}
      <Box
        component="button"
        type="button"
        onClick={handleLogout}
        sx={{
          width: '100%',
          height: 44,
          borderRadius: 1,
          cursor: 'pointer',
          color: 'rgba(255, 255, 255, 0.85)',
          fontFamily: 'inherit',
          fontSize: '0.85rem',
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          backgroundColor: 'rgba(0, 20, 61, 0.55)',
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
          border: '1px solid var(--reflected-light)',
          boxShadow: '0 11px 19px 1px #0000002e',
          transition: 'all 0.18s ease',
          '&:hover': {
            borderColor: 'var(--green)',
            color: 'var(--green)',
            textShadow: '0 1px 5px #007bff',
            boxShadow: '0 0 7px -2px var(--green), 0 11px 19px 1px #0000002e',
            backgroundColor: 'rgba(72, 247, 245, 0.08)'
          }
        }}
      >
        Log out
      </Box>

      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255, 255, 255, 0.5)',
          textAlign: 'center',
          display: 'block',
          fontSize: '0.72rem',
          fontStyle: 'italic'
        }}
      >
        Need help? Contact your administrator for account approval.
      </Typography>
    </Stack>
  );
}
