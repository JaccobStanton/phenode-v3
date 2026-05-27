// material-ui
import Box from '@mui/material/Box';

// project imports
// import NavCard from './NavCard';
import Navigation from './Navigation';
import DrawerUserMenu from '../DrawerUserMenu';
import SimpleBar from 'components/third-party/SimpleBar';

// ==============================|| DRAWER CONTENT ||============================== //
//
// Layout note: this component is the second child of the Drawer paper
// (after DrawerHeader). The Drawer paper itself is a `display: flex;
// flex-direction: column` container (MUI default), so we make this
// outer Box `flex: 1` to fill the remaining vertical space below the
// header. Inside:
//
//   - SimpleBar takes whatever space remains AFTER the user menu, so it
//     can scroll when the nav list is long. `flex: 1` + `minHeight: 0`
//     is the standard flex-column-scroll recipe — without `minHeight: 0`
//     the SimpleBar refuses to shrink past its content's min-content
//     and overflows the drawer instead of scrolling internally.
//   - DrawerUserMenu has its own `flexShrink: 0` so it stays anchored at
//     the bottom regardless of how tall the nav list grows.

export default function DrawerContent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SimpleBar
        sx={{
          flex: 1,
          minHeight: 0,
          '& .simplebar-content': { display: 'flex', flexDirection: 'column' }
        }}
      >
        <Navigation />
        {/* {drawerOpen && <NavCard />} */}
      </SimpleBar>
      <DrawerUserMenu />
    </Box>
  );
}
