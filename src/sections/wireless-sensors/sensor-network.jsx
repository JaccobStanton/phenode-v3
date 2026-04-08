import { useMemo, useState } from 'react';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';

import MainCard from 'components/MainCard';
import MapView from 'sections/wireless-sensors/map-view';
import wirelessSensorsDiagram from 'assets/diagrams/Wireless-Sensors-v4.svg';
import mapIconActive from 'assets/toggle_buttons/Map_Icon_Active.svg';
import mapIconInactive from 'assets/toggle_buttons/Map_Icon_Inactive.svg';
import soilProbeIconActive from 'assets/toggle_buttons/Soil_Probe_Icon_Active.svg';
import soilProbeIconInactive from 'assets/toggle_buttons/Soil_Probe_Icon_Inactive.svg';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import ZoomInOutlined from '@ant-design/icons/ZoomInOutlined';

const glassSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const drfSurfaceSx = {
  backgroundColor: 'var(--drf)',
  backgroundImage: 'none'
};

const chartSurfaceSx = {
  backgroundColor: 'rgba(0, 18, 55, 0.6)'
};

const neonControlSx = {
  backgroundColor: 'var(--drf)',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  minHeight: 40,
  boxShadow: '0 11px 19px 1px #0000002e'
};

const drawerNavButtonSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
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
  '&.Mui-focused': {
    backgroundColor: 'rgba(72, 247, 245, 0.12)'
  }
};

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

const soilProbeReadings = {
  'probe-1': [
    { label: 'Soil Temperature', value: '61.84 °F' },
    { label: 'Soil Moisture', value: '42.5 %' },
    { label: 'Soil Salinity', value: '1.83 kPa' }
  ],
  'probe-2': [
    { label: 'Soil Temperature', value: '59.12 °F' },
    { label: 'Soil Moisture', value: '39.8 %' },
    { label: 'Soil Salinity', value: '2.07 kPa' }
  ]
};

const sensorSelectionOptions = ['WS-1234568', 'WS-1234569', 'WS-1234570', 'WS-1234571', 'SOIL-2031', 'AIR-4412', 'RAIN-7722', 'WIND-9901'];
const pheNodeSelectionOptions = ['PheNode 020', 'PheNode 017', 'PheNode 031', 'PheNode 105', 'PheNode 214'];

