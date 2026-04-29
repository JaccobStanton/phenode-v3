import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import wsFleetIcon from 'assets/drawer-icons/WS_Fleet.svg';
import wsFleetIconActive from 'assets/drawer-icons/WS_Fleet_Active.svg';
import soilProbeIconActive from 'assets/toggle_buttons/Soil_Probe_Icon_Active.svg';
import soilProbeIconInactive from 'assets/toggle_buttons/Soil_Probe_Icon_Inactive.svg';

import { glassSurfaceSx, reflectedCardChromeSx, tooltipSlotProps } from 'themes/sx-tokens';
import { soilProbeReadings, sensorInfoReadings } from 'data/mocks/sensor-measurements';

const mapPins = [
  { id: 'WS-1234568', top: '22%', left: '18%' },
  { id: 'AIR-4412', top: '34%', left: '57%' },
  { id: 'RAIN-7722', top: '46%', left: '36%' },
  { id: 'SOIL-2031', top: '62%', left: '73%' },
  { id: 'WIND-9901', top: '71%', left: '27%' }
];

export default function MapView({ infoCardMode, setInfoCardMode, selectedSoilProbe, setSelectedSoilProbe }) {
  const [isInfoToggleHovered, setIsInfoToggleHovered] = useState(false);
  const isSoilDataMode = infoCardMode === 'soil';
  const infoCardTitle = isSoilDataMode ? 'Soil Data' : 'Sensor Information';
  const infoCardTooltipTitle = isSoilDataMode ? 'Sensor Info.' : 'Soil Data';
  const infoCardToggleIcon = isSoilDataMode
    ? isInfoToggleHovered
      ? wsFleetIconActive
      : wsFleetIcon
    : isInfoToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive;
  const activeSoilReadings = soilProbeReadings[selectedSoilProbe] ?? soilProbeReadings['probe-1'];
  const activeReadings = isSoilDataMode ? activeSoilReadings : sensorInfoReadings;

  return (
    <Stack spacing={2.5}>
      <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: { xs: 250, sm: 310, md: 360, lg: 390 },
            borderRadius: 1,
            overflow: 'hidden',
            background:
              'radial-gradient(circle at 18% 16%, rgba(72, 247, 245, 0.18), transparent 35%), radial-gradient(circle at 80% 70%, rgba(148, 11, 244, 0.18), transparent 45%), linear-gradient(160deg, #00112f 0%, #032a62 54%, #001a44 100%)',
            border: '1px solid var(--reflected-light)'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(72, 247, 245, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(72, 247, 245, 0.12) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              opacity: 0.35
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(120deg, transparent 0%, transparent 36%, rgba(72, 247, 245, 0.28) 37%, transparent 38%, transparent 57%, rgba(72, 247, 245, 0.28) 58%, transparent 59%, transparent 100%)',
              opacity: 0.3
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              ...glassSurfaceSx,
              ...reflectedCardChromeSx
            }}
          >
            <Typography variant="subtitle2" sx={{ color: 'var(--green)', textShadow: '0 0 6px rgba(72, 247, 245, 0.5)' }}>
              Wireless Sensor Map
            </Typography>
          </Box>

          {mapPins.map((pin) => (
            <Box key={pin.id} sx={{ position: 'absolute', top: pin.top, left: pin.left, transform: 'translate(-50%, -50%)' }}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: 'var(--green)',
                  border: '1px solid var(--reflected-light)',
                  boxShadow: '0 0 10px 1px #1a75e0db'
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  mt: 0.4,
                  px: 0.5,
                  py: 0.15,
                  borderRadius: 0.5,
                  color: 'var(--blue)',
                  backgroundColor: 'rgba(0, 17, 48, 0.86)',
                  border: '1px solid var(--reflected-light)',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  textAlign: 'center'
                }}
              >
                {pin.id}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, lg: 7 }} sx={{ display: 'flex' }}>
          <Box
            sx={{
              borderRadius: 1,
              p: { xs: 1.5, sm: 2 },
              width: '100%',
              ...glassSurfaceSx,
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
                    backgroundColor: 'rgba(0, 17, 48, 0.03)',
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
                    boxShadow: '0 11px 19px 1px #0000002e'
                  }}
                >
                  <Box component="img" src={infoCardToggleIcon} alt="" sx={{ width: 22, height: 22 }} />
                </IconButton>
              </Tooltip>
            </Stack>

            {isSoilDataMode ? (
              <ToggleButtonGroup
                exclusive
                value={selectedSoilProbe}
                onChange={(_, nextValue) => {
                  if (nextValue) setSelectedSoilProbe(nextValue);
                }}
                size="small"
                sx={{
                  mb: 1.75,
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
            ) : null}

            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
              }}
            >
              {activeReadings.map((reading) => (
                <Box
                  key={reading.label}
                  sx={{
                    border: '1px solid var(--reflected-light)',
                    borderRadius: 1,
                    p: 1,
                    backgroundColor: 'rgba(0, 20, 61, 0.38)'
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                      {reading.label}
                    </Typography>
                    <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                      {reading.value}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }} sx={{ display: 'flex' }}>
          <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, width: '100%', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
            <Stack spacing={1.6} sx={{ height: '100%', justifyContent: 'center' }}>
              <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                Rename this Sensor:
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Enter new sensor name"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      minHeight: 40,
                      color: 'var(--blue)',
                      backgroundColor: '#00143642',
                      borderStyle: 'none none solid',
                      borderWidth: '1px 1px 2px',
                      borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
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
                      textAlign: 'left',
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
                    minWidth: 132,
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
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Stack>
  );
}
