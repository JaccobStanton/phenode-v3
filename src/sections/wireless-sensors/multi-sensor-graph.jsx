import { useMemo, useState } from 'react';
import dayjs from 'dayjs';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import MainCard from 'components/MainCard';

import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
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
  backgroundColor: 'var(--drf)',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  minHeight: 40,
  boxShadow: '0 11px 19px 1px #0000002e'
};

const neonMenuPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.96)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  backdropFilter: 'blur(6px)',
  color: 'var(--green)'
};

const neonMenuItemSx = {
  color: 'var(--green)',
  '&:hover': {
    backgroundColor: 'rgba(72, 247, 245, 0.12)'
  },
  '&.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.18)',
    color: 'var(--green)'
  },
  '&.Mui-selected:hover': {
    backgroundColor: 'rgba(72, 247, 245, 0.24)'
  }
};

const themedDropdownMenuProps = {
  PaperProps: {
    sx: neonMenuPaperSx
  },
  MenuListProps: {
    sx: {
      p: 0.5,
      '& .MuiMenuItem-root': {
        ...neonMenuItemSx
      }
    }
  }
};

const themedSelectSx = {
  ...neonControlSx,
  color: 'var(--green)',
  '& .MuiSelect-select': {
    color: 'var(--green)'
  },
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'var(--blue)' },
  '&:hover:not(.Mui-disabled)': {
    borderColor: 'var(--green)',
    '& .MuiSelect-icon': { color: 'var(--green)' }
  },
  '&.Mui-focused:not(.Mui-disabled)': {
    borderColor: 'var(--green)',
    '& .MuiSelect-icon': { color: 'var(--green)' }
  }
};

const dateTimePickerPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.94)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  color: 'var(--green)',
  backdropFilter: 'blur(6px)'
};

const dateTimePickerPopperSx = {
  '& .MuiPaper-root': dateTimePickerPaperSx,
  '& .MuiPickersLayout-root': {
    color: 'var(--blue)'
  },
  '& .MuiPickersDay-root': {
    color: 'var(--green)',
    borderRadius: 1,
    '&:hover': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)'
    }
  },
  '& .MuiPickersDay-root.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)'
  },
  '& .MuiDayCalendar-weekDayLabel, & .MuiPickersCalendarHeader-label': {
    color: 'var(--blue)',
    fontWeight: 600
  },
  '& .MuiPickersArrowSwitcher-button, & .MuiPickersCalendarHeader-switchViewButton': {
    color: 'var(--blue)'
  }
};

const dateTimePickerTextFieldSx = {
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    ...neonControlSx,
    '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
      border: 'none'
    },
    '&:hover:not(.Mui-disabled)': {
      borderColor: 'var(--green)'
    },
    '&.Mui-focused': {
      borderColor: 'var(--blue)'
    }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green) !important',
    WebkitTextFillColor: 'var(--green) !important',
    textAlign: 'center',
    '&::placeholder': {
      color: 'var(--green)',
      opacity: 1
    }
  },
  '& .MuiPickersInputBase-root, & .MuiPickersSectionList-root, & .MuiPickersSectionList-sectionContent, & .MuiPickersSectionList-section': {
    color: 'var(--green) !important',
    WebkitTextFillColor: 'var(--green) !important'
  },
  '& .MuiPickersSectionList-section.Mui-selected': {
    color: 'var(--green) !important',
    backgroundColor: 'rgba(72, 247, 245, 0.2)'
  },
  '& [data-placeholder="true"]': {
    color: 'var(--green) !important',
    opacity: 1
  },
  '& .MuiSvgIcon-root': {
    color: 'var(--blue)'
  }
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

const sensorOptions = ['WS-1234568', 'WS-1234569', 'WS-1234570', 'WS-1234571', 'WS-1234572', 'WS-1234573', 'WS-1234574', 'WS-1234575'];
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
  '0,86 8,82 16,78 24,72 32,66 40,58 48,46 56,34 64,26 72,32 80,44 88,58 100,68',
  '0,20 8,24 16,28 24,34 32,42 40,50 48,62 56,74 64,82 72,76 80,64 88,50 100,40',
  '0,64 8,60 16,54 24,48 32,36 40,28 48,22 56,18 64,26 72,38 80,52 88,66 100,78',
  '0,32 8,38 16,44 24,52 32,60 40,68 48,76 56,84 64,80 72,70 80,58 88,46 100,36',
  '0,48 8,46 16,42 24,38 32,34 40,30 48,26 56,22 64,28 72,40 80,54 88,68 100,80',
  '0,78 8,70 16,62 24,56 32,50 40,44 48,38 56,32 64,36 72,48 80,60 88,74 100,88',
  '0,40 8,44 16,50 24,58 32,66 40,74 48,82 56,88 64,84 72,72 80,58 88,44 100,30',
  '0,58 8,54 16,48 24,42 32,36 40,30 48,24 56,20 64,26 72,38 80,52 88,68 100,84'
];