export default function SensorNetwork() {
  const [timeRange, setTimeRange] = useState('Last 24 hours');
  const [chartLayout, setChartLayout] = useState('row');
  const [isMapView, setIsMapView] = useState(false);
  const [selectedPheNode, setSelectedPheNode] = useState(null);
  const [selectedNetworkSensor, setSelectedNetworkSensor] = useState(null);
  const [infoCardMode, setInfoCardMode] = useState('sensor');
  const [selectedSoilProbe, setSelectedSoilProbe] = useState('probe-1');
  const [isMapToggleHovered, setIsMapToggleHovered] = useState(false);
  const [isInfoToggleHovered, setIsInfoToggleHovered] = useState(false);
  const chartCards = useMemo(() => sensorMeasurementCharts, []);
  const isSoilDataMode = infoCardMode === 'soil';
  const infoCardTitle = isSoilDataMode ? 'Soil Data' : 'Sensor Information';
  const infoCardTooltipTitle = isSoilDataMode ? 'Sensor Info.' : 'Soil Data';
  const infoCardToggleIcon = isInfoToggleHovered ? soilProbeIconActive : soilProbeIconInactive;
  const mapToggleIcon = isMapView
    ? isMapToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive
    : isMapToggleHovered
      ? mapIconActive
      : mapIconInactive;
  const activeSoilReadings = soilProbeReadings[selectedSoilProbe];
  const diagramWidthSx = { xs: '92%', sm: '88%', md: '90%', lg: '92%' };
  const sectionTitle = isMapView ? 'Sensor Overview' : 'Wireless Sensor Measurements';
  const mapToggleTooltip = isMapView ? 'Sensor Overview' : 'Map View';

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
            {sectionTitle}
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

      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2.5, gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Autocomplete
              options={pheNodeSelectionOptions}
              value={selectedPheNode}
              onChange={(_, newValue) => setSelectedPheNode(newValue)}
              sx={{ width: { xs: 170, sm: 220 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select PheNode..."
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      ...neonControlSx,
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none'
                      },
                      '&.Mui-focused': {
                        borderColor: 'var(--blue)'
                      }
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--green)',
                      '&::placeholder': {
                        color: 'var(--green)',
                        opacity: 1
                      }
                    },
                    '& .MuiSvgIcon-root': {
                      color: 'var(--blue)'
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
                }
              }}
            />

            <Autocomplete
              options={sensorSelectionOptions}
              value={selectedNetworkSensor}
              onChange={(_, newValue) => setSelectedNetworkSensor(newValue)}
              sx={{ width: { xs: 190, sm: 250 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select Wireless Sensor..."
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      ...neonControlSx,
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none'
                      },
                      '&.Mui-focused': {
                        borderColor: 'var(--blue)'
                      }
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--green)',
                      '&::placeholder': {
                        color: 'var(--green)',
                        opacity: 1
                      }
                    },
                    '& .MuiSvgIcon-root': {
                      color: 'var(--blue)'
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
                }
              }}
            />
          </Stack>

          <Tooltip
            title={mapToggleTooltip}
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
              aria-label={isMapView ? 'sensor overview' : 'map view'}
              onClick={() => setIsMapView((prev) => !prev)}
              onMouseEnter={() => setIsMapToggleHovered(true)}
              onMouseLeave={() => setIsMapToggleHovered(false)}
              onFocus={() => setIsMapToggleHovered(true)}
              onBlur={() => setIsMapToggleHovered(false)}
              sx={{
                border: '1px solid var(--reflected-light)',
                color: 'var(--blue)',
                ...drawerNavButtonSurfaceSx,
                boxShadow: '0 11px 19px 1px #0000002e'
              }}
            >
              <Box component="img" src={mapToggleIcon} alt="" sx={{ width: 21, height: 21 }} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
          {isMapView ? (
            <Grid size={{ xs: 12 }}>
              <MapView
                infoCardMode={infoCardMode}
                setInfoCardMode={setInfoCardMode}
                selectedSoilProbe={selectedSoilProbe}
                setSelectedSoilProbe={setSelectedSoilProbe}
              />
            </Grid>
          ) : (
            <>
              <Grid size={{ xs: 12, lg: 8 }} sx={{ display: 'flex' }}>
                <Box
                  sx={{
                    borderRadius: 1,
                    p: { xs: 1.5, sm: 2 },
                    width: '100%',
                    height: '100%',
                    ...drfSurfaceSx,
                    ...reflectedCardChromeSx
                  }}
                >
                  <Box sx={{ width: diagramWidthSx, mx: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Typography variant="body1" sx={{ width: '100%', textAlign: 'center', fontWeight: 600, pt: { xs: 0.25, sm: 0.5 } }}>
                      <Box component="span" sx={{ color: 'var(--blue)' }}>
                        [ MAC ADDR:
                      </Box>{' '}
                      <Box component="span" sx={{ color: 'var(--green)', textShadow: '0 1px 9px #1a75e0c9' }}>
                        E3:45:2C:89:B6
                      </Box>{' '}
                      <Box component="span" sx={{ color: 'var(--blue)' }}>
                        ]
                      </Box>
                    </Typography>

                    <Box
                      sx={{
                        mt: { xs: 2.5, lg: 'auto' },
                        pb: 0,
                        lineHeight: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center'
                      }}
                    >
                      <Box
                        component="img"
                        src={wirelessSensorsDiagram}
                        alt="Wireless sensor network diagram"
	                        sx={{
	                          width: '100%',
	                          maxHeight: { xs: 250, sm: 330, md: 400, lg: 430 },
	                          objectFit: 'contain',
	                          display: 'block',
                          transform: { xs: 'translateY(8px)', sm: 'translateY(10px)' },
                          mb: 0,
                          pb: 0
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, lg: 4 }} sx={{ display: 'flex' }}>
                <Stack spacing={2.5} sx={{ width: '100%', height: '100%' }}>
                  <Box
                    sx={{
                      borderRadius: 1,
                      p: { xs: 1.5, sm: 2 },
                      ...drfSurfaceSx,
                      ...reflectedCardChromeSx,
                      '& .info-card-green-text': {
                        color: 'var(--green)',
                        textShadow: '0 1px 9px #1a75e0c9'
                      }
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h5" sx={{ color: '#646cff' }}>
                        {infoCardTitle}
                      </Typography>
                      <Tooltip
                        title={infoCardTooltipTitle}
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
                          aria-label={isSoilDataMode ? 'show sensor info' : 'show soil data'}
                          onClick={() => setInfoCardMode((prev) => (prev === 'soil' ? 'sensor' : 'soil'))}
                          onMouseEnter={() => setIsInfoToggleHovered(true)}
                          onMouseLeave={() => setIsInfoToggleHovered(false)}
                          onFocus={() => setIsInfoToggleHovered(true)}
                          onBlur={() => setIsInfoToggleHovered(false)}
                          sx={{
                            border: '1px solid var(--reflected-light)',
                            color: 'var(--blue)',
                            ...drawerNavButtonSurfaceSx,
                            boxShadow: '0 11px 19px 1px #0000002e'
                          }}
                        >
                          <Box component="img" src={infoCardToggleIcon} alt="" sx={{ width: 22, height: 22 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    {isSoilDataMode ? (
                      <>
                        <ToggleButtonGroup
                          exclusive
                          value={selectedSoilProbe}
                          onChange={(_, nextValue) => {
                            if (nextValue) setSelectedSoilProbe(nextValue);
                          }}
                          size="small"
                          sx={{
                            mb: 2,
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            '& .MuiToggleButtonGroup-grouped': {
                              border: '1px solid var(--reflected-light) !important',
                              borderRadius: '6px !important',
                              color: 'var(--blue)',
                              backgroundColor: 'rgba(0, 20, 61, 0.72)',
                              textTransform: 'none',
                              fontWeight: 600
                            },
                            '& .MuiToggleButtonGroup-grouped:first-of-type': {
                              borderTopRightRadius: '0 !important',
                              borderBottomRightRadius: '0 !important'
                            },
                            '& .MuiToggleButtonGroup-grouped:last-of-type': {
                              borderTopLeftRadius: '0 !important',
                              borderBottomLeftRadius: '0 !important'
                            },
                            '& .Mui-selected': {
                              color: 'var(--green) !important',
                              backgroundColor: 'rgba(72, 247, 245, 0.12) !important'
                            }
                          }}
                        >
                          <ToggleButton value="probe-1">Soil Probe 1</ToggleButton>
                          <ToggleButton value="probe-2">Soil Probe 2</ToggleButton>
                        </ToggleButtonGroup>

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                          {activeSoilReadings.map((reading) => (
                            <Box key={reading.label} sx={{ display: 'contents' }}>
                              <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                                {reading.label}
                              </Typography>
                              <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                                {reading.value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </>
                    ) : (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          Sensor ID:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          WS-1234568
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          GPS:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          32 42 23 43, 92 89
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          Altitude:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          793.95ft
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          Battery:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          87.52%
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          Probes Connected:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          2
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, flexGrow: 1, ...drfSurfaceSx, ...reflectedCardChromeSx }}>
                    <Stack sx={{ height: '100%', justifyContent: 'center', alignItems: 'center' }} spacing={2}>
                      <Typography variant="h5" sx={{ textAlign: 'center', color: 'var(--blue)' }}>
                        Rename this Sensor:
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Enter new sensor name"
                        sx={{
                          maxWidth: 320,
                          '& .MuiOutlinedInput-root': {
                            minHeight: 40,
                            borderStyle: 'none none solid',
                            borderWidth: '1px 1px 2px',
                            borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
                            color: 'var(--blue)',
                            backgroundColor: '#00143642',
                            boxShadow: 'inset 1px 4px 5px #0003',
                            borderRadius: 1,
                            '& .MuiOutlinedInput-notchedOutline': {
                              border: 'none'
                            }
                          },
                          '& .MuiInputBase-input': {
                            color: 'var(--blue)',
                            textAlign: 'center',
                            '&::placeholder': {
                              color: 'var(--blue)',
                              opacity: 1
                            }
                          }
                        }}
                        inputProps={{ 'aria-label': 'Rename sensor input' }}
                      />
                      <Button
                        variant="outlined"
                        sx={{
                          minWidth: 140,
                          color: 'var(--green)',
                          borderColor: 'var(--orange)',
                          '&:hover': {
                            borderColor: 'var(--green)',
                            boxShadow: '0 0 7px -5px var(--green)',
                            color: 'var(--green)',
                            textShadow: '0 1px 5px #007bff',
                            backgroundColor: 'rgba(72, 247, 245, 0.08)'
                          }
                        }}
                      >
                        Rename
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </Grid>
            </>
          )}

          <Grid size={{ xs: 12 }}>
            <Box
              sx={{
                borderRadius: 1,
                p: { xs: 1.5, sm: 2 },
                ...drfSurfaceSx,
                ...reflectedCardChromeSx
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
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
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
	                        <Box component="span" sx={{ color: 'var(--green)' }}>
	                          {selected}
	                        </Box>
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
                        ...chartSurfaceSx,
                        ...reflectedCardChromeSx
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
                            tickLabelStyle: { fontSize: 11, fill: 'var(--green)' }
                          }
                        ]}
                        yAxis={[
                          {
                            id: `${chart.title}-y`,
                            min: minVal - pad,
                            max: maxVal + pad,
                            width: 30,
                            tickLabelStyle: { fill: 'var(--green)' },
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
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
