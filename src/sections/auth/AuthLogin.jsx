import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';

// project imports
import IconButton from 'components/@extended/IconButton';
import Logo from 'components/logo/LogoIcon';
import { tooltipSlotProps } from 'themes/sx-tokens';

// assets
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import EyeInvisibleOutlined from '@ant-design/icons/EyeInvisibleOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';

// ============================|| AUTH - LOGIN ||============================ //
//
// Sign-in card for existing users. Two ways in:
//
//   1. Email + password — calls POST /api/auth/login.
//   2. Google OAuth     — redirects through GET /api/auth/google/login.
//
// Backend contract (see phenodeX/phenode_backend/api/auth/routes.py):
//
//   POST /api/auth/login
//     body: { email, password }
//     200 → { access_token, refresh_token, token_type: "bearer" }
//     401 → invalid email or password
//     403 → account disabled OR pending approval
//
//   POST /api/auth/token       (Google ID token → JWTs; 403 if pending)
//   POST /api/auth/refresh     (rotate JWT pair)
//   GET  /api/auth/google/login (start OAuth)
//
// On 200 we store the tokens in localStorage (matching phenodeX's
// AuthContext convention) and route to /dashboard/fleet-overview.
// On 403 we route to /approval-pending — that page polls until the admin
// approves and then sends the user on to the dashboard.

// Stub handler — will redirect to backend Google OAuth start once the
// /oauth/callback page is added in V3 to handle the Google ID token round
// trip (mirrors phenodeX/src/pages/LoginPage.jsx).
const handleGoogleSignIn = () => {
  // TODO: enable once /oauth/callback page is wired to POST /api/auth/token:
  // window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/google/login`;
  // eslint-disable-next-line no-console
  console.info('[auth] Google sign-in clicked — /oauth/callback page wiring pending');
};

// ----------------------------------------------------------------------
// Provider button — project's neon-themed pill. Mirrors orientationButtonSx
// in themes/sx-tokens.js: reflected-light border, midnight-blue background,
// neon-green glow on hover.
// ----------------------------------------------------------------------
function ProviderButton({ children, onClick, type = 'button', disabled = false, glow = false, ariaLabel }) {
  return (
    <Box
      component="button"
      type={type}
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      sx={{
        position: 'relative',
        width: '100%',
        height: 48,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.25,
        px: 2,
        borderRadius: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: glow ? 'var(--green)' : '#ffffff',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        opacity: disabled ? 0.4 : 1,
        backgroundColor: 'rgba(0, 20, 61, 0.72)',
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
        border: glow ? '1px solid var(--blue)' : '1px solid var(--reflected-light)',
        boxShadow: '0 11px 19px 1px #0000002e',
        textShadow: 'none',
        transition: 'color 0.18s ease, border-color 0.18s ease',
        '&:hover': disabled
          ? undefined
          : {
              borderColor: 'var(--green)',
              color: 'var(--green)'
            }
      }}
    >
      {children}
    </Box>
  );
}


const blendedInputSx = {
  backgroundColor: 'rgba(0, 13, 48, 0.55)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.025))',
  boxShadow: '0 11px 19px 1px #0000002e',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--reflected-light)' },
  '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--green)' },
  '&.Mui-focused:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--green)', borderWidth: 1 },
  // Typed value renders in neon-green; placeholder in blue
  '& input': { color: 'var(--green)' },
  '& input::placeholder': { color: 'var(--green)', opacity: 1 }
};

// Shared sx for icon buttons that live inside an input's adornment
// (eye toggle on the password field, clear-X on the email field).
// Project convention: sit at rest in --blue, brighten to --green with a
// soft neon hover treatment.
const inputAdornmentIconSx = {
  color: 'var(--blue)',
  transition: 'all 0.18s ease',
  '&:hover': {
    color: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.08)',
    textShadow: '0 1px 5px #007bff'
  },
  '&:focus-visible': {
    color: 'var(--green)',
    outline: '1px solid var(--green)',
    outlineOffset: 2
  }
};

