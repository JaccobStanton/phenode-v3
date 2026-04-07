import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import phenodeDiagram from 'assets/diagrams/Phenode-Diagram.svg';
import wirelessSensorsDiagram from 'assets/diagrams/Wireless-Sensors.svg';

import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
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

export default function SystemDiagnostics() {
  const [timeRange, setTimeRange] = useState('Last 24 hours');
  const [chartLayout, setChartLayout] = useState('row');
  const signalBarHeights = [12, 18, 24, 30];
  const sensorStatusCards = [
    { title: 'Rainfall', status: 'Inactive', statusColor: 'var(--purple)', notchColor: 'var(--purple)' },
    { title: 'Camera', status: 'Active', statusColor: 'var(--green)', notchColor: 'var(--green)' },
    { title: 'Solar Radiation', status: 'Inactive', statusColor: 'var(--purple)', notchColor: 'var(--purple)' },
    { title: 'Soil', status: 'Inactive', statusColor: 'var(--purple)', notchColor: 'var(--purple)' },
    { title: 'Air & Light', status: 'Active', statusColor: 'var(--green)', notchColor: 'var(--green)' },
    { title: 'Wind', status: 'Inactive', statusColor: 'var(--purple)', notchColor: 'var(--purple)' }
  ];
  const timeRangeOptions = useMemo(
    () => [
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
    ],
    []
  );
  const graphCards = [
    {
      title: 'Cellular Signal (RSSI)',
      xUnits: ['0h', '6h', '12h', '18h', '24h'],
      yUnits: ['-110', '-95', '-80', '-65'],
      linePoints: '6,88 18,70 31,74 44,56 57,62 70,48 83,41 96,28'
    },
    {
      title: 'Internal Temperature',
      xUnits: ['0h', '6h', '12h', '18h', '24h'],
      yUnits: ['80', '95', '110', '125'],
      linePoints: '6,80 18,72 31,60 44,58 57,46 70,52 83,36 96,24'
    },
    {
      title: 'Battery Charge',
      xUnits: ['0h', '6h', '12h', '18h', '24h'],
      yUnits: ['40', '55', '70', '85', '100'],
      linePoints: '6,30 18,34 31,38 44,42 57,48 70,54 83,58 96,62'
    }
  ];
  const chartGridTicks = [0, 20, 40, 60, 80, 100];

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
                      borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)'
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

          <Grid size={{ xs: 12, lg: 8 }}>
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
              <Stack spacing={0.9} sx={{ width: '100%', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ textAlign: 'center', fontWeight: 600 }}>
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
                  component="img"
                  src={phenodeDiagram}
                  alt="Phenode system diagram"
                  sx={{
                    width: { xs: '90%', sm: '88%', md: '88%', lg: '92%', xl: '94%' },
                    maxHeight: { md: 390, lg: 490, xl: 590 },
                    objectFit: 'contain'
                  }}
                />
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
            <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...reflectedCardChromeSx }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                  Diagnostics Over Time
                </Typography>
                <IconButton
                  aria-label="toggle chart layout"
                  onClick={() => setChartLayout((prev) => (prev === 'column' ? 'row' : 'column'))}
                  sx={{ border: '1px solid var(--reflected-light)', color: 'var(--blue)' }}
                >
                  <AppstoreOutlined />
                </IconButton>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                  <Select
                    value={timeRange}
                    onChange={(event) => setTimeRange(event.target.value)}
                    sx={{
                      color: 'var(--blue)',
                      backgroundColor: 'var(--drf)',
                      '& .MuiSelect-icon': { color: 'var(--blue)' }
                    }}
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
                  aria-label="refresh diagnostics charts"
                  sx={{
                    alignSelf: { xs: 'flex-start', sm: 'center' },
                    border: '1px solid var(--reflected-light)',
                    color: 'var(--purple)'
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
                {graphCards.map((graph) => (
                  <Box key={graph.title} sx={{ borderRadius: 1, p: { xs: 1.25, sm: 1.5 }, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ color: 'var(--blue)' }}>
                        {graph.title}
                      </Typography>
                      <IconButton aria-label={`zoom ${graph.title}`} size="small" sx={{ color: 'var(--blue)' }}>
                        <ZoomInOutlined />
                      </IconButton>
                    </Stack>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1 }}>
                      <Stack sx={{ justifyContent: 'space-between', minHeight: 130 }}>
                        {graph.yUnits.map((unit) => (
                          <Typography key={`${graph.title}-${unit}`} variant="caption" sx={{ color: 'var(--green)' }}>
                            {unit}
                          </Typography>
                        ))}
                      </Stack>
                      <Box>
                        <Box
                          component="svg"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          sx={{ width: '100%', height: 130, display: 'block' }}
                        >
                          {chartGridTicks.map((tick) => (
                            <line
                              key={`${graph.title}-x-grid-${tick}`}
                              x1={tick}
                              y1="0"
                              x2={tick}
                              y2="100"
                              stroke="var(--blue)"
                              strokeOpacity="0.35"
                              strokeWidth="0.6"
                            />
                          ))}
                          {chartGridTicks.map((tick) => (
                            <line
                              key={`${graph.title}-y-grid-${tick}`}
                              x1="0"
                              y1={tick}
                              x2="100"
                              y2={tick}
                              stroke="var(--blue)"
                              strokeOpacity="0.35"
                              strokeWidth="0.6"
                            />
                          ))}
                          <polyline fill="none" stroke="var(--green)" strokeWidth="2.2" points={graph.linePoints} />
                        </Box>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
                          {graph.xUnits.map((unit) => (
                            <Typography key={`${graph.title}-x-${unit}`} variant="caption" sx={{ color: 'var(--green)' }}>
                              {unit}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
