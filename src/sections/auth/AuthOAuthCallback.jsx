import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { preload } from 'swr';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

// project imports
import Logo from 'components/logo/LogoIcon';
import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';

// ============================|| AUTH - OAUTH CALLBACK ||============================ //
//
// Landing page for the Google OAuth round trip. The end-to-end shape:
//
//   1. User clicks "Continue with Google" on /login or /register.
//   2. Browser navigates to GET ${VITE_API_URL}/auth/google/login.
//   3. Backend bounces through Google's consent screen and then calls
//      GET /api/auth/google/callback, which exchanges the auth code with
//      Google for a real ID token and 302s the browser to
//      ${FRONTEND_ORIGIN}/oauth/callback?token=<google_id_token>
//      (verified at phenodeX/phenode_backend/api/auth/routes.py:118-120).
//      On any Google-side failure the backend instead redirects to
//      ${FRONTEND_ORIGIN}/login?error=<reason> (lines 89, 116, 123).
//   4. This page reads the ?token from the URL, POSTs it to
//      /api/auth/token (verified at routes.py:218), and dispatches via
//      the same matrix that AuthLogin uses for email/password sign-in.
//
// Dispatch matrix (mirrors AuthLogin.jsx §4):
//   200          → login(data); preload device list; /dashboard/fleet-overview
//   403 pending  → /approval-pending (backend uses the literal phrase
//                  "pending approval" — see routes.py:307)
//   403 other    → render themed Alert; offer "Back to sign in"
//   400 / 401    → render themed Alert with backend's detail
//   network err  → render themed Alert "Network error — please try again."
//
// This component never reads/writes localStorage directly — it goes
// through useAuth().login() so the AuthContext updates and every
// consumer (Profile menu, fetch hooks, route guards) sees the new
// session without re-reading storage.
//
// All colors come from project CSS variables (src/assets/style.css).

const FALLBACK_ERROR = 'Sign-in failed. Please try again.';

// Map the ?error=<code> values the backend can send when the Google
// round trip itself fails (before it ever issues us an ID token). Friendly
// copy lives here so the callback page can surface the same reasons
// AuthLogin would for direct /login?error=… landings.
function describeBackendError(errorCode) {
  if (!errorCode) return null;
  switch (errorCode) {
    case 'access_denied':
      return 'You cancelled the Google sign-in.';
    case 'no_id_token':
      return 'Google did not return an ID token. Please try again.';
    case 'token_exchange_failed':
      return 'Google sign-in failed during the token exchange. Please try again.';
    default:
      // Surface unfamiliar codes verbatim so we don't swallow useful
      // diagnostics, but cap length so unexpected payloads can't blow
      // out the layout.
      return `Google sign-in failed (${String(errorCode).slice(0, 80)}).`;
  }
}

