import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function ImagingDefault() {
  return (
    <MainCard>
      <Stack spacing={1}>
        <Typography variant="h4">Imaging</Typography>
        <Typography color="text.secondary">Page scaffold is ready for Imaging content.</Typography>
      </Stack>
    </MainCard>
  );
}
