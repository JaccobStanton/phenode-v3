import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import SortAscendingOutlined from '@ant-design/icons/SortAscendingOutlined';

import MainCard from 'components/MainCard';

const glassSurfaceSx = {
  backgroundColor: 'rgba(12, 35, 80, 0.359)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

const reflectedCardChromeSx = {
  border: '0.5px solid var(--box-outline-blue)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const greenGlowTextSx = {
  color: 'var(--green)',
  textShadow: '0 1px 9px #1a75e0c9'
};

const controlBaseSx = {
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  color: 'var(--blue)',
  backgroundColor: 'rgba(0, 20, 61, 0.72)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

const tooltipSlotProps = {
  tooltip: {
    sx: {
      backgroundColor: 'rgba(0, 20, 61, 0.96)',
      color: 'var(--green)',
      border: '1px solid var(--reflected-light)',
      boxShadow: '0 11px 19px 1px #0000002e',
      fontSize: '0.78rem'
    }
  }
};

const fleetRows = [
  {
    siteName: 'WS-1234567',
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
    siteName: 'WS-1112131415',
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
    siteName: 'WS-12345674',
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
    siteName: 'WS-98765443',
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
    siteName: 'WS-56473892',
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

export default function SensorFleetOverview() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [sortMode, setSortMode] = useState('');

  const visibleRows = useMemo(() => {
    const loweredSearch = searchValue.trim().toLowerCase();

    const filteredRows = fleetRows.filter((row) => {
      if (!loweredSearch) return true;
      const searchableText = [row.siteName, row.lastMeasurements, ...row.metrics.map((metric) => `${metric.label} ${metric.value}`)]
        .join(' ')
        .toLowerCase();
      return searchableText.includes(loweredSearch);
    });

    const getHealthStatus = (row) => {
      const healthMetric = row.metrics.find((metric) => metric.label.toLowerCase().includes('health status'));
      return healthMetric?.value?.toLowerCase() || '';
    };

    if (sortMode === 'alpha') {
      return [...filteredRows].sort((a, b) => a.siteName.localeCompare(b.siteName));
    }

    if (sortMode === 'status') {
      return [...filteredRows].sort((a, b) => {
        const aStatus = getHealthStatus(a) === 'active' ? 0 : 1;
        const bStatus = getHealthStatus(b) === 'active' ? 0 : 1;
        if (aStatus !== bStatus) return aStatus - bStatus;
        return a.siteName.localeCompare(b.siteName);
      });
    }

    return filteredRows;
  }, [searchValue, sortMode]);

  return (
    <MainCard content={false} sx={{ overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
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
          <Typography variant="body1" sx={{ ml: 'auto', textAlign: 'right' }}>
            <Box component="span" sx={{ color: 'var(--blue)', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              Sensors Active:
            </Box>
            <Box component="span" sx={{ ...greenGlowTextSx, ml: 1.5, display: 'inline-block', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              12
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mb: 2,
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', width: { xs: '100%', sm: 'auto' }, flex: { xs: 1, sm: '0 1 auto' }, minWidth: 0 }}
          >
            <Tooltip title="Search" arrow={false} slotProps={tooltipSlotProps}>
              <IconButton
                aria-label="open search"
                onClick={() => setIsSearchOpen((previous) => !previous)}
                sx={{
                  width: 40,
                  height: 40,
                  ...controlBaseSx,
                  '&:hover': {
                    borderColor: 'var(--green)',
                    color: 'var(--green)',
                    backgroundColor: 'rgba(0, 20, 61, 0.72)'
                  },
                  ...(isSearchOpen && {
                    borderColor: 'var(--green)',
                    color: 'var(--green)'
                  })
                }}
              >
                <SearchOutlined />
              </IconButton>
            </Tooltip>

            <Box
              sx={{
                width: isSearchOpen ? { xs: '100%', sm: 260 } : 0,
                maxWidth: { sm: 260 },
                flexGrow: isSearchOpen ? 1 : 0,
                minWidth: 0,
                opacity: isSearchOpen ? 1 : 0,
                overflow: 'hidden',
                transition: 'width 220ms ease, opacity 220ms ease, flex-grow 220ms ease'
              }}
            >
              <OutlinedInput
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                size="small"
                placeholder="Search Wireless Sensors..."
                fullWidth
                inputProps={{ 'aria-label': 'Search fleet table' }}
                startAdornment={
                  <InputAdornment position="start">
                    <SearchOutlined style={{ color: 'var(--blue)' }} />
                  </InputAdornment>
                }
                sx={{
                  minHeight: 40,
                  color: 'var(--green)',
                  ...controlBaseSx,
                  '& .MuiOutlinedInput-notchedOutline': {
                    border: 'none'
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'var(--blue)',
                    opacity: 1
                  }
                }}
              />
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
            <Tooltip title="Sort Alphabetically" arrow={false} slotProps={tooltipSlotProps}>
              <ToggleButton
                value="alpha"
                selected={sortMode === 'alpha'}
                onChange={() => setSortMode((previous) => (previous === 'alpha' ? '' : 'alpha'))}
                aria-label="sort fleet alphabetically"
                sx={{
                  textTransform: 'none',
                  px: { xs: 1.25, sm: 1.5 },
                  minHeight: 40,
                  minWidth: 40,
                  gap: 0.75,
                  ...controlBaseSx,
                  '&:hover': {
                    color: 'var(--green)',
                    borderColor: 'var(--green)',
                    backgroundColor: 'rgba(0, 20, 61, 0.72)'
                  },
                  '&.Mui-selected': {
                    color: 'var(--green)',
                    borderColor: 'var(--green)',
                    backgroundColor: 'rgba(72, 247, 245, 0.12)'
                  },
                  '&.Mui-selected:hover': {
                    backgroundColor: 'rgba(72, 247, 245, 0.18)'
                  }
                }}
              >
                <SortAscendingOutlined />
                <Typography variant="caption" sx={{ display: { xs: 'none', md: 'inline' }, color: 'inherit' }}>
                  A-Z
                </Typography>
              </ToggleButton>
            </Tooltip>

            <Tooltip title="Sort by Status" arrow={false} slotProps={tooltipSlotProps}>
              <ToggleButton
                value="status"
                selected={sortMode === 'status'}
                onChange={() => setSortMode((previous) => (previous === 'status' ? '' : 'status'))}
                aria-label="sort fleet by status"
                sx={{
                  textTransform: 'none',
                  px: { xs: 1.25, sm: 1.5 },
                  minHeight: 40,
                  minWidth: 40,
                  gap: 0.75,
                  ...controlBaseSx,
                  '&:hover': {
                    color: 'var(--green)',
                    borderColor: 'var(--green)',
                    backgroundColor: 'rgba(0, 20, 61, 0.72)'
                  },
                  '&.Mui-selected': {
                    color: 'var(--green)',
                    borderColor: 'var(--green)',
                    backgroundColor: 'rgba(72, 247, 245, 0.12)'
                  },
                  '&.Mui-selected:hover': {
                    backgroundColor: 'rgba(72, 247, 245, 0.18)'
                  }
                }}
              >
                <CheckCircleOutlined />
                <Typography variant="caption" sx={{ display: { xs: 'none', md: 'inline' }, color: 'inherit' }}>
                  Status
                </Typography>
              </ToggleButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Box
          sx={{
            maxHeight: { xs: 'calc(100vh - 280px)', md: 560 },
            overflowY: 'auto',
            overflowX: { xs: 'auto', md: 'hidden' },
            pr: { xs: 0, sm: 1 },
            pb: 1,
            '&::-webkit-scrollbar': {
              width: '13px',
              height: '10px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 68, 143, 0.8)'
            }
          }}
        >
          <Box sx={{ minWidth: { xs: 860, sm: 920, md: 'auto' }, pr: { xs: 1, sm: 0 } }}>
            <Stack
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                boxSizing: 'border-box'
              }}
            >
              {visibleRows.map((row) => (
                <Card
                  key={row.siteName}
                  sx={{
                    width: '100%',
                    minWidth: { xs: 840, sm: 900, md: 0 },
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
                    <Grid size={{ xs: 3, md: 3, lg: 3 }}>
                      <Stack spacing={0.4} sx={{ textAlign: 'left' }}>
                        <Typography variant="h4" sx={{ color: 'var(--green)', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                          {row.siteName}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontSize: { xs: '0.78rem', sm: '0.84rem' } }}>
                          Last measurements taken:
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'var(--green)', fontSize: { xs: '0.8rem', sm: '0.88rem' } }}>
                          {row.lastMeasurements}
                        </Typography>
                      </Stack>
                    </Grid>

                    <Grid size={{ xs: 9, md: 9, lg: 9 }}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: 'repeat(5, minmax(0, 1fr))',
                            sm: 'repeat(5, minmax(0, 1fr))',
                            lg: 'repeat(5, minmax(0, 1fr))'
                          },
                          gap: { xs: 1.25, sm: 1.5, lg: 2 },
                          justifyItems: 'center'
                        }}
                      >
                        {row.metrics.map((metric) => (
                          <Stack key={`${row.siteName}-${metric.label}`} spacing={0.2} sx={{ alignItems: 'center' }}>
                            <Typography variant="subtitle1" sx={{ color: 'var(--blue)', fontSize: { xs: '0.82rem', sm: '0.9rem' } }}>
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
              {visibleRows.length === 0 && (
                <Card
                  sx={{
                    width: '100%',
                    minWidth: { xs: 840, sm: 900, md: 0 },
                    backgroundColor: 'rgba(12, 35, 80, 0.359)',
                    p: 2,
                    border: '0.5px solid var(--box-outline-blue)',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                    textAlign: 'center'
                  }}
                >
                  <Typography variant="body1" sx={{ color: 'var(--blue)' }}>
                    No sensor entries found for that search.
                  </Typography>
                </Card>
              )}
            </Stack>
          </Box>
        </Box>
      </Box>
    </MainCard>
  );
}
