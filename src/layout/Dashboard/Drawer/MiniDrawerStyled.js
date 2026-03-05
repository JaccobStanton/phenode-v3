// material-ui
import { styled } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';

// project imports
import { DRAWER_WIDTH } from 'config';

const SHELL_BORDER_COLOR = 'rgb(64, 102, 140)';
const SHELL_GLASS_FILL = 'linear-gradient(rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.06))';

const openedMixin = (theme) => ({
  width: DRAWER_WIDTH,
  borderRight: '1px solid',
  borderRightColor: SHELL_BORDER_COLOR,
  backgroundColor: 'rgba(0, 17, 48, 0.06)',
  backgroundImage: SHELL_GLASS_FILL,

  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen
  }),

  overflowX: 'hidden',
  boxShadow: 'none',
});

const closedMixin = (theme) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  }),

  overflowX: 'hidden',
  width: theme.spacing(7.5),
  borderRight: '1px solid',
  borderRightColor: SHELL_BORDER_COLOR,
  backgroundColor: 'rgba(0, 17, 48, 0.06)',
  backgroundImage: SHELL_GLASS_FILL,
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