export default function AuthOAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState('');
  // Guard against React 18 StrictMode double-invocation in dev — the
  // /auth/token endpoint is intentionally idempotent on the backend, but
  // double-firing the exchange would still produce a confusing flicker
  // and an extra audit-log row. One real attempt per mount is what we
  // want; the ref outlives the StrictMode re-mount cycle.
  const exchangeStartedRef = useRef(false);

  useEffect(() => {
    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    const googleIdToken = searchParams.get('token');
    const backendError = searchParams.get('error');

    // 1. Backend told us OAuth already failed upstream (Google denied,
    //    no id_token came back, token exchange with Google blew up).
    //    Surface it; no point hitting /api/auth/token.
    if (backendError) {
      setError(describeBackendError(backendError) || FALLBACK_ERROR);
      return;
    }

    // 2. We were navigated to /oauth/callback without a ?token — this
    //    shouldn't happen in the normal flow (the backend's callback
    //    handler always appends one on success), but if a user lands
    //    here directly or bookmarks it, give a clear message rather
    //    than silently retrying.
    if (!googleIdToken) {
      setError('No Google sign-in token was provided. Please start sign-in again.');
      return;
    }

    let cancelled = false;

    const exchange = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${apiBase}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ google_id_token: googleIdToken })
        });

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          // login() persists both tokens AND updates AuthContext so every
          // consumer (Profile menu, fetch hooks, route guards) sees the
          // new session without re-reading localStorage. Matches the
          // email/password flow in AuthLogin.jsx:217.
          login(data);
          // Pre-warm the device list before navigating so the
          // dashboard's first paint doesn't flash a "loading fleet…"
          // state. Same trick AuthLogin uses on a successful 200.
          preload([buildUrl(API.devices.myDevices), data.access_token], fetcher);
          navigate('/dashboard/fleet-overview', { replace: true });
          return;
        }

        // 403 with a "pending approval" detail means the user exists but
        // is still waiting on a SUPER_ADMIN. Backend wording is
        // "Your account is pending approval. Please contact an
        // administrator." (routes.py:307). Match the case-insensitive
        // substring check we use in AuthLogin for resilience to copy
        // tweaks.
        if (res.status === 403) {
          let detail = '';
          try {
            const body = await res.json();
            detail = body?.detail || '';
          } catch {
            // ignore — fall through to the generic 403 case below
          }
          if (detail.toLowerCase().includes('pending')) {
            navigate('/approval-pending', { replace: true });
            return;
          }
          setError(detail || 'This account is not allowed to sign in.');
          return;
        }

        // 400 / 401 / anything else → show the backend's detail if we
        // can read one, otherwise a generic fallback.
        let detail = FALLBACK_ERROR;
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
        } catch {
          // ignore — keep the fallback message
        }
        setError(detail);
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[auth] oauth token exchange network error', err);
        setError('Network error — please try again.');
      }
    };

    exchange();

    return () => {
      cancelled = true;
    };
  }, [searchParams, login, navigate]);

  return (
    <Stack spacing={2.5} alignItems="center">
      {/* Logo box — matches AuthLogin's 52x52 brand mark exactly so the
          surface feels continuous as the user lands here from /login. */}
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: 1.5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(160deg, rgba(0, 31, 68, 0.45) 0%, rgba(0, 13, 48, 0.85) 100%)',
          border: '1px solid var(--reflected-light)',
          boxShadow: '0 11px 19px 1px #0000002e'
        }}
      >
        <Logo />
      </Box>

      <Stack alignItems="center" spacing={0.5}>
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: '1.4rem', sm: '1.55rem' },
            fontWeight: 600,
            color: '#ffffff',
            letterSpacing: '-0.25px',
            textShadow: '0 1px 9px #1a75e0c9',
            textAlign: 'center'
          }}
        >
          {error ? 'Sign-in failed' : 'Signing you in…'}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontSize: '0.85rem',
            color: 'var(--blue)',
            textAlign: 'center',
            maxWidth: 320
          }}
        >
          {error
            ? 'We hit a snag finishing the Google sign-in.'
            : 'Finishing the Google handoff. This usually takes a second.'}
        </Typography>
      </Stack>

      {/* Active state — themed spinner. The MUI CircularProgress
          inherits color from sx; --green matches the project's "in
          progress" semantic used across the app. */}
      {!error && (
        <Box sx={{ pt: 1 }}>
          <CircularProgress
            size={32}
            thickness={4}
            sx={{ color: 'var(--green)' }}
          />
        </Box>
      )}

      {/* Failure state — themed Alert + a way back to the sign-in
          surface. Mirrors the Alert recipe AuthLogin uses inline so
          the look is identical regardless of which page surfaces an
          error. */}
      {error && (
        <Stack spacing={2} sx={{ width: '100%', alignItems: 'center' }}>
          <Alert
            severity="error"
            sx={{
              width: '100%',
              backgroundColor: 'rgba(247, 72, 122, 0.10)',
              border: '1px solid var(--critical)',
              color: 'var(--critical)',
              fontSize: '0.8rem',
              '& .MuiAlert-icon': { color: 'var(--critical)' }
            }}
          >
            {error}
          </Alert>

          <Typography
            component={RouterLink}
            to="/login"
            replace
            sx={{
              fontSize: '0.85rem',
              color: 'var(--blue)',
              textDecoration: 'none',
              transition: 'color 0.18s ease',
              '&:hover': { color: 'var(--green)', textDecoration: 'underline' }
            }}
          >
            ← Back to sign in
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
