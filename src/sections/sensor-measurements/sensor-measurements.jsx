import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';

import MainCard from 'components/MainCard';
import rainSensorIcon from 'assets/sensor-measurements/Rain.svg';
import tempSensorIcon from 'assets/sensor-measurements/Temp.svg';
import windSensorIcon from 'assets/sensor-measurements/Wind.svg';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import ZoomInOutlined from '@ant-design/icons/ZoomInOutlined';

const glassSurfaceSx = {
  backgroundColor: 'var(--drf)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const chartSurfaceSx = {
  backgroundColor: '#07143f',
  backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
  border: '1px solid #0e346a'
};

const circleMetrics = [
  { id: 'metric-1', icon: tempSensorIcon, iconAlt: 'Temperature sensor icon', value: '54.41°F', label: 'Current Air Temperature' },
  { id: 'metric-2', icon: rainSensorIcon, iconAlt: 'Rain sensor icon', value: '0.53"', label: "Today's Rainfall" },
  {
    id: 'metric-3',
    icon: windSensorIcon,
    iconAlt: 'Wind sensor icon',
    direction: 'NW',
    value: '14.53mph',
    label: 'Current Windspeed',
    gustLabel: 'Gust:',
    gustValue: '22.41mph'
  }
];

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

const chartTimeLabels = [
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00'
];

const sensorMeasurementCharts = [
  { title: 'Temperature', lineColor: '#48f7f5', data: [48, 52, 58, 63, 67, 73, 78, 82, 79, 75, 81, 86, 83] },
  { title: 'Humidify', lineColor: '#c96cfc', data: [76, 73, 69, 64, 58, 53, 49, 45, 48, 54, 61, 67, 72] },
  { title: 'LUX', lineColor: '#f47568', data: [80, 130, 240, 410, 560, 700, 860, 980, 930, 840, 760, 640, 520] },
  { title: 'Soil Temperature', lineColor: '#940bf4', data: [42, 45, 49, 53, 57, 61, 65, 68, 66, 62, 59, 56, 54] },
  {
    title: 'Electrical Conductivity',
    lineColor: '#f40b8f',
    data: [0.72, 0.8, 0.94, 1.08, 1.2, 1.36, 1.52, 1.67, 1.61, 1.48, 1.34, 1.22, 1.1]
  },
  { title: 'Soil Moisture', lineColor: '#8539e0', data: [19, 22, 27, 33, 38, 45, 51, 57, 53, 47, 41, 36, 32] },
  {
    title: 'Battery Voltage (mV)',
    lineColor: '#0043c2',
    data: [4210, 4207, 4201, 4194, 4186, 4178, 4169, 4160, 4151, 4142, 4133, 4123, 4114]
  }
];

