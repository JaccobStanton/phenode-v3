import { Link as RouterLink } from 'react-router-dom';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import Logo from 'components/logo/LogoIcon';

// ============================|| AUTH - REGISTER (Google-only) ||============================ //
//
// New PheNode accounts are created on first Google sign-in. They land in
// the database with is_approved=false and must be approved by a SUPER_ADMIN
// before they can use the app. (See phenodeX/docs/frontend-backend-api.md,
// "Auth API" — POST /api/auth/token returns 403 for unapproved users.)
//
// Sign-up flow (end-to-end, once AuthContext is wired):
//   1. User clicks "Continue with Google" below.
//   2. We send the browser to GET /api/auth/google/login.
//   3. Backend bounces through Google consent then calls
//      GET /api/auth/google/callback, which redirects to
//      ${FRONTEND_ORIGIN}/oauth/callback?token=<google_id_token>.
//   4. The frontend OAuth callback page POSTs the google_id_token to
//      /api/auth/token to receive { access_token, refresh_token }.
//   5. If the backend returns 403 (is_approved=false), we redirect to
//      /approval-pending where the page polls /api/user/devices until the
//      admin approves the account, then jumps to the dashboard.
//   6. If 200, we go straight to the dashboard.
//
// All colors come from project CSS variables (src/assets/style.css) and
// the shared sx-tokens conventions in src/themes/sx-tokens.js.

// Same handoff as AuthLogin's Google button — see that file for the
// full flow notes. The only difference here is the user's intent: they
// expect to be a new account, so the very common landing is
// /approval-pending (the backend creates the row with is_approved=false
// and the /oauth/callback page detects the 403 from POST /api/auth/token).
const handleGoogleSignIn = () => {
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  window.location.assign(`${apiBase}/auth/google/login`);
};

// ----------------------------------------------------------------------
// Skeuomorphic glowing CTA — same neon-themed pill style as AuthLogin's
// primary button so the two pages feel like one design system.
// ----------------------------------------------------------------------
function GlowButton({ children, onClick, ariaLabel }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
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
        cursor: 'pointer',
        color: 'var(--green)',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        backgroundColor: 'rgba(0, 20, 61, 0.72)',
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
        // Same recipe as the Login button: --blue border at rest, swaps to
        // --green on hover. No glow rings — only the project's drop shadow.
        border: '1px solid var(--blue)',
        boxShadow: '0 11px 19px 1px #0000002e',
        textShadow: 'none',
        transition: 'color 0.18s ease, border-color 0.18s ease',
        '&:hover': {
          borderColor: 'var(--green)',
          color: 'var(--green)'
        }
      }}
    >
      {children}
    </Box>
  );
}

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

// ----------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------
export default function AuthRegister() {
  return (
    <Stack spacing={3}>
      {/* Brand mark + heading */}
      <Stack alignItems="center" spacing={1.25}>
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
            border: '1px solid var(--reflected-light)',
            // Standard project drop shadow only — matches AuthLogin's logo box
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
            fontSize: '1.05rem',
            letterSpacing: '0.01em',
            mt: 0.5,
          }}
        >
          Request access
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            fontSize: '0.85rem',
            maxWidth: 340
          }}
        >
          Sign in with Google to create your PheNode account. Once submitted,
          a PheNode administrator will review and approve your request.
        </Typography>
      </Stack>

      {/* Approval flow steps — uses the project's glass + reflected-light
          card chrome (same as cards in the dashboard) */}
      <Box
        sx={{
          borderRadius: 1,
          px: 2.25,
          py: 2,
          backgroundColor: 'rgba(0, 20, 61, 0.55)',
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
          border: '1px solid var(--reflected-light)',
          boxShadow: '0 11px 19px 1px #0000002e'
        }}
      >
        <Stack spacing={1.25}>
          <Step n="1" label="Sign in with your Google account" />
          <Step n="2" label="An admin reviews your request" />
          <Step n="3" label="You'll get access once approved" />
        </Stack>
      </Box>

      {/* CTA */}
      <GlowButton onClick={handleGoogleSignIn} ariaLabel="Continue with Google">
        <GoogleIcon />
        <span>Continue with Google</span>
      </GlowButton>

      {/* Footer link to login */}
      <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.75}>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.8rem' }}>
          Already have access?
        </Typography>
        <Typography
          component={RouterLink}
          to="/login"
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
          Sign in
        </Typography>
      </Stack>
    </Stack>
  );
}

// ----------------------------------------------------------------------
function Step({ n, label }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Box
        sx={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 600,
          color: 'var(--green)',
          background: 'rgba(72, 247, 245, 0.12)',
          border: '1px solid var(--green)',
          textShadow: '0 1px 5px #007bff'
        }}
      >
        {n}
      </Box>
      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.78)', fontSize: '0.85rem' }}>
        {label}
      </Typography>
    </Stack>
  );
}
