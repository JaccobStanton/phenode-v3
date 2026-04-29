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

import MainCard from 'components/MainCard';
import MapView from 'sections/wireless-sensors/map-view';
import MeasurementsChartGrid from 'sections/wireless-sensors/MeasurementsChartGrid';
import useInfoCard from 'hooks/useInfoCard';
import wirelessSensorsDiagram from 'assets/diagrams/Wireless-Sensors-v4.svg';
import wsFleetIcon from 'assets/drawer-icons/WS_Fleet.svg';
import wsFleetIconActive from 'assets/drawer-icons/WS_Fleet_Active.svg';
import mapIconActive from 'assets/toggle_buttons/Map_Icon_Active.svg';
import mapIconInactive from 'assets/toggle_buttons/Map_Icon_Inactive.svg';
import soilProbeIconActive from 'assets/toggle_buttons/Soil_Probe_Icon_Active.svg';
import soilProbeIconInactive from 'assets/toggle_buttons/Soil_Probe_Icon_Inactive.svg';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

import {
  glassSurfaceSx,
  reflectedCardChromeSx,
  drfSurfaceSx,
  neonControlSx,
  drawerNavButtonSurfaceSx,
  orientationButtonSx,
  neonMenuPaperSx,
  neonMenuItemSx,
  tooltipSlotProps,
  neonSelectMenuPaperProps
} from 'themes/sx-tokens';

import { timeRangeOptions, chartTimeLabels } from 'data/mocks/time-ranges';
import { sensorMeasurementCharts, soilProbeReadings } from 'data/mocks/sensor-measurements';
import { pheNodeSelectionOptions, sensorSelectionOptions } from 'data/mocks/phenode-options';

// Hoisted to module scope so this object literal isn't recreated every render.
const diagramWidthSx = { xs: '92%', sm: '88%', md: '90%', lg: '92%' };

export default function SensorNetwork() {
  const [timeRange, setTimeRange] = useState('Last 24 hours');
  const [chartLayout, setChartLayout] = useState('row');
  const [isMapView, setIsMapView] = useState(false);
  const [selectedPheNode, setSelectedPheNode] = useState(null);
  const [selectedNetworkSensor, setSelectedNetworkSensor] = useState(null);
  // Info-card state (mode + soil-probe selection) lives in a hook so we can
  // pass it directly to MapView without prop-drilling four setters.
  const { infoCardMode, setInfoCardMode, selectedSoilProbe, setSelectedSoilProbe, isSoilDataMode } = useInfoCard();
  const [isMapToggleHovered, setIsMapToggleHovered] = useState(false);
  const [isInfoToggleHovered, setIsInfoToggleHovered] = useState(false);
  const chartCards = useMemo(() => sensorMeasurementCharts, []);
  const infoCardTitle = isSoilDataMode ? 'Soil Data' : 'Sensor Information';
  const infoCardTooltipTitle = isSoilDataMode ? 'Sensor Info.' : 'Soil Data';
  const infoCardToggleIcon = isSoilDataMode
    ? isInfoToggleHovered
      ? wsFleetIconActive
      : wsFleetIcon
    : isInfoToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive;
  const mapToggleIcon = isMapView
    ? isMapToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive
    : isMapToggleHovered
      ? mapIconActive
      : mapIconInactive;
  const activeSoilReadings = soilProbeReadings[selectedSoilProbe];
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

          <Tooltip title={mapToggleTooltip} arrow={false} slotProps={tooltipSlotProps}>
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
                      <Tooltip title={infoCardTooltipTitle} arrow={false} slotProps={tooltipSlotProps}>
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
                            '&:hover:not(.Mui-disabled)': {
                              borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light) !important',
                              boxShadow: 'inset 1px 4px 5px #0003'
                            },
                            '&.Mui-focused': {
                              borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light) !important',
                              boxShadow: 'inset 1px 4px 5px #0003'
                            },
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
                <Tooltip title="Orientation" arrow={false} slotProps={tooltipSlotProps}>
                  <IconButton
                    aria-label="toggle sensor chart layout"
                    onClick={() => setChartLayout((prev) => (prev === 'column' ? 'row' : 'column'))}
                    sx={orientationButtonSx}
                  >
                    <AppstoreOutlined />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 2 }}>
                <FormControl
                  size="small"
                  sx={{ minWidth: { xs: 0, sm: 220 }, width: { xs: '100%', sm: 220 }, flex: { xs: 1, sm: '0 0 auto' } }}
                >
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
                    MenuProps={{ PaperProps: neonSelectMenuPaperProps }}
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
                <Tooltip title="Refresh" arrow={false} slotProps={tooltipSlotProps}>
                  <IconButton
                    aria-label="refresh sensor charts"
                    sx={{
                      border: '1px solid var(--reflected-light)',
                      color: 'var(--purple)',
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      '&:hover': {
                        borderColor: 'var(--green)',
                        boxShadow: '0 0 7px -5px var(--green)',
                        color: 'var(--green)',
                        textShadow: '0 1px 5px #007bff',
                        backgroundColor: 'rgba(72, 247, 245, 0.08)'
                      }
                    }}
                  >
                    <ReloadOutlined />
                  </IconButton>
                </Tooltip>
              </Stack>

              <MeasurementsChartGrid charts={chartCards} timeLabels={chartTimeLabels} layout={chartLayout} />
            </Box>
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
