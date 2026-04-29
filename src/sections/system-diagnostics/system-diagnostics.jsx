import { useState } from 'react';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
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

import MainCard from 'components/MainCard';
import phenodeDiagram from 'assets/diagrams/Phenode-Diagram.svg';
import wirelessSensorsDiagram from 'assets/diagrams/Wireless-Sensors.svg';

import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import ZoomInOutlined from '@ant-design/icons/ZoomInOutlined';

import {
  glassSurfaceSx,
  reflectedCardChromeSx,
  drfSurfaceSx,
  neonControlSx,
  neonMenuPaperSx,
  neonMenuItemSx,
  orientationButtonSx,
  tooltipSlotProps,
  neonSelectMenuPaperProps
} from 'themes/sx-tokens';
import { timeRangeOptions } from 'data/mocks/time-ranges';
import { pheNodeSelectionOptions } from 'data/mocks/phenode-options';

// System diagnostics uses a slightly different chart surface (gradient + custom border).
const chartSurfaceSx = {
  backgroundColor: '#07143f',
  backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
  border: '1px solid #0e346a'
};

// Module-scope constants - hoisted to avoid being re-created every render.
const signalBarHeights = [12, 18, 24, 30];

const sensorStatusCards = [
  { title: 'Rainfall', status: 'Inactive', statusColor: 'var(--purple)', notchColor: 'var(--purple)' },
  { title: 'Camera', status: 'Active', statusColor: 'var(--green)', notchColor: 'var(--green)' },
  { title: 'Solar Radiation', status: 'Inactive', statusColor: 'var(--purple)', notchColor: 'var(--purple)' },
  { title: 'Soil', status: 'Inactive', statusColor: 'var(--purple)', notchColor: 'var(--purple)' },
  { title: 'Air & Light', status: 'Active', statusColor: 'var(--green)', notchColor: 'var(--green)' },
  { title: 'Wind', status: 'Inactive', statusColor: 'var(--purple)', notchColor: 'var(--purple)' }
];

const graphCards = [
  {
    title: 'Cellular Signal (RSSI)',
    lineColor: '#48f7f5',
    data: [-105, -97, -98, -90, -92, -86, -83, -78]
  },
  {
    title: 'Internal Temperature',
    lineColor: '#c96cfc',
    data: [85, 94, 92, 100, 97, 103, 107, 112]
  },
  {
    title: 'Battery Charge',
    lineColor: '#f47568',
    data: [82, 80, 77, 75, 71, 68, 65, 63]
  }
];

const chartTimeLabels = ['0h', '3h', '6h', '9h', '12h', '15h', '18h', '24h'];

