import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function SensorMeasurementsDefault() {
  return (
    <MainCard>
      <Stack spacing={1}>
        <Typography variant="h4">Sensor Measurements</Typography>
        <Typography color="text.secondary">Page scaffold is ready for Sensor Measurements content.</Typography>
      </Stack>
    </MainCard>
  );
}
