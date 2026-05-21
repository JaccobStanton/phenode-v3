import { useEffect, useMemo, useRef, useState } from 'react';

// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';

// project imports
import AppBarStyled from './AppBarStyled';
import HeaderContent from './HeaderContent';
import IconButton from 'components/@extended/IconButton';

import { useDrawerToggle, useGetMenuMaster } from 'api/menu';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from 'config';

// assets
import AntIcon from 'components/AntIcon';
import MenuFoldOutlined from '@ant-design/icons-svg/lib/asn/MenuFoldOutlined';
import MenuUnfoldOutlined from '@ant-design/icons-svg/lib/asn/MenuUnfoldOutlined';

const SHELL_SURFACE_GRADIENT = 'radial-gradient(circle at 50% 15%, #00438f, #00102f)';
const NAVBAR_TOOLBAR_HEIGHT = { xs: 56, sm: 64 };

// Project-themed tooltip — same slotProps recipe used on the Profile menu
// and MobileSection 3-dot triggers (Profile/index.jsx:33-43,
// MobileSection.jsx:21-34). Kept inline to match the existing duplication
// pattern; if a fourth call site shows up, extract to a shared util.
const projectTooltipSlotProps = {
  tooltip: {
    sx: {
      backgroundColor: 'rgba(0, 20, 61, 0.96)',
      color: 'var(--green)',
      border: '1px solid var(--reflected-light)',
      boxShadow: '0 11px 19px 1px #0000002e',
      fontSize: '0.78rem'
    }
  }
};

// ==============================|| MAIN LAYOUT - HEADER ||============================== //

export default function Header() {
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;
  const toggleDrawer = useDrawerToggle();

  // header content
  const headerContent = useMemo(() => <HeaderContent />, []);

  // Tooltip label flips with drawer state — same string drives the visible
  // tooltip and the aria-label so screen readers and sighted users see the
  // same affordance ("Open Drawer" when closed, "Close Drawer" when open).
  const drawerToggleLabel = drawerOpen ? 'Close Drawer' : 'Open Drawer';

  // Tooltip-suppression window. Without this, the tooltip flickers to the
  // OPPOSITE label the instant the user clicks: the mouse is still over the
  // button, so MUI keeps the tooltip mounted, and the `title` prop updates
  // the moment `drawerOpen` flips. Setting `title=""` for ~300ms after a
  // click forces MUI to dismiss the tooltip; once the suppression releases,
  // the tooltip will fade back in (with the correct, new label) on the next
  // natural hover settle, OR stay closed if the user has moved the mouse
  // away during the transition.
  //
  // 300ms is a touch longer than MUI's default `transitions.duration.enteringScreen`
  // (~225ms), which is what the drawer + AppBar slide uses — so the icon has
  // finished swapping and the chrome has finished moving before the tooltip
  // is allowed back.
  const [tooltipSuppressed, setTooltipSuppressed] = useState(false);
  const suppressTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current);
    };
  }, []);

  const handleDrawerToggle = () => {
    setTooltipSuppressed(true);
    if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current);
    suppressTimeoutRef.current = setTimeout(() => setTooltipSuppressed(false), 300);
    toggleDrawer(!drawerOpen);
  };

  // common header
  const mainHeader = (
    <Toolbar sx={{ minHeight: { xs: NAVBAR_TOOLBAR_HEIGHT.xs, sm: NAVBAR_TOOLBAR_HEIGHT.sm } }}>
      <Tooltip
        title={tooltipSuppressed ? '' : drawerToggleLabel}
        arrow={false}
        slotProps={projectTooltipSlotProps}
        enterDelay={150}
        enterNextDelay={150}
      >
        <IconButton
          aria-label={drawerToggleLabel}
          onClick={handleDrawerToggle}
          edge="start"
          color="secondary"
          variant="light"
          sx={{
            ml: { xs: 0, lg: -2 },
            border: '1px solid var(--reflected-light)',
            color: 'var(--blue)',
            backgroundColor: 'rgba(0, 20, 61, 0.72)',
            boxShadow: '0 11px 19px 1px #0000002e',
            '&:hover': {
              borderColor: 'var(--green)',
              boxShadow: '0 0 7px -5px var(--green)',
              color: 'var(--green)',
              textShadow: '0 1px 5px #007bff',
              backgroundColor: 'rgba(72, 247, 245, 0.08)'
            }
          }}
        >
          {!drawerOpen ? <AntIcon icon={MenuUnfoldOutlined} /> : <AntIcon icon={MenuFoldOutlined} />}
        </IconButton>
      </Tooltip>
      {headerContent}
    </Toolbar>
  );

  // app-bar params
  const appBar = {
    position: 'fixed',
    color: 'inherit',
    elevation: 0,
    sx: {
      // 1.5px solid #054085 — opaque equivalent of var(--box-outline-blue)
      // (#054085 at 69% alpha), the standard app-chrome border used on the
      // Drawer and MainCard. Matches the Profile/MobileSection menu Paper
      // borders (Profile/index.jsx profileMenuPaperSx, MobileSection.jsx)
      // so the header's bottom edge and the dropdown's top edge read as
      // the same chrome family. Using the SOLID hex (not the alpha CSS var)
      // avoids the bg-dependent rendering issue — see the alpha-border
      // project memory.
      borderBottom: '1.5px solid #054085',
      backgroundColor: '#00102f',
      backgroundImage: SHELL_SURFACE_GRADIENT,
      backgroundSize: '100vw 100vh',
      backgroundPosition: 'center top',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      overflow: 'hidden',
      '& .MuiToolbar-root': {
        position: 'relative',
        zIndex: 1
      },
      zIndex: 1200,
      width: { xs: '100%', lg: drawerOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : `calc(100% - ${MINI_DRAWER_WIDTH}px)` }
    }
  };

  return (
    <>
      {!downLG ? (
        <AppBarStyled open={drawerOpen} {...appBar}>
          {mainHeader}
        </AppBarStyled>
      ) : (
        <AppBar {...appBar}>{mainHeader}</AppBar>
      )}
    </>
  );
}
