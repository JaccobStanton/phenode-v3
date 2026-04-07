import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project imports
import Drawer from './Drawer';
import Header from './Header';
import Footer from './Footer';
import Loader from 'components/Loader';
import Breadcrumbs from 'components/@extended/Breadcrumbs';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import useConfig from 'hooks/useConfig';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout() {
  const { menuMasterLoading } = useGetMenuMaster();
  const { state } = useConfig();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));
  const showPageTitleAndBreadcrumbs = state.showPageTitleAndBreadcrumbs ?? false;
  const MAIN_CARD_MIN_HEIGHT = 'calc(100vh - 206px)';

  // set media wise responsive drawer
  useEffect(() => {
    handlerDrawerOpen(!downXL);
  }, [downXL]);

  if (menuMasterLoading) return <Loader />;

  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      <Header />
      <Drawer />

      <Box component="main" sx={{ width: 'calc(100% - 260px)', flexGrow: 1, p: { xs: 2, sm: 3 }, backgroundColor: 'transparent' }}>
        <Toolbar sx={{ mt: 'inherit' }} />
        <Box
          sx={{
            ...{ px: 0 },
            position: 'relative',
            minHeight: 'calc(100vh - 110px)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {showPageTitleAndBreadcrumbs && <Breadcrumbs />}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              '& > .MuiCard-root': {
                minHeight: MAIN_CARD_MIN_HEIGHT
              }
            }}
          >
            <Outlet />
          </Box>
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}
