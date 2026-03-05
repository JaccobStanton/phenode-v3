import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

const glassSurfaceSx = {
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const greenGlowTextSx = {
  color: 'var(--green)',
  textShadow: '0 1px 9px #1a75e0c9'
};

const fleetRows = [
  {
    siteName: 'Shakoor Lab 020',
    lastMeasurements: '3/5/2026, 12:13:44 PM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '51.98°F' },
      { label: "Today's Rainfall", value: '0 mm/hr' },
      { label: 'Wind Speed:', value: 'N/A' },
      { label: 'Battery:', value: '99.29%' }
    ]
  },
  {
    siteName: 'Danforth Field Research',
    lastMeasurements: '3/5/2026, 12:08:29 PM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '52.70°F' },
      { label: "Today's Rainfall:", value: '24.5 mm/hr' },
      { label: 'Wind Speed:', value: '0.88 mph' },
      { label: 'Battery:', value: '100%' }
    ]
  },
  {
    siteName: 'Danforth Prairie',
    lastMeasurements: '3/5/2026, 11:52:01 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '50.54°F' },
      { label: "Today's Rainfall:", value: '28 mm/hr' },
      { label: 'Wind Speed:', value: 'N/A' },
      { label: 'Battery:', value: '99.43%' }
    ]
  },
  {
    siteName: 'Clemson PDREC',
    lastMeasurements: '3/5/2026, 10:48:24 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '69.26°F' },
      { label: "Today's Rainfall:", value: '0 mm/hr' },
      { label: 'Wind Speed:', value: '2.51 mph' },
      { label: 'Battery:', value: '99.43%' }
    ]
  },
  {
    siteName: 'Shakoor Lab 017',
    lastMeasurements: '3/5/2026, 10:12:08 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '55.12°F' },
      { label: "Today's Rainfall:", value: '5 mm/hr' },
      { label: 'Wind Speed:', value: '1.21 mph' },
      { label: 'Battery:', value: '98.87%' }
    ]
  }
];

export default function FleetOverview() {
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
            Your Fleet
          </Typography>
          <Typography variant="body1" sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Box component="span" sx={{ color: 'var(--blue)', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              PheNodes Active:
            </Box>
            <Box component="span" sx={{ ...greenGlowTextSx, ml: 1.5, display: 'inline-block', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              12
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            maxHeight: { xs: 'calc(100vh - 280px)', md: 560 },
            overflowY: 'auto',
            pr: 1,
            '&::-webkit-scrollbar': {
              width: '13px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 68, 143, 0.8)'
            }
          }}
        >
          <Stack
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              boxSizing: 'border-box'
            }}
          >
            {fleetRows.map((row) => (
              <Card
                key={row.siteName}
                sx={{
                  width: '99%',
                  backgroundColor: 'rgba(12, 35, 80, 0.359)',
                  p: 2,
                  border: '0.5px solid var(--box-outline-blue)',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                  opacity: 1,
                  transition: 'background-color 120ms ease, border-color 120ms ease',
                  '&:hover': {
                    backgroundColor: 'rgba(56, 152, 236, 0.1)',
                    borderLeft: '0.5px solid var(--green)',
                    borderRight: '0.5px solid var(--green)',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer'
                  }
                }}
              >
                <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ alignItems: 'center' }}>
                  <Grid size={{ xs: 12, md: 3, lg: 3 }}>
                    <Stack spacing={0.4} sx={{ textAlign: 'left' }}>
                      <Typography variant="h4" sx={{ color: 'var(--green)', fontSize: { xs: '1.1rem', sm: '1.25rem', } }}>
                        {row.siteName}
                      </Typography>
                      <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontSize: { xs: '0.78rem', sm: '0.84rem', } }}>
                        Last measurements taken:
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'var(--green)', fontSize: { xs: '0.8rem', sm: '0.88rem', } }}>
                        {row.lastMeasurements}
                      </Typography>
                    </Stack>
                  </Grid>

                  <Grid size={{ xs: 12, md: 9, lg: 9 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
                        gap: { xs: 1.25, sm: 1.5, lg: 2 },
                        justifyItems: 'center'
                      }}
                    >
                      {row.metrics.map((metric) => (
                        <Stack key={`${row.siteName}-${metric.label}`} spacing={0.2} sx={{ alignItems: 'center' }}>
                          <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontSize: { xs: '0.82rem', sm: '0.9rem', } }}>
                            {metric.label}
                          </Typography>
                          <Typography variant="h4" sx={{ ...greenGlowTextSx, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
                            {metric.value}
                          </Typography>
                        </Stack>
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </Card>
            ))}
          </Stack>
        </Box>
      </Box>
    </MainCard>
  );
}
