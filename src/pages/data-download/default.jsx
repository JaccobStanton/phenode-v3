import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function DataDownloadDefault() {
  return (
    <MainCard>
      <Stack spacing={1}>
        <Typography variant="h4">Data Download</Typography>
        <Typography color="text.secondary">Page scaffold is ready for Data Download content.</Typography>
      </Stack>
    </MainCard>
  );
}
