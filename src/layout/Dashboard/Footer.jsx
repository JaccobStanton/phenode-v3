// material-ui
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function Footer() {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      sx={{ color: "var(--blue-on-dark)", gap: 1.5, alignItems: 'center', justifyContent: 'space-between', p: '24px 16px 0px', mt: 'auto' }}
    >
      <Typography variant="caption">
        <strong>&copy; All rights reserved{' '}</strong>
        <Link href="https://agrelaeco.com/" sx={{color: "var(--green)"}}target="_blank" underline="hover">
          Agrela Ecosystems
        </Link>
      </Typography>
      <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="https://www.agrelaeco.com/about-us" sx={{color: "var(--blue-on-dark)"}} target="_blank" variant="caption" color="text.primary">
          <strong> About us</strong>
        </Link>
        <Link href="https://www.agrelaeco.com/privacy-policy" sx={{color: "var(--blue-on-dark)"}} target="_blank" variant="caption" color="text.primary">
         <strong>  Privacy</strong>
        </Link>
        <Link href="https://www.agrelaeco.com/terms-of-service"sx={{color: "var(--blue-on-dark)"}} target="_blank" variant="caption" color="text.primary">
          <strong>Terms</strong>
        </Link>
      </Stack>
    </Stack>
  );
}
