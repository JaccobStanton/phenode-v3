// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';

// project imports
import Profile from './Profile';
import Notification from './Notification';
import MobileSection from './MobileSection';

// ==============================|| HEADER - CONTENT ||============================== //

export default function HeaderContent() {
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  return (
    <>
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ mr: 1.5 }}>
        <Notification />
      </Box>
      {!downLG && <Profile />}
      {downLG && <MobileSection />}
    </>
  );
}
