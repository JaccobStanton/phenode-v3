import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

const glassSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const neonControlSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.72)',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  minHeight: 40,
  boxShadow: '0 11px 19px 1px #0000002e'
};

const measurementOptions = ['Air Temperature', 'Humidity', 'LUX', 'Soil Moisture', 'Soil Water Potential'];

const timeRangeOptions = [
  'Last 6 hours',
  'Last 12 hours',
  'Last 24 hours',
  'Last 5 days',
  'Last 10 days',
  'Last 30 days',
  'Last 3 months',
  'Last 6 months',
  'Last year',
  'Last 2 years'
];

const sensorOptions = [
  'WS-1234568',
  'WS-1234569',
  'WS-1234570',
  'WS-1234571',
  'SOIL-2031',
  'AIR-4412',
  'RAIN-7722',
  'WIND-9901'
];
const pheNodeOptions = ['PheNode 020', 'PheNode 017', 'PheNode 031', 'PheNode 105', 'PheNode 214'];

const linePalette = [
  { label: 'Cyan', line: '#48f7f5', glow: '#2b5bd5' },
  { label: 'Lavender', line: '#c96cfc', glow: '#940bf4' },
  { label: 'Peach', line: '#f47568', glow: '#940bf4' },
  { label: 'Gold', line: '#940bf4', glow: '#f40b8f' },
  { label: 'Green', line: '#f40b8f', glow: '#0cc55e' },
  { label: 'Pink', line: '#d900a5', glow: '#c50c70' },
  { label: 'Purple', line: '#8539e0', glow: '#6c00ff' },
  { label: 'Blue', line: '#0043c2', glow: '#0600ff' }
];

const mockSeriesPoints = [
  '0,70 8,68 16,67 24,66 32,60 40,56 48,50 56,44 64,40 72,38 80,34 88,18 100,16',
  '0,74 8,76 16,71 24,59 32,58 40,54 48,22 56,18 64,46 72,44 80,40 88,39 100,40',
  '0,68 8,70 16,72 24,64 32,44 40,36 48,34 56,30 64,24 72,20 80,23 88,24 100,26',
  '0,69 8,71 16,70 24,68 32,66 40,58 48,56 56,52 64,40 72,28 80,28 88,18 100,22',
  '0,72 8,73 16,72 24,68 32,66 40,60 48,56 56,52 64,42 72,30 80,24 88,26 100,24',
  '0,71 8,74 16,70 24,62 32,58 40,56 48,52 56,40 64,34 72,32 80,28 88,22 100,30',
  '0,76 8,72 16,66 24,58 32,57 40,52 48,36 56,20 64,16 72,14 80,10 88,12 100,30',
  '0,78 8,74 16,73 24,64 32,56 40,54 48,50 56,48 64,38 72,36 80,34 88,30 100,28'
];

