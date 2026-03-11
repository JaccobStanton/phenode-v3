import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import wirelessSensorsDiagram from 'assets/diagrams/Wireless-Sensors-v4.svg';

const glassSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

export default function SensorNetwork() {
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
            Wireless Sensor Measurements
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
          <Grid size={{ xs: 12, lg: 8 }}>
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Box
                component="img"
                src={wirelessSensorsDiagram}
                alt="Wireless sensor network diagram"
                sx={{
                  width: { xs: '92%', sm: '88%', md: '84%', lg: '82%' },
                  maxHeight: { xs: 240, sm: 330, md: 400 },
                  objectFit: 'contain'
                }}
              />
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }} sx={{ display: 'flex' }}>
            <Stack spacing={2.5} sx={{ width: '100%', height: '100%' }}>
              <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
                <Typography variant="h5" sx={{ mb: 2, color: 'var(--blue)' }}>
                  Sensor Info
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                  <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Sensor ID:
                  </Typography>
                  <Typography variant="body1" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    WS-1234568
                  </Typography>

                  <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    GPS:
                  </Typography>
                  <Typography variant="body1" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    32 42 23 43, 92 89
                  </Typography>

                  <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Altitude:
                  </Typography>
                  <Typography variant="body1" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    793.95ft
                  </Typography>

                  <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Battery:
                  </Typography>
                  <Typography variant="body1" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    87.52%
                  </Typography>

                  <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                    Sensors Connected:
                  </Typography>
                  <Typography variant="body1" sx={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                    2
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, flexGrow: 1, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
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
                        backgroundColor: '#00143642',
                        borderStyle: 'none none solid',
                        borderWidth: '1px 1px 2px',
                        borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
                        borderRadius: 1,
                        '& fieldset': {
                          border: 'none'
                        },
                        '&:hover fieldset': {
                          border: 'none'
                        },
                        '&.Mui-focused fieldset': {
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

          <Grid size={{ xs: 12 }}>
            <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
              <Typography variant="h5" sx={{ mb: 1.5, color: 'var(--blue)' }}>
                Measurements Over Time
              </Typography>
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 180 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell align="right">Temperature (F)</TableCell>
                      <TableCell align="right">Humidity (%)</TableCell>
                      <TableCell align="right">Battery (%)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody />
                </Table>
              </TableContainer>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