// Inline brand glyph (kept inline to avoid an extra icon dependency).
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86a5.27 5.27 0 0 1-4.95-3.64H.96v2.33A9 9 0 0 0 9 18z"
      fill="#34A853"
    />
    <path d="M4.05 10.78a5.27 5.27 0 0 1 0-3.56V4.89H.96a9 9 0 0 0 0 8.22l3.09-2.33z" fill="#FBBC05" />
    <path
      d="M9 3.58c1.32 0 2.51.45 3.44 1.34l2.58-2.58A9 9 0 0 0 .96 4.89l3.09 2.33A5.27 5.27 0 0 1 9 3.58z"
      fill="#EA4335"
    />
  </svg>
);

const AppleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M16.365 1.43c0 1.14-.41 2.13-1.16 2.94-.86.92-2.04 1.55-3.13 1.46-.13-1.1.42-2.24 1.18-3.05.86-.92 2.16-1.59 3.11-1.35zM20.6 17.4c-.37.86-.82 1.7-1.36 2.5-.76 1.13-1.85 2.55-3.22 2.55-1.18 0-1.51-.78-3.13-.78-1.61 0-1.97.78-3.13.78-1.36 0-2.4-1.31-3.18-2.43-1.55-2.27-2.74-6.42-1.14-9.22.79-1.4 2.21-2.27 3.74-2.3 1.32-.02 2.56.89 3.36.89.79 0 2.31-1.1 3.9-.94.66.03 2.52.27 3.71 2.04-3.21 1.74-2.7 6.29.45 6.91z"
      fill="#ffffff"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.18c-3.34.72-4.04-1.4-4.04-1.4-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4 1.02 0 2.05.13 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12z"
      fill="#ffffff"
    />
  </svg>
);