const chartXGridTicks = [0, 8.33, 16.66, 25, 33.33, 41.66, 50, 58.33, 66.66, 75, 83.33, 91.66, 100];
const chartYGridTicks = [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
const GRAPH_HEIGHT = 420;
const measurementAxisUnits = {
  'Air Temperature': ['50', '40', '30', '20', '10'],
  Humidity: ['100', '80', '60', '40', '20', '0'],
  LUX: ['1200', '900', '700', '500', '300'],
  'Soil Moisture': ['100', '75', '60', '45', '30', '15'],
  'Soil Water Potential': ['-10', '-20', '-30', '-40', '-50', '-60']
};
const measurementLineOffset = {
  'Air Temperature': 0,
  Humidity: -8,
  LUX: -16,
  'Soil Moisture': -4,
  'Soil Water Potential': 10
};

export default function MultiSensorGraph() {
  const [selectedMeasurement, setSelectedMeasurement] = useState('Air Temperature');
  const [selectedPheNode, setSelectedPheNode] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('Last 6 hours');
  const [sensorToAdd, setSensorToAdd] = useState(sensorOptions[3]);
  const [activeSensors, setActiveSensors] = useState(sensorOptions.slice(0, 3));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const selectedMeasurementLabel = selectedMeasurement || 'Air Temperature';

  const sensorSeries = useMemo(
    () => {
      const currentOffset = measurementLineOffset[selectedMeasurementLabel] || 0;
      const applyMeasurementOffset = (pointString) =>
        pointString
          .split(' ')
          .map((pointPair) => {
            const [xVal, yVal] = pointPair.split(',').map(Number);
            const adjustedY = Math.max(6, Math.min(95, yVal + currentOffset));
            return `${xVal},${adjustedY}`;
          })
          .join(' ');

      return activeSensors.map((sensorName, index) => ({
        sensorName,
        ...linePalette[index % linePalette.length],
        points: applyMeasurementOffset(mockSeriesPoints[index % mockSeriesPoints.length])
      }));
    },
    [activeSensors, selectedMeasurementLabel]
  );

  const handleAddSensor = () => {
    if (!sensorToAdd || activeSensors.includes(sensorToAdd)) return;
    setActiveSensors((prev) => [...prev, sensorToAdd]);
  };

  const handleRemoveSensor = (sensorName) => {
    setActiveSensors((prev) => prev.filter((sensor) => sensor !== sensorName));
  };

  return (
    <MainCard content={false} sx={{ overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: '1px solid',
            borderBottomColor: 'var(--orange)',
            pb: 1.25
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            Multi Sensor Graphing
          </Typography>
          <Typography variant="subtitle1" sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Box component="span" sx={{ color: 'var(--blue)' }}>
              Last Measurements Taken:
            </Box>
            <Box component="span" sx={{ color: 'var(--green)', ml: 1.5, display: 'inline-block' }}>
              3/5/2026, 12:13:44 PM
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small">
              <Select
                value={selectedMeasurement}
                onChange={(event) => setSelectedMeasurement(event.target.value)}
                displayEmpty
                sx={{
                  ...neonControlSx,
                  color: selectedMeasurement ? 'var(--green)' : 'var(--med-grey)',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-icon': { color: 'var(--blue)' }
                }}
                renderValue={(selected) => selected || 'Select Sensor Measurement..'}
              >
                {measurementOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small">
              <Select
                value={selectedPheNode}
                onChange={(event) => setSelectedPheNode(event.target.value)}
                displayEmpty
                sx={{
                  ...neonControlSx,
                  color: selectedPheNode ? 'var(--green)' : 'var(--med-grey)',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-icon': { color: 'var(--blue)' }
                }}
                renderValue={(selected) => selected || 'Select PheNode..'}
              >
                {pheNodeOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <FormControl fullWidth size="small">
                <Select
                  value={sensorToAdd}
                  onChange={(event) => setSensorToAdd(event.target.value)}
                  sx={{ ...neonControlSx, color: 'var(--green)', '& .MuiOutlinedInput-notchedOutline': { border: 'none' }, '& .MuiSelect-icon': { color: 'var(--blue)' } }}
                >
                  {sensorOptions.map((sensor) => (
                    <MenuItem key={sensor} value={sensor}>
                      {sensor}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                onClick={handleAddSensor}
                variant="outlined"
                startIcon={<PlusOutlined />}
                sx={{
                  borderColor: 'rgba(37, 192, 233, 0.45)',
                  color: 'var(--green)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  minWidth: 128,
                  boxShadow: '0 11px 19px 1px #0000002e'
                }}
              >
                Add Sensor
              </Button>
            </Stack>
          </Grid>
        </Grid>

        <Card sx={{ p: { xs: 1.5, sm: 2 }, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} sx={{ alignItems: { xs: 'stretch', lg: 'center' } }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
              <Select
                value={selectedTimeRange}
                onChange={(event) => setSelectedTimeRange(event.target.value)}
                sx={{ ...neonControlSx, color: 'var(--green)', '& .MuiSelect-icon': { color: 'var(--blue)' }, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
                renderValue={(selected) => (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <ClockCircleOutlined style={{ color: 'var(--blue)' }} />
                    <Box component="span">{selected}</Box>
                  </Stack>
                )}
              >
                {timeRangeOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <IconButton
              aria-label="refresh multi sensor graph"
              sx={{
                border: '1px solid rgba(37, 192, 233, 0.45)',
                color: 'var(--purple)',
                backgroundColor: 'rgba(0, 20, 61, 0.72)',
                borderRadius: 0.6,
                boxShadow: '0 11px 19px 1px #0000002e'
              }}
            >
              <ReloadOutlined />
            </IconButton>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' }, borderColor: 'rgba(37, 192, 233, 0.45)' }} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
              <TextField
                size="small"
                type="text"
                placeholder="Start Time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                sx={{
                  minWidth: { sm: 160, md: 180 },
                  '& .MuiOutlinedInput-root': {
                    ...neonControlSx,
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                  },
                  '& .MuiInputBase-input': { color: 'var(--blue)', textAlign: 'center' }
                }}
              />
              <TextField
                size="small"
                type="text"
                placeholder="End Time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                sx={{
                  minWidth: { sm: 160, md: 180 },
                  '& .MuiOutlinedInput-root': {
                    ...neonControlSx,
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                  },
                  '& .MuiInputBase-input': { color: 'var(--blue)', textAlign: 'center' }
                }}
              />
              <Button
                variant="outlined"
                sx={{
                  borderColor: 'var(--orange)',
                  color: 'var(--green)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  minWidth: 140,
                  boxShadow: '0 11px 19px 1px #0000002e'
                }}
              >
                Generate Graph
              </Button>
            </Stack>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' }, borderColor: 'rgba(37, 192, 233, 0.45)' }} />

            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              sx={{
                borderColor: 'rgba(37, 192, 233, 0.45)',
                color: 'var(--green)',
                backgroundColor: 'rgba(0, 20, 61, 0.72)',
                ml: { lg: 'auto' },
                boxShadow: '0 11px 19px 1px #0000002e'
              }}
            >
              Download CSV
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 2 }}>
            {sensorSeries.map((series) => (
              <Chip
                key={series.sensorName}
                label={series.sensorName}
                onDelete={() => handleRemoveSensor(series.sensorName)}
                sx={{
                  height: 34,
                  borderRadius: 1,
                  px: 0.5,
                  minWidth: 128,
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(232, 232, 232, 0.06)',
                  border: '1px solid rgba(37, 192, 233, 0.25)',
                  color: series.line,
                  '& .MuiChip-label': {
                    px: 1.2,
                    fontSize: '0.82rem',
                    fontWeight: 600
                  },
                  '& .MuiChip-deleteIcon': {
                    color: 'var(--med-grey)',
                    fontSize: '1rem',
                    mr: 0.25,
                    '&:hover': { color: 'var(--green)' }
                  },
                  '&::before': {
                    content: '""',
                    width: 4,
                    height: 24,
                    borderRadius: 1,
                    backgroundColor: series.line,
                    boxShadow: `0 0 8px ${series.glow}`,
                    ml: 0.5
                  }
                }}
                variant="outlined"
              />
            ))}
            <Button
              onClick={handleAddSensor}
              variant="outlined"
              sx={{
                minWidth: 36,
                width: 36,
                height: 34,
                p: 0,
                borderStyle: 'dashed',
                borderColor: 'rgba(37, 192, 233, 0.35)',
                color: 'var(--med-grey)',
                backgroundColor: 'rgba(232, 232, 232, 0.03)',
                borderRadius: 1
              }}
            >
              <PlusOutlined />
            </Button>
          </Stack>

          <Box sx={{ mt: 2, borderRadius: 1, p: { xs: 1.25, sm: 1.75 }, backgroundColor: 'rgba(0, 18, 55, 0.6)', ...reflectedCardChromeSx }}>
            <Typography variant="h3" sx={{ color: 'var(--blue)', mb: 2, textAlign: 'center' }}>
              {selectedMeasurementLabel}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2 }}>
              <Stack sx={{ justifyContent: 'space-between', minHeight: GRAPH_HEIGHT }}>
                {(measurementAxisUnits[selectedMeasurementLabel] || measurementAxisUnits['Air Temperature']).map((unit) => (
                  <Typography key={`y-unit-${unit}`} variant="h5" sx={{ color: 'var(--green)' }}>
                    {unit}
                  </Typography>
                ))}
              </Stack>
              <Box>
                <Box component="svg" viewBox="0 0 100 100" preserveAspectRatio="none" sx={{ width: '100%', height: GRAPH_HEIGHT, display: 'block' }}>
                  {chartXGridTicks.map((tick) => (
                    <line key={`x-grid-${tick}`} x1={tick} y1="0" x2={tick} y2="100" stroke="#0f74d8" strokeOpacity="0.55" strokeWidth="0.35" />
                  ))}
                  {chartYGridTicks.map((tick) => (
                    <line key={`y-grid-${tick}`} x1="0" y1={tick} x2="100" y2={tick} stroke="#0f74d8" strokeOpacity="0.55" strokeWidth="0.35" />
                  ))}
                  {sensorSeries.map((series) => (
                    <polyline
                      key={`line-${series.sensorName}`}
                      fill="none"
                      stroke={series.line}
                      strokeWidth="1.05"
                      points={series.points}
                      style={{ filter: `drop-shadow(0 0 5px ${series.glow})` }}
                    />
                  ))}
                </Box>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1 }}>
                  {['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map((tick) => (
                    <Typography key={`x-unit-${tick}`} variant="h5" sx={{ color: 'var(--green)' }}>
                      {tick}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            </Box>

            <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, auto))',
                  gap: 1,
                  justifyItems: 'start'
                }}
              >
                {sensorSeries.map((series) => (
                  <Stack key={`legend-${series.sensorName}`} direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 132 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: series.line, boxShadow: `0 0 8px ${series.glow}` }} />
                    <Typography variant="caption" sx={{ color: series.line }}>
                      {series.sensorName}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            </Box>
          </Box>
        </Card>
      </Box>
    </MainCard>
  );
}
