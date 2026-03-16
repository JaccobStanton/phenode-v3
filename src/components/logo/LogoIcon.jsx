import Box from '@mui/material/Box';
import logo from 'assets/logo/logo_icon.svg';

// ==============================|| LOGO ICON ||============================== //

export default function LogoIcon() {
  return <Box component="img" src={logo} alt="PheNode logo" sx={{ width: 35, height: 35, objectFit: 'contain' }} />;
}