const GRAPH_HEIGHT = 420;
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
const SELECT_ALL_LABEL = 'Select All';

function mapPointStringToSeriesValues(pointString, minValue, maxValue) {
  const valueRange = maxValue - minValue || 1;
  return pointString.split(' ').map((pointPair) => {
    const [, yVal] = pointPair.split(',').map(Number);
    const normalized = 1 - yVal / 100;
    return Number((minValue + normalized * valueRange).toFixed(2));
  });
}

function hexToRgba(hex, alpha) {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function SearchableMultiSelect({ placeholder, options, value, onChange, limitTags = 2 }) {
  const allOptions = useMemo(() => [SELECT_ALL_LABEL, ...options], [options]);

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      limitTags={limitTags}
      options={allOptions}
      value={value}
      onChange={(_, newValue) => {
        if (newValue.includes(SELECT_ALL_LABEL)) {
          const nextValue = value.length === options.length ? [] : options;
          onChange(nextValue);
          return;
        }
        onChange(newValue.filter((entry) => entry !== SELECT_ALL_LABEL));
      }}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox
            checked={selected || (value.length === options.length && option === SELECT_ALL_LABEL)}
            sx={{
              p: 0.5,
              mr: 1,
              color: 'var(--blue)',
              '&.Mui-checked': {
                color: 'var(--green)'
              },
              '&:hover': {
                backgroundColor: 'rgba(72, 247, 245, 0.12)'
              }
            }}
          />
          {option}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              ...neonControlSx,
              '&:hover:not(.Mui-disabled)': {
                borderColor: 'var(--green)'
              },
              '&.Mui-focused:not(.Mui-disabled)': {
                borderColor: 'var(--green)'
              },
              '& .MuiOutlinedInput-notchedOutline': {
                border: 'none'
              }
            },
            '& .MuiInputBase-input': {
              color: 'var(--green)',
              '&::placeholder': {
                color: 'var(--green)',
                opacity: 1
              }
            },
            '& .MuiChip-root': {
              color: 'var(--green)',
              borderColor: 'var(--box-outline-blue)',
              backgroundColor: 'rgba(0, 20, 61, 0.72)',
              borderRadius: 1,
              boxShadow: '0 11px 19px 1px #0000002e'
            },
            '& .MuiSvgIcon-root': {
              color: 'var(--blue)'
            },
            '& .MuiOutlinedInput-root:hover:not(.Mui-disabled) .MuiSvgIcon-root': {
              color: 'var(--green)'
            },
            '& .MuiOutlinedInput-root.Mui-focused:not(.Mui-disabled) .MuiSvgIcon-root': {
              color: 'var(--green)'
            }
          }}
        />
      )}
      slotProps={{
        paper: {
          sx: neonMenuPaperSx
        },
        listbox: {
          sx: {
            p: 0.5,
            '& .MuiAutocomplete-option': {
              ...neonMenuItemSx
            }
          }
        },
        chip: {
          size: 'small',
          variant: 'outlined'
        }
      }}
    />
  );
}