export default function SensorMeasurements() {
  const [timeRange, setTimeRange] = useState('Last 24 hours');
  const [chartLayout, setChartLayout] = useState('row');
  const chartCards = useMemo(() => sensorMeasurementCharts, []);

  return (
    <MainCard content={false} sx={{ width: '100%', minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
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
            Sensor Measurements
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              textAlign: { xs: 'left', md: 'right' },
              width: { xs: '100%', md: 'auto' },
              display: { xs: 'flex', md: 'block' },
              alignItems: { xs: 'center', md: 'unset' }
            }}
          >
            <Box component="span" sx={{ color: 'var(--blue)' }}>
              Last Measurements Taken:
            </Box>
            <Box component="span" sx={{ color: 'var(--green)', ml: { xs: 'auto', md: 1.5 }, display: 'inline-block', textAlign: 'right' }}>
              1/9/2026, 1:03PM
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            overflowX: { xs: 'auto', md: 'hidden' },
            pb: 1.25,
            mb: { xs: 2.5, sm: 3 },
            '&::-webkit-scrollbar': {
              height: '10px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 68, 143, 0.8)'
            }
          }}
        >
          <Stack direction="row" spacing={2.5} sx={{ minWidth: { xs: 930, md: 'auto' } }}>
            {circleMetrics.map((metric) => (
              <Box key={metric.id} sx={{ flex: 1, minWidth: 290, display: 'flex', justifyContent: 'center' }}>
                <Box
                  sx={{
                    width: { xs: 290, sm: 300, md: 315 },
                    height: { xs: 290, sm: 300, md: 315 },
                    borderRadius: '50%',
                    backgroundColor: '#00143642',
                    backgroundImage:
                      'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.06), rgba(255,255,255,0.01) 38%, transparent 55%)',
                    boxShadow: `
      inset -12px 0 18px rgba(0, 0, 0, 0.22),
      inset -24px 0 30px rgba(0, 20, 54, 0.28),
      inset 1px 4px 5px rgba(0, 0, 0, 0.2)
    `,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 1.1
                  }}
                >
                  <Box
                    component="img"
                    src={metric.icon}
                    alt={metric.iconAlt}
                    sx={{
                      width: metric.id === 'metric-1' ? { xs: 68, sm: 74, md: 80 } : { xs: 78, sm: 84, md: 90 },
                      height: metric.id === 'metric-1' ? { xs: 68, sm: 74, md: 80 } : { xs: 78, sm: 84, md: 90 },
                      border: 'none',
                      objectFit: 'contain'
                    }}
                  />
                  {metric.direction && (
                    <Typography variant="caption" sx={{ color: 'var(--blue)', fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1 }}>
                      {metric.direction}
                    </Typography>
                  )}
                  <Typography
                    variant="h1"
                    sx={{
                      color: 'var(--green)',
                      lineHeight: 1,
                      fontWeight: 300,
                      fontSize: { xs: '3.2rem', sm: '3.4rem', md: '3.7rem' },
                      textShadow: '0 1px 9px #1a75e0c9'
                    }}
                  >
                    {metric.value}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{ color: 'var(--blue)', textAlign: 'center', fontSize: { xs: '1rem', sm: '1.05rem' } }}
                  >
                    {metric.label}
                  </Typography>
                  {metric.gustLabel && metric.gustValue && (
                    <Typography variant="subtitle2" sx={{ textAlign: 'center', color: 'var(--blue)' }}>
                      <Box component="span">{metric.gustLabel}</Box>
                      <Box component="span" sx={{ color: 'var(--green)', ml: 0.75 }}>
                        {metric.gustValue}
                      </Box>
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            borderRadius: 1,
            p: { xs: 1.5, sm: 2 },
            ...reflectedCardChromeSx,
            backgroundColor: 'var(--drf)',
            backgroundImage: 'none',
            boxShadow: '0 14px 26px rgba(1, 13, 50, 1)'
          }}
        >
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
              Measurements Over Time
            </Typography>
            <Tooltip
              title="Orientation"
              arrow={false}
              slotProps={{
                tooltip: {
                  sx: {
                    backgroundColor: 'rgba(0, 20, 61, 0.96)',
                    color: 'var(--green)',
                    border: '1px solid var(--reflected-light)',
                    boxShadow: '0 11px 19px 1px #0000002e',
                    fontSize: '0.78rem'
                  }
                }
              }}
            >
              <IconButton
                aria-label="toggle sensor chart layout"
                onClick={() => setChartLayout((prev) => (prev === 'column' ? 'row' : 'column'))}
                sx={{ border: '1px solid var(--reflected-light)', color: 'var(--blue)' }}
              >
                <AppstoreOutlined />
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
              <Select
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value)}
                sx={{
                  color: 'var(--green)',
                  border: '1px solid var(--reflected-light)',
                  borderRadius: 1,
                  backgroundColor: 'var(--drf)',
                  boxShadow: '0 11px 19px 1px #0000002e',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-icon': { color: 'var(--blue)' }
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: 'rgba(0, 20, 61, 0.96)',
                      border: '1px solid var(--reflected-light)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      color: 'var(--green)'
                    }
                  }
                }}
                renderValue={(selected) => (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <ClockCircleOutlined style={{ color: 'var(--blue)' }} />
                    <Box component="span">{selected}</Box>
                  </Stack>
                )}
              >
                {timeRangeOptions.map((option) => (
                  <MenuItem
                    key={option}
                    value={option}
                    sx={{
                      color: 'var(--green)',
                      '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' },
                      '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.18)' }
                    }}
                  >
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton
              aria-label="refresh sensor charts"
              sx={{
                alignSelf: { xs: 'flex-start', sm: 'center' },
                border: '1px solid var(--reflected-light)',
                color: 'var(--purple)',
                backgroundColor: 'rgba(0, 20, 61, 0.72)',
                boxShadow: '0 11px 19px 1px #0000002e'
              }}
            >
              <ReloadOutlined />
            </IconButton>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns:
                chartLayout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr'
            }}
          >
            {chartCards.map((chart) => {
              const minVal = Math.min(...chart.data);
              const maxVal = Math.max(...chart.data);
              const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

              return (
                <Box
                  key={chart.title}
                  sx={{
                    borderRadius: 1,
                    p: { xs: 0.45, sm: 0.65 },
                    minHeight: { xs: 260, sm: 286 },
                    display: 'flex',
                    flexDirection: 'column',
                    ...reflectedCardChromeSx,
                    ...chartSurfaceSx,
                    border: '1px solid #0e346a'
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                    <Typography variant="subtitle1" sx={{ color: 'var(--blue)', ml: 1.25 }}>
                      {chart.title}
                    </Typography>
                    <IconButton aria-label={`zoom ${chart.title}`} size="small" sx={{ color: 'var(--blue)' }}>
                      <ZoomInOutlined />
                    </IconButton>
                  </Stack>

                  <LineChart
                    xAxis={[
                      {
                        id: `${chart.title}-x`,
                        scaleType: 'point',
                        data: chartTimeLabels,
                        tickLabelInterval: (_, index) => index === 0 || index === chartTimeLabels.length - 1 || index % 4 === 0,
                        tickLabelStyle: { fontSize: 11 }
                      }
                    ]}
                    yAxis={[
                      {
                        id: `${chart.title}-y`,
                        min: minVal - pad,
                        max: maxVal + pad,
                        width: 30,
                        valueFormatter: (value) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`)
                      }
                    ]}
                    series={[
                      {
                        id: `${chart.title}-line`,
                        data: chart.data,
                        color: chart.lineColor,
                        area: true,
                        showMark: false,
                        curve: 'linear'
                      }
                    ]}
                    grid={{ horizontal: true, vertical: true }}
                    height={chartLayout === 'row' ? 228 : 258}
                    margin={{ top: 2, right: 16, bottom: 10, left: 10 }}
                    hideLegend
                    sx={{
                      width: '100%',
                      overflow: 'visible',
                      '& .MuiChartsSurface-root': {
                        overflow: 'visible'
                      },
                      '& .MuiChartsGrid-line': {
                        stroke: 'var(--blue)',
                        strokeOpacity: 0.38,
                        strokeWidth: 0.65
                      },
                      '& .MuiLineElement-root': {
                        strokeWidth: 0.95,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        filter: `drop-shadow(0 0 8px ${chart.lineColor})`
                      },
                      '& .MuiAreaElement-root': {
                        fillOpacity: 0.16
                      },
                      '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
                        stroke: 'rgba(232, 232, 232, 0.45)'
                      },
                      '& .MuiChartsAxis-tickLabel': {
                        fill: 'var(--green)',
                        fontWeight: 600
                      },
                      '& .MuiChartsAxis-left .MuiChartsAxis-line, & .MuiChartsAxis-bottom .MuiChartsAxis-line': {
                        stroke: 'rgba(232, 232, 232, 0.55)'
                      },
                      background: 'transparent',
                      borderRadius: 1
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </MainCard>
  );
}
