// material-ui
import { styled } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';

// project imports
import { DRAWER_WIDTH } from 'config';

const SHELL_SURFACE_GRADIENT = 'radial-gradient(circle at 50% 15%, #00438f, #00102f)';

const openedMixin = (theme) => ({
  width: DRAWER_WIDTH,
  borderRight: '1.5px solid var(--box-outline-blue)',
  backgroundColor: '#00102f',
  backgroundImage: SHELL_SURFACE_GRADIENT,
  backgroundSize: '100vw 100vh',
  backgroundPosition: 'center top',
  backgroundRepeat: 'no-repeat',
  backgroundAttachment: 'fixed',

  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen
  }),

  overflowX: 'hidden',
  boxShadow: 'none'
});

const closedMixin = (theme) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  }),

  overflowX: 'hidden',
  width: theme.spacing(7.5),
  borderRight: '1.5px solid var(--box-outline-blue)',
  backgroundColor: '#00102f',
  backgroundImage: SHELL_SURFACE_GRADIENT,
  backgroundSize: '100vw 100vh',
  backgroundPosition: 'center top',
  backgroundRepeat: 'no-repeat',
  backgroundAttachment: 'fixed',
  boxShadow: theme.vars.customShadows.z1
});

// ==============================|| DRAWER - MINI STYLED ||============================== //

const MiniDrawerStyled = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  width: DRAWER_WIDTH,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open
    ? {
        ...openedMixin(theme),
        '& .MuiDrawer-paper': openedMixin(theme)
      }
    : {
        ...closedMixin(theme),
        '& .MuiDrawer-paper': closedMixin(theme)
      })
}));

export default MiniDrawerStyled;
