import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import AntIcon from 'components/AntIcon';
import AppstoreOutlined from '@ant-design/icons-svg/lib/asn/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons-svg/lib/asn/ClockCircleOutlined';
import DownloadOutlined from '@ant-design/icons-svg/lib/asn/DownloadOutlined';
import ZoomInOutlined from '@ant-design/icons-svg/lib/asn/ZoomInOutlined';

import useAuth from 'hooks/useAuth';
import useDeviceHealth from 'hooks/data/useDeviceHealth';
import useDeviceMeasurements from 'hooks/data/useDeviceMeasurements';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import { useToast } from 'providers/ToastProvider';
import { downloadDeviceHealthData } from 'services/mutations';
import triggerBlobDownload from 'utils/triggerBlobDownload';

import { CHART_TIME_RANGE_LABELS, computeAxisTicks, computeChartWindow, pollingIntervalForRange } from 'utils/chartTimeRanges';

import { MeasurementChart } from 'sections/sensor-measurements/measurementChartCore';

import { drfSurfaceSx, reflectedCardChromeSx, orientationButtonSx, tooltipSlotProps, neonSelectMenuPaperProps } from 'themes/sx-tokens';

// =============================================================================
// DiagnosticsChartsPanel — lazy-loaded chart grid for system-diagnostics.
// =============================================================================
//
// Why this is its own (lazy) component:
//
//   The "Diagnostics Over Time" panel is the heaviest below-the-fold piece of
//   the system-diagnostics page — MUI x-charts + two SWR fetches + six chart
//   instances. Splitting it out lets the parent's LCP element (the SVG diagram
//   + snapshot card) paint without waiting for x-charts to parse or for the
//   health/measurement fetches to fire. The parent imports this via React.lazy
//   + Suspense.
//
// Why the perf shape matches sensor-measurements:
//
//   - `MeasurementChart` (from sensor-measurements/measurementChartCore.jsx)
//     is `memo`'d with PRIMITIVE props, so React.memo's shallowEqual catches
//     "nothing changed for this chart" and skips the entire LineChart subtree.
//     Toolbar fidgeting + 60s SWR polls (when data is byte-identical thanks
//     to the hook's `compare: JSON.stringify` guard) cost zero chart redraws.
//   - `chartSx` is hoisted to module scope inside the core; per-chart color
//     comes through a `--chart-line-color` CSS variable set on the wrapper.
//     No object-literal-per-render in the sx prop, no `drop-shadow(...)` string
//     interpolation in the filter, no per-element filter recompile.
//   - Glow uses the static SVG `<filter id="chart-glow-full">` from
//     `ChartGlowDefs` (mounted once by the parent). Wrapper Box swaps to
//     `chart-glow-lite` when a chart's point count crosses LITE_GLOW_THRESHOLD,
//     which matters on the long-range view (~1,825 daily buckets across the
//     six charts).
//   - Series are built once per (rows × configs) via `useMemo`, not on every
//     parent render inside .map().

// =============================================================================
// Module-scope helpers + chart config.
// =============================================================================

const identity = (v) => v;
const cToF = (celsius) => (celsius * 9) / 5 + 32;
const mvToV = (mv) => mv / 1000;
const vToMv = (v) => v * 1000;

// Numeric coerce → finite | null. Same defensive shape used for the snapshot
// panel in the parent component.
const toFinite = (value) => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

// Health-feed fields the chart layer plots. Battery voltage is environmental
// (analog board measurement) — fetched separately via the existing sensor-data
// feed since the Notecard health series doesn't carry a battery field.
const HEALTH_CHART_FIELDS = ['notecard_temp', 'rssi', 'sinr', 'notecard_voltage', 'wifi_rssi'];
const ENV_CHART_FIELDS = ['battery_voltage'];

// Lite-glow kicks in when a chart's point count crosses this threshold — the
// full-radius blur (4px stdDeviation) overlaps into noise at dense point
// counts; the lite variant (1px) keeps the same visual identity at a fraction
// of the paint cost. Matches sensor-measurements' threshold.
const LITE_GLOW_THRESHOLD = 500;

// Chart card surface — gradient + custom border. Module-scope, one shared
// reference (otherwise every parent render creates a fresh sx literal and MUI
// can't memoize through it).
const chartSurfaceSx = {
  backgroundColor: '#07143f',
  backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
  border: '1px solid #0e346a'
};

// Time-range Select sx — hoisted out of the JSX for the same reason as
// chartSurfaceSx: one stable reference instead of a fresh object literal.
const timeRangeSelectSx = {
  color: 'var(--green)',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  backgroundColor: 'var(--drf)',
  boxShadow: '0 11px 19px 1px #0000002e',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'var(--blue)' }
};

