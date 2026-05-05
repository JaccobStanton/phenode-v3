import { Component } from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// =============================================================================
// ErrorBoundary — class component that catches render-time errors in its
// subtree and renders a fallback UI instead of unmounting the whole shell.
// =============================================================================
//
// Why a class component instead of `react-error-boundary`:
//   We don't have that library installed and the boundary is small enough
//   that hand-rolling is a smaller change than adding a dep. React's
//   built-in error-boundary contract is class-only (getDerivedStateFromError
//   and componentDidCatch are static/instance class lifecycle methods —
//   there's no hook equivalent).
//
// Where this is mounted:
//   layout/Dashboard/index.jsx wraps `<Outlet />` in this boundary, with
//   `key={location.pathname}` so navigating to a different page resets
//   the boundary state. Without that key, an error on /fleet-overview
//   would persist in the boundary state when the user clicks /imaging
//   in the drawer — they'd see the error fallback on every page until
//   reload.
//
// What this catches and what it doesn't:
//   - CATCHES: render-time errors thrown synchronously from descendant
//     components, errors thrown during lifecycle methods.
//   - DOESN'T CATCH: errors inside event handlers (onClick, onChange),
//     async errors (Promise rejections, setTimeout callbacks), errors
//     from server-side rendering, errors thrown by the boundary itself.
//
// SWR's thrown errors are in the "render-time" bucket because SWR
// surfaces errors via the `error` field — components can throw if they
// don't gracefully handle that. The fleet view DOES handle it
// (FleetOverviewView shows an error state), so this boundary is mostly
// a safety net for everything we forget.

const fallbackContainerSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 'calc(100vh - 280px)',
  px: 2
};

const fallbackCardSx = {
  width: '100%',
  maxWidth: 520,
  px: 4,
  py: 5,
  borderRadius: 1,
  textAlign: 'center',
  backgroundColor: 'rgba(12, 35, 80, 0.359)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const reloadButtonSx = {
  height: 44,
  px: 3,
  borderRadius: 1,
  cursor: 'pointer',
  color: 'var(--blue)',
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
    backgroundColor: 'rgba(72, 247, 245, 0.08)'
  }
};

function DefaultFallback({ error }) {
  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <Box sx={fallbackContainerSx}>
      <Box sx={fallbackCardSx}>
        <Stack spacing={2.5} alignItems="center">
          <Typography variant="h4" sx={{ color: 'var(--orange)', fontSize: '1.05rem', fontWeight: 600 }}>
            Something went wrong
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.78)', fontSize: '0.85rem' }}>
            This page hit an unexpected error. The rest of the app should still be navigable from the drawer.
          </Typography>
          {error?.message && (
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', fontStyle: 'italic' }}>
              {error.message}
            </Typography>
          )}
          <Box component="button" type="button" onClick={handleReload} sx={reloadButtonSx}>
            Reload page
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

DefaultFallback.propTypes = { error: PropTypes.object };

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    // Triggered during the "render" phase. Update state synchronously
    // so the next render shows the fallback.
    return { error };
  }

  componentDidCatch(error, info) {
    // Triggered during the "commit" phase. Log to console for now;
    // when Sentry (or equivalent) is wired up this is where the
    // capture call would go.
    console.error('[ErrorBoundary] caught:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? <DefaultFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  fallback: PropTypes.node
};
