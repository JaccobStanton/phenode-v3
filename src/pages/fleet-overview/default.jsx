import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function FleetOverviewDefault() {
  return (
    <MainCard>
      <Stack spacing={1}>
        <Typography variant="h4">Fleet Overview</Typography>
        <Typography color="text.secondary">Page scaffold is ready for Fleet Overview content.</Typography>
      </Stack>
    </MainCard>
  );
}