// Download IconButton sx — also hoisted.
const downloadButtonSx = {
  color: 'var(--blue)',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  backgroundColor: 'var(--drf)',
  boxShadow: '0 11px 19px 1px #0000002e',
  '&:hover': { color: 'var(--green)', borderColor: 'var(--green)', backgroundColor: 'var(--drf)' }
};

// Per-chart configuration. Built from displayPrefs so unit toggles re-derive.
// `source` selects which feed feeds the series; `transform` converts the raw
// stored value into the displayed unit.
function buildChartConfigs(displayPrefs) {
  const tempUnit = displayPrefs?.tempUnit ?? 'F';
  const voltageUnit = displayPrefs?.voltageUnit ?? 'mv';

  const tempTransform = tempUnit === 'C' ? identity : cToF;
  const tempLabel = tempUnit === 'C' ? '°C' : '°F';
  const battVTransform = voltageUnit === 'v' ? mvToV : identity;
  const battVLabel = voltageUnit === 'v' ? 'V' : 'mV';

  return [
    {
      key: 'notecard_temp',
      source: 'health',
      title: `Internal Ambient Temperature (${tempLabel})`,
      color: '#c96cfc',
      unit: tempLabel,
      transform: tempTransform
    },
    { key: 'rssi', source: 'health', title: 'Cellular RSSI', color: '#48f7f5', unit: 'dBm', transform: identity },
    { key: 'sinr', source: 'health', title: 'Cellular SNIR', color: '#7bdff2', unit: 'dB', transform: identity },
    { key: 'notecard_voltage', source: 'health', title: 'Modem Voltage (mV)', color: '#f4d04b', unit: 'mV', transform: vToMv },
    {
      key: 'battery_voltage',
      source: 'env',
      title: `Battery Voltage (${battVLabel})`,
      color: '#f47568',
      unit: battVLabel,
      transform: battVTransform
    },
    { key: 'wifi_rssi', source: 'health', title: 'Wi-Fi RSSI', color: '#8539e0', unit: 'dBm', transform: identity }
  ];
}

// Build {times, data} for one chart, dropping null/missing points so the
// shared MeasurementChart's Math.min/max on the Y axis doesn't get poisoned by
// nulls coercing to 0.
function buildChartSeries(rows, field, transform) {
  if (!rows) return { times: [], data: [] };
  const times = [];
  const data = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const v = toFinite(row.fields?.[field]?.avg);
    if (v === null) continue;
    times.push(new Date(row.time));
    data.push(transform ? transform(v) : v);
  }
  return { times, data };
}

