import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

// project imports
import AuthBackground from './AuthBackground';

// ==============================|| AUTHENTICATION - WRAPPER ||============================== //
//
// Centered "pill" layout (per mockup):
//   - Page background: midnight-blue gradient with subtle neon accents,
//     matching the rest of the dashboard.
//   - A single rounded-rectangle pill is centered on screen.
//   - Inside the pill: LEFT column = sign-in/sign-up form,
//                     RIGHT column = "Welcome to PheNode" brand panel.
//   - On screens < md the pill collapses to one column (form only) and
//     fills the viewport edge-to-edge with no rounded corners.
//
// All colors come from project CSS variables (src/assets/style.css) so the
// auth surface stays in sync with the rest of the app.

export default function AuthWrapper({ children }) {
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('md'));

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // No outer padding on mobile so the pill can fill edge-to-edge
        px: { xs: 0, sm: 0, md: 4 },
        py: { xs: 0, sm: 0, md: 6 },
        // Project-themed gradient: midnight blue base + neon cyan/blue
        // accents in the corners. Mirrors the body bg used in style.css
        // (--midnight-blue) but adds depth for the pill to sit on.
        background: `
          radial-gradient(ellipse at 15% 20%, rgba(72, 247, 245, 0.10) 0%, transparent 55%),
          radial-gradient(ellipse at 85% 80%, rgba(26, 118, 224, 0.22) 0%, transparent 60%),
          radial-gradient(ellipse at 50% 110%, rgba(0, 13, 48, 0.7) 0%, transparent 70%),
          linear-gradient(180deg, var(--midnight-blue) 0%, var(--bg-dark-color) 50%, var(--midnight-blue-2) 100%)
        `
      }}
    >
      {/* Atmospheric glows behind the pill */}
      <AuthBackground />

      {/* THE PILL — centered & rounded on desktop; full-bleed on mobile */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: { xs: 'none', md: 980, lg: 1080 },
          minHeight: { xs: '100vh', md: 560 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          alignItems: 'stretch',
          // No rounded corners on mobile (otherwise compressed screens show
          // rounded bottom corners against the page background).
          borderRadius: { xs: 0, md: 4 },
          overflow: 'hidden',
          // Glass surface — matches the reflectedCardChromeSx + glassSurfaceSx
          // pattern used by MainCard wrappers throughout the app.
          background: {
            xs: 'transparent',
            md: `
              linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03)),
              linear-gradient(160deg, rgba(0, 31, 68, 0.55) 0%, rgba(0, 13, 48, 0.78) 100%)
            `
          },
          // Project's standard reflected-light border on desktop
          border: { xs: 'none', md: '1px solid var(--reflected-light)' },
          // Standard project shadow + a soft neon glow ring
          boxShadow: {
            xs: 'none',
            md: `
              0 1px 0 rgba(255, 255, 255, 0.04) inset,
              0 0 0 1px rgba(0, 0, 0, 0.35) inset,
              0 11px 19px 1px #0000002e,
              0 40px 80px -20px rgba(0, 0, 0, 0.7),
              0 0 60px -10px rgba(72, 247, 245, 0.12)
            `
          },
          backdropFilter: { md: 'blur(14px)' }
        }}
      >
        {/* LEFT COLUMN — Auth form */}
        <Stack
          sx={{
            justifyContent: 'center',
            alignItems: 'center',
            px: { xs: 3, sm: 4, md: 5, lg: 6 },
            py: { xs: 4, sm: 5, md: 6 }
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 380 }}>{children}</Box>
        </Stack>

        {/* RIGHT COLUMN — Welcome panel (hidden on mobile) */}
        {isDesktop && (
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              px: { md: 5, lg: 7 },
              py: 6,
              // Same reflected-light divider used between cards in the
              // dashboard
              borderLeft: '1px solid var(--reflected-light)',
              // Soft radial gradient — lighter #031a46 sits behind the
              // "Welcome to PheNode" heading and falls off to the darker
              // #05132c at the edges. Single, subtle layer so it doesn't
              // fight the page-level gradient.
              background: 'radial-gradient(ellipse at 30% 45%, #031a46 0%, #05132c 75%)',
              boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.03)'
            }}
          >
            <Typography
              variant="h1"
              sx={{
                fontSize: { md: '2.25rem', lg: '2.75rem' },
                fontWeight: 700,
                lineHeight: 1.15,
                color: '#ffffff',
                letterSpacing: '-0.5px',
                mb: 2,
                // Project's neon glow signature on the heading
                textShadow: '0 1px 9px #1a75e0c9'
              }}
            >
              Welcome to PheNode
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { md: '0.95rem', lg: '1rem' },
                color: 'var(--blue)',
                fontWeight: 400,
                maxWidth: 380
              }}
            >
              Environmental Intelligence Platform
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

AuthWrapper.propTypes = { children: PropTypes.node };