export default function MultiSensorGraph() {
  const [selectedMeasurement, setSelectedMeasurement] = useState('');
  const [selectedPheNodes, setSelectedPheNodes] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('Last 6 hours');
  const [activeSensors, setActiveSensors] = useState(sensorOptions.slice(0, 3));
  const [selectedAreaSensor, setSelectedAreaSensor] = useState(null);
  const [startTime, setStartTime] = useState(dayjs().subtract(2, 'hour'));
  const [endTime, setEndTime] = useState(dayjs());

  const selectedMeasurementLabel = selectedMeasurement || 'Air Temperature';
  const axisRange = useMemo(() => {
    const axisValues = (measurementAxisUnits[selectedMeasurementLabel] || [])
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value));

    if (axisValues.length === 0) {
      return { min: 0, max: 100 };
    }

    return {
      min: Math.min(...axisValues),
      max: Math.max(...axisValues)
    };
  }, [selectedMeasurementLabel]);

  const sensorSeries = useMemo(() => {
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
      seriesId: `sensor-${index}`,
      sensorName,
      ...linePalette[index % linePalette.length],
      points: applyMeasurementOffset(mockSeriesPoints[index % mockSeriesPoints.length]),
      values: mapPointStringToSeriesValues(
        applyMeasurementOffset(mockSeriesPoints[index % mockSeriesPoints.length]),
        axisRange.min,
        axisRange.max
      )
    }));
  }, [activeSensors, selectedMeasurementLabel, axisRange]);

  const chartSeries = useMemo(
    () =>
      sensorSeries.flatMap((series) => [
        {
          id: `${series.seriesId}-glow`,
          label: series.sensorName,
          data: series.values,
          color: hexToRgba(series.glow, 0.75),
          area: false,
          showMark: false,
          curve: 'linear'
        },
        {
          id: `${series.seriesId}-main`,
          label: series.sensorName,
          data: series.values,
          color: series.line,
          area: true,
          showMark: false,
          curve: 'linear'
        }
      ]),
    [sensorSeries]
  );

  const chartSeriesSx = useMemo(
    () =>
      sensorSeries.reduce((acc, series) => {
        acc[`& .MuiLineElement-series-${series.seriesId}-glow`] = {
          strokeWidth: 3.2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          opacity: 0.72
        };
        acc[`& .MuiLineElement-series-${series.seriesId}-main`] = {
          strokeWidth: 0.95,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          opacity: 1
        };
        acc[`& .MuiAreaElement-series-${series.seriesId}-main`] = {
          fillOpacity: selectedAreaSensor === series.sensorName ? 0.18 : 0
        };
        acc[`& .MuiAreaElement-series-${series.seriesId}-glow`] = {
          fillOpacity: 0
        };
        return acc;
      }, {}),
    [sensorSeries, selectedAreaSensor]
  );

  const handleSensorSelectionChange = (sensors) => {
    setActiveSensors(sensors);
    if (selectedAreaSensor && !sensors.includes(selectedAreaSensor)) {
      setSelectedAreaSensor(null);
    }
  };

  const handleRemoveSensor = (sensorName) => {
    setActiveSensors((prev) => prev.filter((sensor) => sensor !== sensorName));
    if (selectedAreaSensor === sensorName) {
      setSelectedAreaSensor(null);
    }
  };

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
            Multi Sensor Comparitive Overlay
          </Typography>
        </Stack>
      </Box>

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={0.65}>
                <Typography variant="subtitle2" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                  Measurement Selection
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedMeasurement}
                    onChange={(event) => setSelectedMeasurement(event.target.value)}
                    displayEmpty
                    MenuProps={themedDropdownMenuProps}
                    sx={themedSelectSx}
                    renderValue={(selected) => selected || 'Select Sensor Measurement..'}
                  >
                    {measurementOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={0.65}>
                <Typography variant="subtitle2" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                  PheNode Selection
                </Typography>
                <SearchableMultiSelect
                  placeholder="Select PheNode(s).."
                  options={pheNodeOptions}
                  value={selectedPheNodes}
                  onChange={setSelectedPheNodes}
                />
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={0.65}>
                <Typography variant="subtitle2" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                  Sensor Selection
                </Typography>
                <SearchableMultiSelect
                  placeholder="Select Wireless Sensor(s).."
                  options={sensorOptions}
                  value={activeSensors}
                  onChange={handleSensorSelectionChange}
                />
              </Stack>
            </Grid>
          </Grid>

          <Card
            sx={{
              p: { xs: 1.5, sm: 2 },
              ...reflectedCardChromeSx,
              backgroundColor: '#01113d',
              backgroundImage: 'linear-gradient(180deg, #01113d 0%, #01113d 100%)',
              boxShadow: '0 16px 28px rgba(1, 13, 50, 1)'
            }}
          >
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={1.25}
              sx={{
                alignItems: { xs: 'stretch', lg: 'center' },
                width: '100%'
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%', flex: { lg: 1 } }}>
                <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 220 }, flex: 1 }}>
                  <Select
                    value={selectedTimeRange}
                    onChange={(event) => setSelectedTimeRange(event.target.value)}
                    MenuProps={themedDropdownMenuProps}
                    sx={themedSelectSx}
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

                <Tooltip
                  title="Refresh"
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
                </Tooltip>
              </Stack>

              <Divider
                orientation="vertical"
                flexItem
                sx={{ display: { xs: 'none', lg: 'block' }, borderColor: 'rgba(37, 192, 233, 0.45)' }}
              />

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flex: { lg: 2 }, width: '100%' }}
              >
                <DateTimePicker
                  value={startTime}
                  onChange={(newValue) => setStartTime(newValue)}
                  ampm
                  slotProps={{
                    textField: {
                      size: 'small',
                      placeholder: 'Start Time',
                      sx: {
                        minWidth: { sm: 160, md: 180 },
                        flex: 1,
                        ...dateTimePickerTextFieldSx
                      }
                    },
                    popper: { sx: dateTimePickerPopperSx },
                    desktopPaper: { sx: dateTimePickerPaperSx },
                    mobilePaper: { sx: dateTimePickerPaperSx }
                  }}
                />
                <DateTimePicker
                  value={endTime}
                  onChange={(newValue) => setEndTime(newValue)}
                  ampm
                  slotProps={{
                    textField: {
                      size: 'small',
                      placeholder: 'End Time',
                      sx: {
                        minWidth: { sm: 160, md: 180 },
                        flex: 1,
                        ...dateTimePickerTextFieldSx
                      }
                    },
                    popper: { sx: dateTimePickerPopperSx },
                    desktopPaper: { sx: dateTimePickerPaperSx },
                    mobilePaper: { sx: dateTimePickerPaperSx }
                  }}
                />
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: 'var(--orange)',
                    color: 'var(--green)',
                    backgroundColor: 'rgba(0, 20, 61, 0.72)',
                    minWidth: { xs: '100%', sm: 140, lg: 180 },
                    boxShadow: '0 11px 19px 1px #0000002e',
                    transition: 'none',
                    '&:hover': {
                      borderColor: 'var(--green)',
                      boxShadow: '0 0 7px -5px var(--green)',
                      color: 'var(--green)',
                      textShadow: '0 1px 5px #007bff',
                      backgroundColor: 'rgba(72, 247, 245, 0.08)'
                    }
                  }}
                >
                  Generate Graph
                </Button>
              </Stack>

              <Divider
                orientation="vertical"
                flexItem
                sx={{ display: { xs: 'none', lg: 'block' }, borderColor: 'rgba(37, 192, 233, 0.45)' }}
              />

              <Button
                variant="outlined"
                startIcon={<DownloadOutlined />}
                sx={{
                  borderColor: 'rgba(37, 192, 233, 0.45)',
                  color: 'var(--green)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  ml: { lg: 'auto' },
                  minWidth: { xs: '100%', lg: 180 },
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
                  onClick={() => setSelectedAreaSensor((prev) => (prev === series.sensorName ? null : series.sensorName))}
                  sx={{
                    height: 34,
                    borderRadius: 1,
                    px: 0.5,
                    minWidth: 128,
                    justifyContent: 'space-between',
                    backgroundColor: selectedAreaSensor === series.sensorName ? 'rgba(72, 247, 245, 0.12)' : 'rgba(232, 232, 232, 0.06)',
                    border: selectedAreaSensor === series.sensorName ? `1px solid ${series.line}` : '1px solid rgba(37, 192, 233, 0.25)',
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
            </Stack>

            <Box
              sx={{
                mt: 2,
                borderRadius: 1,
                pt: { xs: 1.25, sm: 1.75 },
                pb: { xs: 1.25, sm: 1.75 },
                pl: { xs: 1.25, sm: 1.75 },
                pr: { xs: 1.25, sm: 1.75 },
                backgroundColor: '#07143f',
                backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
                border: '1px solid #0e346a',
                boxShadow: '0 11px 19px 1px #0000002e'
              }}
            >
              <Typography variant="h3" sx={{ color: 'var(--blue)', mb: 2, textAlign: 'center' }}>
                {selectedMeasurementLabel}
              </Typography>

              <LineChart
                xAxis={[
                  {
                    id: 'time-axis',
                    scaleType: 'point',
                    data: chartTimeLabels,
                    tickLabelStyle: { fill: 'var(--green)' }
                  }
                ]}
                yAxis={[
                  {
                    id: 'measurement-axis',
                    min: axisRange.min,
                    max: axisRange.max,
                    tickLabelStyle: { fill: 'var(--green)' }
                  }
                ]}
                series={chartSeries}
                grid={{ horizontal: true, vertical: true }}
                height={GRAPH_HEIGHT}
                margin={{ top: 10, right: 14, bottom: 34, left: 50 }}
                hideLegend
                sx={{
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
                    strokeWidth: 0.95
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
                  borderRadius: 1,
                  background: 'transparent',
                  ...chartSeriesSx
                }}
              />

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
      </LocalizationProvider>
    </MainCard>
  );
}