// =============================================================================
// Component.
// =============================================================================
export default function DiagnosticsChartsPanel({ selectedPheNodeId, selectedDevice, timeRange, setTimeRange }) {
  const displayPrefs = useDisplayPreferences();
  const { accessToken } = useAuth();
  const toast = useToast();

  // Row vs column layout for the chart grid. Local UI state — no need to
  // share with the parent.
  const [chartLayout, setChartLayout] = useState('row');
  const chartHeight = chartLayout === 'row' ? 228 : 258;

  // Window + axis hints. Memoized on `timeRange` alone — the hooks below floor
  // from/to to the nearest minute for their SWR keys so a sub-minute Date drift
  // can't churn the cache.
  const { from, to, axisFormat } = useMemo(() => computeChartWindow(timeRange), [timeRange]);
  const xAxisTicks = useMemo(() => computeAxisTicks(from, to, axisFormat), [from, to, axisFormat]);

  // Disable the 60s SWR background poll when the user picks a long time
  // range (>7 days). For long ranges, per-poll deltas aren't visible at
  // the chart's resolution, and re-firing aggregation queries against
  // millions of `sensor_data` rows every minute wastes DB cycles — the
  // exact pattern that triggered the May 28, 2026 incident. Short ranges
  // (≤7 days) get `undefined` here so each hook's own 60s default applies.
  // See pollingIntervalForRange's JSDoc for the full rationale.
  const refreshIntervalMs = pollingIntervalForRange(from, to);

  // Two feeds back the six charts. Both hooks live INSIDE this lazy panel, so
  // the network requests don't fire until the panel mounts — that's the LCP
  // win the lazy split is here for. We pull `isLoading` + `isValidating` from
  // each so the toolbar can show a selection-change loading badge below
  // (mirrors the sensor-measurements pattern).
  const {
    rows: healthRows,
    isLoading: healthLoading,
    isValidating: healthValidating
  } = useDeviceHealth(selectedPheNodeId, { from, to, fields: HEALTH_CHART_FIELDS, bucket: 'auto', refreshIntervalMs });
  const {
    rows: envRows,
    isLoading: envLoading,
    isValidating: envValidating
  } = useDeviceMeasurements(selectedPheNodeId, { from, to, fields: ENV_CHART_FIELDS, bucket: 'auto', refreshIntervalMs });

  // "User just changed the selection" tracker — feeds the toolbar loading
  // badge without flickering on the 60s SWR background poll. Mirrors
  // sensor-measurements:957-978.
  //
  // The composite key captures everything that changes the SWR query: the
  // selected device plus the active from/to window. When the key changes
  // (dropdown pick, time-range change), we flip isFetchingSelection on; when
  // BOTH feeds finish validating, we flip it off. Background polls don't
  // change the key, so the flag never flips and the badge stays quiet — even
  // though `isValidating` itself toggles every minute.
  const selectionKey = useMemo(
    () => `${selectedPheNodeId ?? ''}|${from?.getTime() ?? ''}|${to?.getTime() ?? ''}`,
    [selectedPheNodeId, from, to]
  );
  const previousSelectionKeyRef = useRef(selectionKey);
  const [isFetchingSelection, setIsFetchingSelection] = useState(false);
  useEffect(() => {
    if (previousSelectionKeyRef.current !== selectionKey) {
      setIsFetchingSelection(true);
      previousSelectionKeyRef.current = selectionKey;
    }
  }, [selectionKey]);
  useEffect(() => {
    if (isFetchingSelection && !healthValidating && !envValidating) {
      setIsFetchingSelection(false);
    }
  }, [isFetchingSelection, healthValidating, envValidating]);

  // Unified indicator flag. True during the first fetch for a fresh key
  // (no cached data yet) OR when the user just changed selection and the
  // resulting fetch is still in flight. Stays false during background polls
  // on a stable selection.
  const showSelectionLoading = healthLoading || envLoading || isFetchingSelection;

  const chartConfigs = useMemo(() => buildChartConfigs(displayPrefs), [displayPrefs]);

  // Series built ONCE per (configs × rows) and reused by every render until
  // the rows reference changes. The hooks' `compare: JSON.stringify` guard
  // keeps the reference stable across byte-identical SWR polls, so 60s
  // background polls cost zero series rebuilds in the no-op case.
  const chartSeries = useMemo(
    () =>
      chartConfigs.map((cfg) => {
        const rows = cfg.source === 'health' ? healthRows : envRows;
        return buildChartSeries(rows, cfg.key, cfg.transform);
      }),
    [chartConfigs, healthRows, envRows]
  );

  const hasChartData = chartSeries.some((s) => s.data.length > 0);
  const isHealthLoading = healthRows === undefined;
  const isEnvLoading = envRows === undefined;

  // CSV download — same shape as the sensor-measurements Download flow.
  const [downloading, setDownloading] = useState(false);
  const handleDownloadDiagnostics = useCallback(async () => {
    if (!selectedPheNodeId || downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadDeviceHealthData(selectedPheNodeId, from.toISOString(), to.toISOString(), accessToken);
      const label = (selectedDevice?.label || selectedPheNodeId).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'phenode';
      const extMatch = filename ? /\.([a-z0-9]+)$/i.exec(filename) : null;
      const ext = extMatch ? extMatch[1].toLowerCase() : 'csv';
      triggerBlobDownload(blob, `${label}_diagnostics.${ext}`);
      toast.success('Download started.');
    } catch (err) {
      if (err?.status === 404) {
        toast.error('No diagnostics data found in this date range.');
      } else {
        toast.error("Couldn't generate the download. Please try again.");
      }
    } finally {
      setDownloading(false);
    }
  }, [selectedPheNodeId, selectedDevice, from, to, accessToken, downloading, toast]);

  return (
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
        <Tooltip title="Orientation" arrow={false} slotProps={tooltipSlotProps}>
          <IconButton
            aria-label="toggle chart layout"
            onClick={() => setChartLayout((prev) => (prev === 'column' ? 'row' : 'column'))}
            sx={orientationButtonSx}
          >
            <AntIcon icon={AppstoreOutlined} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 220 }, width: { xs: '100%', sm: 220 }, flex: { xs: 1, sm: '0 0 auto' } }}>
          <Select
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value)}
            inputProps={{ 'aria-label': 'Diagnostics time range' }}
            sx={timeRangeSelectSx}
            MenuProps={{ PaperProps: neonSelectMenuPaperProps }}
            renderValue={(selected) => (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <AntIcon icon={ClockCircleOutlined} style={{ color: 'var(--blue)' }} />
                <Box component="span" sx={{ color: 'var(--green)' }}>
                  {selected}
                </Box>
              </Stack>
            )}
          >
            {CHART_TIME_RANGE_LABELS.map((option) => (
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
          title={hasChartData ? 'Download data for this time period' : 'No data to download'}
          arrow={false}
          slotProps={tooltipSlotProps}
        >
          <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
            <IconButton
              aria-label="download csv for this range"
              onClick={handleDownloadDiagnostics}
              disabled={!hasChartData || downloading || !selectedPheNodeId}
              sx={downloadButtonSx}
            >
              {downloading ? <CircularProgress size={16} sx={{ color: 'var(--green)' }} /> : <AntIcon icon={DownloadOutlined} />}
            </IconButton>
          </Box>
        </Tooltip>

        {/*
          Selection-change loading badge — sits next to the toolbar controls
          the user just changed, mirroring sensor-measurements:1555-1586. Only
          fires when the user's selection actually triggered a fetch (initial
          load or dropdown/time-range change); the 60s background SWR poll
          doesn't flip `isFetchingSelection`, so a quiet idle page stays quiet.
          Subtle fade-in so a quick fetch doesn't pop hard.
        */}
        {showSelectionLoading && (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              alignItems: 'center',
              color: 'var(--green)',
              '@keyframes phenode-loading-fade-in': {
                from: { opacity: 0 },
                to: { opacity: 1 }
              },
              animation: 'phenode-loading-fade-in 200ms ease-out'
            }}
            role="status"
            aria-live="polite"
          >
            <CircularProgress size={14} sx={{ color: 'var(--green)' }} />
            <Typography variant="caption" sx={{ color: 'var(--green)', textShadow: '0 0 6px rgba(72, 247, 245, 0.35)', fontWeight: 600 }}>
              Loading…
            </Typography>
          </Stack>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns:
            chartLayout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr'
        }}
      >
        {chartConfigs.map((cfg, idx) => {
          const { times, data } = chartSeries[idx];
          const hasData = data.length > 0;
          const isLoading = cfg.source === 'health' ? isHealthLoading : isEnvLoading;
          const emptyMessage = isLoading ? 'Loading…' : cfg.key === 'wifi_rssi' ? 'Awaiting Wi-Fi telemetry' : 'No data for this range';

          // CSS variables driving the shared chartSx:
          //   --chart-line-color → hover-indicator stroke + theming hooks.
          //   --chart-glow-filter → swap to lite-glow at high point counts.
          const glowFilter = data.length > LITE_GLOW_THRESHOLD ? 'url(#chart-glow-lite)' : 'url(#chart-glow-full)';

          return (
            <Box
              key={cfg.key}
              sx={{
                borderRadius: 1,
                p: { xs: 0.45, sm: 0.65 },
                minHeight: { xs: 260, sm: 286 },
                display: 'flex',
                flexDirection: 'column',
                ...reflectedCardChromeSx,
                ...chartSurfaceSx,
                '--chart-line-color': cfg.color,
                '--chart-glow-filter': glowFilter
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                {/*
                  component="div" — chart card titles are caption-like labels,
                  not document headings, and rendering them as <h6>s used to
                  extend the page's heading cascade past its h4 → h5 spine and
                  trip the Lighthouse heading-order audit. Visually identical.
                */}
                <Typography variant="subtitle1" component="div" sx={{ color: 'var(--blue)', ml: 1.25 }}>
                  {cfg.title}
                </Typography>
                <IconButton aria-label={`zoom ${cfg.title}`} size="small" sx={{ color: 'var(--blue)' }}>
                  <AntIcon icon={ZoomInOutlined} />
                </IconButton>
              </Stack>

              {hasData ? (
                <MeasurementChart
                  config={cfg}
                  seriesTimes={times}
                  seriesData={data}
                  xAxisMin={from}
                  xAxisMax={to}
                  xAxisTicks={xAxisTicks}
                  axisFormat={axisFormat}
                  height={chartHeight}
                  yAxisWidth={38}
                  xAxisFontSize={11}
                  yAxisFontSize={11}
                  marginTop={2}
                  marginRight={16}
                  marginBottom={10}
                  marginLeft={10}
                  idSuffix=""
                  timezone={displayPrefs.timezone}
                />
              ) : (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    flex: 1,
                    minHeight: chartHeight,
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    px: 2,
                    color: 'var(--blue)'
                  }}
                  role={isLoading ? 'status' : undefined}
                  aria-live={isLoading ? 'polite' : undefined}
                >
                  {/*
                    Per-chart empty state. When the data is still loading we
                    show a spinner alongside the text so the chart card visibly
                    "tries" — without it the small Typography alone reads as a
                    static "No data" rather than "still working on it." Once
                    loaded, the same Box just shows the appropriate message
                    (e.g. "Awaiting Wi-Fi telemetry").
                  */}
                  {isLoading && <CircularProgress size={18} sx={{ color: 'var(--green)' }} />}
                  <Typography variant="body2" sx={{ color: 'var(--blue)', opacity: 0.85 }}>
                    {emptyMessage}
                  </Typography>
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
