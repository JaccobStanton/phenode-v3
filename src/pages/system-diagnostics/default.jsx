import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function SystemDiagnosticsDefault() {
  return (
    <MainCard>
      <Stack spacing={1}>
        <Typography variant="h4">System Diagnostics</Typography>
        <Typography color="text.secondary">Page scaffold is ready for System Diagnostics content.</Typography>
      </Stack>
    </MainCard>
  );
}