// ----------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------
export default function AuthLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        navigate('/dashboard/fleet-overview', { replace: true });
        return;
      }

      // 403 with a "pending approval" detail means the user exists but is
      // still waiting on a SUPER_ADMIN. Route them to the polling page so
      // they can wait there with feedback (matches the Google flow).
      if (res.status === 403) {
        let detail = '';
        try {
          const body = await res.json();
          detail = body?.detail || '';
        } catch {
          // ignore
        }
        if (detail.toLowerCase().includes('pending')) {
          navigate('/approval-pending', { replace: true });
          return;
        }
        setError(detail || 'This account is not allowed to sign in.');
        return;
      }

      // 401 / anything else → show inline error
      let detail = 'Invalid email or password.';
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // ignore
      }
      setError(detail);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] login network error', err);
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      {/* Brand mark + heading */}
      <Stack alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 20, 61, 0.72)',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.0))',
            border: '1px solid var(--reflected-light)',
            // Standard project drop shadow only — no neon glow ring
            boxShadow: '0 11px 19px 1px #0000002e'
          }}
        >
          <Logo />
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: '#ffffff',
            fontSize: '1rem',
            letterSpacing: '0.01em',
            mt: 0.5,
          }}
        >
          Sign in to dashboard
        </Typography>
      </Stack>

      {/* Inline error */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError('')}
          sx={{
            backgroundColor: 'rgba(247, 72, 122, 0.10)',
            border: '1px solid var(--critical)',
            color: 'var(--critical)',
            fontSize: '0.8rem',
            '& .MuiAlert-icon': { color: 'var(--critical)' }
          }}
        >
          {error}
        </Alert>
      )}

      {/* Email / password form */}
      <Box component="form" onSubmit={handleEmailLogin}>
        <Stack spacing={1.5}>
          {/* Field labels removed — placeholders carry the same info. */}
          <OutlinedInput
            id="email-login"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email..."
            fullWidth
            autoComplete="username"
            sx={blendedInputSx}
            endAdornment={
              email ? (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Clear login"
                    onClick={() => setEmail('')}
                    onMouseDown={(e) => e.preventDefault()}
                    edge="end"
                    size="small"
                    sx={inputAdornmentIconSx}
                  >
                    <CloseOutlined />
                  </IconButton>
                </InputAdornment>
              ) : null
            }
          />

          <OutlinedInput
            id="password-login"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password..."
            fullWidth
            autoComplete="current-password"
            sx={blendedInputSx}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword((v) => !v)}
                  onMouseDown={(e) => e.preventDefault()}
                  edge="end"
                  size="small"
                  sx={inputAdornmentIconSx}
                >
                  {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                </IconButton>
              </InputAdornment>
            }
          />

          {/* Forgot password link */}
          <Stack direction="row" justifyContent="flex-end">
            <Typography
              component={RouterLink}
              to="#"
              variant="body2"
              sx={{
                color: 'var(--blue)',
                fontSize: '0.78rem',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 0.18s ease',
                '&:hover': { color: 'var(--green)', textDecoration: 'underline' }
              }}
            >
              Forgot password?
            </Typography>
          </Stack>

          {/* Primary submit — narrower, centered, subtle green border/text
              glow at rest that intensifies a touch on hover. */}
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
            <Box sx={{ width: { xs: '70%', sm: '60%' }, maxWidth: 220 }}>
              <ProviderButton type="submit" glow disabled={submitting} ariaLabel="Sign in with email and password">
                <span>{submitting ? 'Signing in...' : 'Login'}</span>
              </ProviderButton>
            </Box>
          </Box>
        </Stack>
      </Box>

      {/* Social row — Google functional, Apple/GitHub placeholders.
          Note: the previous "or" divider line was removed — it didn't match
          the project's UX language and read as an artifact. */}
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ pt: 1 }}>
        <Tooltip title="Continue with Google" placement="top" slotProps={tooltipSlotProps}>
          <Box
            component="button"
            type="button"
            onClick={handleGoogleSignIn}
            aria-label="Continue with Google"
            sx={socialIconButtonSx}
          >
            <GoogleIcon />
          </Box>
        </Tooltip>
        <Tooltip title="Apple — coming soon" placement="top" slotProps={tooltipSlotProps}>
          <Box component="span" sx={{ display: 'inline-block' }}>
            <Box component="button" type="button" disabled aria-label="Apple coming soon" sx={socialIconButtonDisabledSx}>
              <AppleIcon />
            </Box>
          </Box>
        </Tooltip>
        <Tooltip title="GitHub — coming soon" placement="top" slotProps={tooltipSlotProps}>
          <Box component="span" sx={{ display: 'inline-block' }}>
            <Box component="button" type="button" disabled aria-label="GitHub coming soon" sx={socialIconButtonDisabledSx}>
              <GitHubIcon />
            </Box>
          </Box>
        </Tooltip>
      </Stack>

      {/* Footer link to register */}
      <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.75}>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.8rem' }}>
          Don&apos;t have an account?
        </Typography>
        <Typography
          component={RouterLink}
          to="/register"
          variant="body2"
          sx={{
            color: 'var(--blue)',
            fontSize: '0.8rem',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'color 0.18s ease',
            '&:hover': { color: 'var(--green)', textDecoration: 'underline' }
          }}
        >
          Request access
        </Typography>
      </Stack>
    </Stack>
  );
}

// ----------------------------------------------------------------------
// Small icon-only social buttons. Same neon-on-hover treatment as the main
// provider button (mirrors orientationButtonSx in themes/sx-tokens.js).
// ----------------------------------------------------------------------
const socialIconButtonSx = {
  width: 44,
  height: 44,
  borderRadius: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: '1px solid var(--reflected-light)',
  backgroundColor: 'rgba(0, 20, 61, 0.72)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  // Only the project's standard drop shadow — no glow ring at any state.
  boxShadow: '0 11px 19px 1px #0000002e',
  transition: 'border-color 0.18s ease',
  // Hover: border switches to --green, nothing else changes.
  '&:hover': {
    borderColor: 'var(--green)'
  }
};

const socialIconButtonDisabledSx = {
  ...socialIconButtonSx,
  cursor: 'not-allowed',
  opacity: 0.35,
  '&:hover': {} // no hover when disabled
};