export default function SystemDiagnostics() {
  const [timeRange, setTimeRange] = useState('Last 24 hours');
  const [chartLayout, setChartLayout] = useState('row');
  const [selectedPheNode, setSelectedPheNode] = useState(null);
  const chartHeight = chartLayout === 'row' ? 228 : 258;

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
            Diagnostics
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
        <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
          <Grid size={{ xs: 12, lg: 2 }}>
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 1,
                minHeight: { xs: 180, md: 320 },
                height: '100%',
                ...drfSurfaceSx,
                ...reflectedCardChromeSx
              }}
            >
              <Stack sx={{ height: '100%' }} spacing={1.5}>
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: 120,
                      minHeight: 60,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#00143642',
                      borderStyle: 'none none solid',
                      borderWidth: '1px 1px 2px',
                      borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
                      boxShadow: 'inset 1px 4px 5px #0003'
                    }}
                  >
                    <Typography variant="h3" sx={{ color: 'var(--green)', lineHeight: 1 }}>
                      7
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1 }}>
                  <Typography variant="h5" sx={{ color: 'var(--blue)', textAlign: 'center' }}>
                    Wireless Sensors Connected to this PheNode
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box
                    component="img"
                    src={wirelessSensorsDiagram}
                    alt="Wireless sensors icon"
                    sx={{ width: { xs: 84, sm: 96, md: 104 }, height: 'auto', objectFit: 'contain' }}
                  />
                </Box>
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 8 }} sx={{ order: { xs: -1, sm: -1, md: 0 } }}>
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 1,
                minHeight: { xs: 220, md: 320 },
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...drfSurfaceSx,
                ...reflectedCardChromeSx
              }}
            >
              <Stack spacing={1.25} sx={{ width: '100%', height: '100%' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 0, sm: 1.25 }}
                  sx={{ width: '100%', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
                >
                  <Box sx={{ width: { xs: '100%', sm: 'clamp(250px, 44%, 380px)' }, flex: '0 1 auto' }}>
                    <Autocomplete
                      options={pheNodeSelectionOptions}
                      value={selectedPheNode}
                      onChange={(_, newValue) => setSelectedPheNode(newValue)}
                      sx={{ width: '100%' }}
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
                  </Box>

                  <Typography
                    variant="body1"
                    sx={{
                      display: { xs: 'none', sm: 'block' },
                      textAlign: 'right',
                      fontWeight: 600,
                      width: { sm: 'clamp(250px, 44%, 380px)' },
                      flex: '0 1 auto'
                    }}
                  >
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
                </Stack>

                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box
                    component="img"
                    src={phenodeDiagram}
                    alt="Phenode system diagram"
                    sx={{
                      width: { xs: '90%', sm: '88%', md: '88%', lg: '92%', xl: '94%' },
                      maxHeight: { md: 390, lg: 490, xl: 590 },
                      objectFit: 'contain',
                      transform: { xs: 'translateX(20px)', md: 'translateX(12px)', xl: 'translateX(42px)' }
                    }}
                  />
                </Box>

                <Typography
                  variant="body1"
                  sx={{ display: { xs: 'block', sm: 'none' }, textAlign: 'center', fontWeight: 600, mt: 2.25, width: '100%' }}
                >
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
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 2 }}>
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 1,
                minHeight: { xs: 180, md: 320 },
                height: '100%',
                ...drfSurfaceSx,
                ...reflectedCardChromeSx
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: '1fr' },
                  gridTemplateRows: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                  gap: 1.5
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', mb: 1, textAlign: 'center' }}>
                    Cellular:
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-end' }}>
                    {signalBarHeights.map((barHeight) => (
                      <Box
                        key={`cell-${barHeight}`}
                        sx={{
                          width: 10,
                          height: barHeight,
                          backgroundColor: 'var(--green)',
                          border: '1px solid var(--reflected-light)',
                          borderRadius: 0,
                          outlineOffset: '0px',
                          outline: '3px #e8e8e8',
                          boxShadow: '0 0 10px 1px #1a75e0db'
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', mb: 1, textAlign: 'center' }}>
                    WiFi:
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-end' }}>
                    {signalBarHeights.map((barHeight) => (
                      <Box
                        key={`wifi-${barHeight}`}
                        sx={{
                          width: 10,
                          height: barHeight,
                          backgroundColor: 'transparent',
                          border: '1px solid var(--reflected-light)',
                          borderRadius: 0,
                          outlineOffset: '0px',
                          outline: '3px #e8e8e8',
                          boxShadow: '0 0 10px 1px #1a75e0db'
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', textAlign: 'center' }}>
                    Battery Charge:
                  </Typography>
                  <Typography variant="subtitle1" sx={{ color: 'var(--green)', mt: 0.5, textAlign: 'center' }}>
                    84.12%
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', textAlign: 'center' }}>
                    Internal Temperature:
                  </Typography>
                  <Typography variant="subtitle1" sx={{ color: 'var(--orange)', mt: 0.5, textAlign: 'center' }}>
                    113.63°F
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...drfSurfaceSx, ...reflectedCardChromeSx }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(3, minmax(0, 1fr))',
                    md: 'repeat(6, minmax(0, 1fr))'
                  },
                  gap: 1.5
                }}
              >
                {sensorStatusCards.map((card) => (
                  <Box
                    key={card.title}
                    sx={{
                      minHeight: { xs: 96, sm: 110 },
                      borderRadius: 1,
                      px: 1.25,
                      py: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: 0.5,
                      ...drfSurfaceSx,
                      ...reflectedCardChromeSx
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 5,
                        borderRadius: 1,
                        mb: 0.75,
                        backgroundColor: card.notchColor,
                        boxShadow: `0 0 8px 1px ${card.notchColor}`
                      }}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateY(4px)' }}>
                      <Typography variant="h5" sx={{ color: 'var(--blue)', textAlign: 'center', mb: 0.75 }}>
                        {card.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body1" sx={{ color: 'var(--blue)' }}>
                          Sensor Status:
                        </Typography>
                        <Typography variant="body1" sx={{ color: card.statusColor }}>
                          {card.status}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box
              sx={{
                borderRadius: 1,
                p: { xs: 1.5, sm: 2 },
                ...drfSurfaceSx,
                ...reflectedCardChromeSx,
                boxShadow: '0 14px 26px rgba(1, 13, 50, 1)'
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                  Diagnostics Over Time
                </Typography>
                <Tooltip
                  title="Orientation"
                  arrow={false}
                  slotProps={tooltipSlotProps}
                >
                  <IconButton
                    aria-label="toggle chart layout"
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
                      backgroundColor: 'var(--drf)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '& .MuiSelect-icon': { color: 'var(--blue)' }
                    }}
                    MenuProps={{
                      PaperProps: neonSelectMenuPaperProps
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
                <Tooltip
                  title="Refresh"
                  arrow={false}
                  slotProps={tooltipSlotProps}
                >
                  <IconButton
                    aria-label="refresh diagnostics charts"
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

              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns:
                    chartLayout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr'
                }}
              >
                {graphCards.map((graph) => {
                  const minVal = Math.min(...graph.data);
                  const maxVal = Math.max(...graph.data);
                  const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

                  return (
                    <Box
                      key={graph.title}
                      sx={{
                        borderRadius: 1,
                        p: { xs: 0.45, sm: 0.65 },
                        minHeight: { xs: 260, sm: 286 },
                        display: 'flex',
                        flexDirection: 'column',
                        ...reflectedCardChromeSx,
                        ...chartSurfaceSx
                      }}
                    >
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                        <Typography variant="subtitle1" sx={{ color: 'var(--blue)', ml: 1.25 }}>
                          {graph.title}
                        </Typography>
                        <IconButton aria-label={`zoom ${graph.title}`} size="small" sx={{ color: 'var(--blue)' }}>
                          <ZoomInOutlined />
                        </IconButton>
                      </Stack>

                      <LineChart
                        xAxis={[
                          {
                            id: `${graph.title}-x`,
                            scaleType: 'point',
                            data: chartTimeLabels,
                            tickLabelInterval: (_, index) => index === 0 || index === chartTimeLabels.length - 1 || index % 2 === 0,
                            tickLabelStyle: { fontSize: 11, fill: 'var(--green)' }
                          }
                        ]}
                        yAxis={[
                          {
                            id: `${graph.title}-y`,
                            min: minVal - pad,
                            max: maxVal + pad,
                            width: 30,
                            tickLabelStyle: { fill: 'var(--green)' },
                            valueFormatter: (value) => `${Math.round(value)}`
                          }
                        ]}
                        series={[
                          {
                            id: `${graph.title}-line`,
                            data: graph.data,
                            color: graph.lineColor,
                            area: true,
                            showMark: false,
                            curve: 'linear'
                          }
                        ]}
                        grid={{ horizontal: true, vertical: true }}
                        height={chartHeight}
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
                            filter: `drop-shadow(0 0 8px ${graph.lineColor})`
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
