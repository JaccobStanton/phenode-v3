import { memo, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';

import AntIcon from 'components/AntIcon';
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';
import InfoCircleOutlined from '@ant-design/icons-svg/lib/asn/InfoCircleOutlined';
import ZoomInOutlined from '@ant-design/icons-svg/lib/asn/ZoomInOutlined';

import useMultiWirelessSensorMeasurements from 'hooks/data/useMultiWirelessSensorMeasurements';
import { reflectedCardChromeSx, tooltipSlotProps } from 'themes/sx-tokens';
import { axisTickNumberFor, formatAxisTick, formatTooltipDate } from 'utils/chartTimeRanges';
import { chartSx, makeYAxisFormatter, MeasurementChart } from 'sections/sensor-measurements/measurementChartCore';
import {
  buildWirelessSensorCatalog,
  wirelessFieldsForCharts,
  WIRELESS_CATEGORY_IDS
} from 'sections/wireless-sensors/wirelessSensorCatalog';

// =============================================================================
// WirelessMeasurementsPanel — categorized multi-sensor chart grid.
// =============================================================================
//
// Wireless-side equivalent of MeasurementTabPanel. Differences:
//   - Category is chosen via a dropdown, not tabs (per product direction).
//   - Multiple wireless sensors can be selected; every chart fans each catalog
//     series out per selected sensor, so a single-series catalog chart with 3
//     sensors selected renders 3 lines, and a multi-series catalog chart
//     (e.g. soil-profile depths × 4, accelerometer × 3) renders N × M lines.
//   - Only the wireless time-series endpoint is consulted — the panel passes
//     `wirelessSensorIds` to a single composite SWR hook that fans the HTTP
//     requests out in parallel.

const chartCardSx = {
  borderRadius: 1,
  p: { xs: 0.45, sm: 0.65 },
  minHeight: { xs: 265, sm: 268 },
  display: 'flex',
  flexDirection: 'column',
  ...reflectedCardChromeSx,
  backgroundColor: '#07143f',
  backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
  border: '1px solid #0e346a'
};

// Palette used when more than one rendered line shares a chart. Picks a color
// per (sensor × series) combo; single-sensor + single-series falls back to
// the catalog's own color so the chart matches the device-side look.
const SENSOR_PALETTE = [
  '#48f7f5',
  '#c96cfc',
  '#f4d04b',
  '#34d399',
  '#fb7185',
  '#60a5fa',
  '#fbbf24',
  '#a78bfa',
  '#22d3ee',
  '#f87171',
  '#84cc16',
  '#ec4899'
];

function pickColor({ sensorIdx, seriesIdx, nSensors, nSeries, seriesColor, chartColor }) {
  // Prefer the catalog-declared seriesColor whenever it exists — it carries
  // the per-probe / per-axis stroke the catalog explicitly chose (e.g. Probe 1
  // = var(--blue), Probe 2 = var(--purple)). Otherwise fall back to the
  // chart-level color, then to the per-sensor palette. Without this, filtering
  // a two-probe soil chart down to a single probe would lose the catalog
  // color and snap to SENSOR_PALETTE[0] (cyan-green), so Probe 1 alone and
  // Probe 2 alone both rendered in the same green stroke.
  if (nSensors === 1 && nSeries === 1) return seriesColor || chartColor || SENSOR_PALETTE[0];
  if (nSensors === 1) return seriesColor || SENSOR_PALETTE[seriesIdx % SENSOR_PALETTE.length];
  if (nSeries === 1) return SENSOR_PALETTE[sensorIdx % SENSOR_PALETTE.length];
  return SENSOR_PALETTE[(sensorIdx * nSeries + seriesIdx) % SENSOR_PALETTE.length];
}

// Build one rendered chart's data structure from N sensors × M catalog series.
// Returns { times, lines } in the same shape MeasurementTabPanel's
// buildAlignedSeries returns — union-of-non-null timestamps so the tooltip
// always has a real value to snap to.
// Probe filter — when the user has the Both / Probe 1 / Probe 2 toggle set to
// a specific probe, drop the series whose field belongs to the *other* probe.
// Identification key is the field-name suffix (`_1` / `_2`) which the catalog
// uses consistently for the four two-probe soil families. Depth-series like
// `sensor1_d3_vwc` end in `_vwc`/`_temp` and are unaffected.
function applyProbeFilter(seriesDefs, probeFilter) {
  if (probeFilter === '1') return seriesDefs.filter((s) => !s.field?.endsWith('_2'));
  if (probeFilter === '2') return seriesDefs.filter((s) => !s.field?.endsWith('_1'));
  return seriesDefs;
}

// Temp-sensor source filter — keep only the chosen onboard sensor's line when
// the user picks Primary / Aux. Keyed on the series LABELS the ambient-
// temperature chart uses ('Primary' = MCP9808, 'Aux' = BME688, per the sensor-
// hierarchy sheet). 'both' keeps everything; charts without those labels (soil
// probes, single-source) are untouched, and we never blank a chart if nothing matches.
function applySourceFilter(seriesDefs, sourceFilter) {
  if (sourceFilter === 'both') return seriesDefs;
  const hasSourceLabels = seriesDefs.some((s) => s.label === 'Primary' || s.label === 'Aux');
  if (!hasSourceLabels) return seriesDefs;
  const wanted = sourceFilter === 'primary' ? 'Primary' : 'Aux';
  // Return the filtered set even when empty — a chart with no line for the
  // chosen source shows its empty state rather than falling back to all lines
  // (which left other lines rendering under "Aux"). Single-source charts were
  // already returned untouched above.
  return seriesDefs.filter((s) => s.label === wanted);
}

// Does any selected sensor carry a non-null reading for this field? Used to
// decide which source/probe toggle buttons are actually usable on the current
// sensor selection.
function wirelessFieldHasData(rowsBySensor, sensorList, field) {
  if (!field) return false;
  for (const sensor of sensorList ?? []) {
    const rows = rowsBySensor?.[sensor.external_sensor_id]?.rows || [];
    for (const r of rows) {
      const v = r.fields?.[field]?.avg;
      if (v !== null && v !== undefined) return true;
    }
  }
  return false;
}

function buildMultiSensorLines(rowsBySensor, chart, sensorList, probeFilter = 'both', sourceFilter = 'both') {
  const rawSeriesDefs =
    Array.isArray(chart.series) && chart.series.length
      ? chart.series
      : [{ field: chart.primaryField, label: chart.title, color: chart.color, transform: chart.transform }];
  const seriesDefs = applySourceFilter(applyProbeFilter(rawSeriesDefs, probeFilter), sourceFilter);

  const nSensors = sensorList.length;
  const nSeries = seriesDefs.length;
  const isMultiSensor = nSensors > 1;
  // `isMultiSeriesOriginal` looks at the CATALOG (pre-filter) shape, not the
  // post-filter shape. A two-probe soil chart that the user has filtered down
  // to just Probe 1 still came from a multi-series catalog config, and the
  // user expects the "Probe 1" tag to remain visible on the chart card. If we
  // keyed off the post-filter count, the chart's only line would lose its
  // probe label as soon as the user picked a specific probe — which is the
  // exact bug Jake hit (Apr 2026 chart-toolbar refactor).
  const isMultiSeriesOriginal = rawSeriesDefs.length > 1;

  // Per (sensor × series) line as a Map<isoTime, transformedValue>.
  const lineDescriptors = [];
  for (let si = 0; si < nSensors; si++) {
    const sensor = sensorList[si];
    const rows = rowsBySensor?.[sensor.external_sensor_id]?.rows || [];
    for (let fi = 0; fi < nSeries; fi++) {
      const f = seriesDefs[fi];
      const tf = f.transform ?? chart.transform ?? ((v) => v);
      const map = new Map();
      for (const r of rows) {
        const v = r.fields?.[f.field]?.avg;
        if (v === null || v === undefined) continue;
        map.set(r.time, tf(v));
      }
      if (!map.size) continue;
      let label;
      if (isMultiSensor && isMultiSeriesOriginal) label = `${sensor.label} · ${f.label || chart.title}`;
      else if (isMultiSensor) label = sensor.label;
      else if (isMultiSeriesOriginal) label = f.label;
      else label = sensor.label || chart.title;
      const color = pickColor({
        sensorIdx: si,
        seriesIdx: fi,
        nSensors,
        nSeries,
        seriesColor: f.color,
        chartColor: chart.color
      });
      lineDescriptors.push({ label, color, map });
    }
  }

  // Union of every line's non-null timestamps, sorted ascending. This is what
  // makes the multi-series tooltip work (see MeasurementTabPanel's
  // buildAlignedSeries — same rationale).
  const unionIso = new Set();
  for (const l of lineDescriptors) for (const t of l.map.keys()) unionIso.add(t);
  // Chronological (numeric) sort, NOT lexicographic — raw-mode timestamps mix
  // "…Z" and "….123456Z" precision, and a string .sort() misorders them, which
  // breaks the hover crosshair's sorted-array assumption. See the matching note
  // in MeasurementTabPanel.buildAlignedSeries.
  const sortedIso = [...unionIso].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const times = sortedIso.map((t) => new Date(t));

  const lines = lineDescriptors.map((l) => ({
    label: l.label,
    color: l.color,
    values: sortedIso.map((t) => l.map.get(t) ?? null)
  }));

  return { times, lines };
}

const emptyBodySx = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--blue)',
  fontSize: '0.85rem',
  fontStyle: 'italic',
  textAlign: 'center',
  px: 1.5,
  minHeight: 180
};

function renderChartBody(chart, lines, times, { from, to, xAxisTicks, axisFormat, height, idSuffix, timezone }) {
  if (chart.availability === 'needs-backend') {
    return <Box sx={emptyBodySx}>Sensor not connected — no data available yet</Box>;
  }
  if (!lines.length || !times.length) {
    return <Box sx={emptyBodySx}>No data for this time range</Box>;
  }

  const tickNumber = axisTickNumberFor(axisFormat);
  const baseX = {
    scaleType: 'time',
    tickNumber,
    tickInterval: xAxisTicks,
    domainLimit: 'strict',
    tickLabelStyle: { fontSize: 11, fill: 'var(--green)' },
    valueFormatter: (value, ctx) =>
      ctx?.location === 'tooltip' ? formatTooltipDate(value, timezone) : formatAxisTick(value, axisFormat, timezone)
  };

  // A chart is "originally multi-series" when the catalog declared more than
  // one series for it (e.g. the two-probe soil charts). When the user has
  // filtered down to a single line via the probe toggle, we still want the
  // MUI legend to render so the in-chart "Probe 1" / "Probe 2" key stays
  // visible. Falling through the single-line MeasurementChart branch below
  // would drop that legend, leaving the user without a label.
  const isOriginallyMulti = Array.isArray(chart.series) && chart.series.length > 1;

  // Single rendered line → use the shared MeasurementChart for pixel-parity
  // with the device-side single-series charts (area glow on, no legend).
  // SKIPPED for originally-multi charts so the legend persists across
  // probe-filter changes.
  if (lines.length === 1 && !isOriginallyMulti) {
    const line = lines[0];
    // Filter out the nulls so MeasurementChart's null-free path renders the
    // area cleanly. The values array here is aligned to `times`, but since
    // there's only one series, `connectNulls` isn't needed — we can hand
    // MeasurementChart a compact (times, values) pair.
    const compactTimes = [];
    const compactValues = [];
    for (let i = 0; i < line.values.length; i++) {
      const v = line.values[i];
      if (v === null || v === undefined) continue;
      compactTimes.push(times[i]);
      compactValues.push(v);
    }
    if (!compactValues.length) return <Box sx={emptyBodySx}>No data for this time range</Box>;
    return (
      <MeasurementChart
        config={{ key: chart.key, unit: chart.unit, color: line.color }}
        seriesTimes={compactTimes}
        seriesData={compactValues}
        xAxisMin={compactTimes[0]}
        xAxisMax={compactTimes[compactTimes.length - 1]}
        xAxisTicks={xAxisTicks}
        axisFormat={axisFormat}
        height={height}
        yAxisWidth={56}
        xAxisFontSize={11}
        yAxisFontSize={11}
        marginTop={8}
        marginRight={8}
        marginBottom={0}
        marginLeft={0}
        idSuffix={idSuffix}
        timezone={timezone}
      />
    );
  }

  // Multi-line → local LineChart with the same chartSx + null-skip
  // valueFormatter for tooltip clean-up.
  const allVals = lines.flatMap((l) => l.values).filter((v) => v !== null && v !== undefined);
  const minVal = allVals.length ? Math.min(...allVals) : 0;
  const maxVal = allVals.length ? Math.max(...allVals) : 1;
  const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

  return (
    <LineChart
      xAxis={[{ ...baseX, data: times, min: from, max: to }]}
      yAxis={[
        {
          min: minVal - pad,
          max: maxVal + pad,
          width: 56,
          tickLabelStyle: { fontSize: 11, fill: 'var(--green)' },
          valueFormatter: makeYAxisFormatter(chart.unit)
        }
      ]}
      series={lines.map((l, i) => ({
        id: `${chart.key}-l${i}${idSuffix}`,
        data: l.values,
        label: l.label,
        color: l.color,
        // Line + glow only — no area fill (per Jake). A series with a single
        // non-null reading can't form a line segment, so show a marker for it
        // (otherwise the value appears on hover but nothing renders).
        area: false,
        showMark: l.values.reduce((n, v) => (v === null || v === undefined ? n : n + 1), 0) < 2,
        curve: 'linear',
        connectNulls: true,
        valueFormatter: (value) =>
          value === null || value === undefined ? null : `${Number(value).toFixed(2)}${chart.unit ? ` ${chart.unit}` : ''}`
      }))}
      grid={{ horizontal: true, vertical: true }}
      height={height}
      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      hideLegend={lines.length < 2}
      slotProps={lines.length >= 2 ? { legend: { labelStyle: { fontSize: 11, fill: 'var(--green)' } } } : undefined}
      sx={chartSx}
    />
  );
}

// One grid card — title + info + enlarge + chart body.
const ChartCard = memo(function ChartCard({
  chart,
  lines,
  times,
  from,
  to,
  xAxisTicks,
  axisFormat,
  height,
  glowFilterVar,
  onEnlarge,
  timezone
}) {
  const titleColor = lines.length === 1 ? lines[0].color : (chart.color ?? '#48f7f5');
  return (
    <Box style={{ '--chart-line-color': titleColor, '--chart-glow-filter': glowFilterVar }} sx={chartCardSx}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
        <Typography variant="subtitle1" component="p" sx={{ color: 'var(--blue)', ml: 1.25, display: 'inline-flex', alignItems: 'center' }}>
          {chart.title}
          {chart.unit ? (
            <Box component="span" sx={{ color: 'var(--green)', ml: 0.75, fontSize: '0.85em' }}>
              ({chart.unit})
            </Box>
          ) : null}
          {chart.info ? (
            <Tooltip title={chart.info} arrow={false} slotProps={tooltipSlotProps}>
              <Box
                component="span"
                aria-label={chart.info}
                sx={{
                  ml: 0.6,
                  color: 'var(--blue)',
                  display: 'inline-flex',
                  fontSize: '0.85em',
                  cursor: 'help',
                  '&:hover': { color: 'var(--green)' }
                }}
              >
                <AntIcon icon={InfoCircleOutlined} />
              </Box>
            </Tooltip>
          ) : null}
        </Typography>
        <Tooltip title="Enlarge" arrow={false} slotProps={tooltipSlotProps}>
          <IconButton
            aria-label={`enlarge ${chart.title} chart`}
            size="small"
            onClick={() => onEnlarge(chart.key)}
            sx={{ color: 'var(--blue)', '&:hover': { color: 'var(--green)' } }}
          >
            <AntIcon icon={ZoomInOutlined} />
          </IconButton>
        </Tooltip>
      </Stack>
      {renderChartBody(chart, lines, times, { from, to, xAxisTicks, axisFormat, height, idSuffix: '', timezone })}
    </Box>
  );
});

/**
 * @param {Array<{external_sensor_id, label}>} wirelessSensors  Selected sensors (1..N).
 * @param {Object} displayPrefs  From useDisplayPreferences — drives unit labels + transforms.
 * @param {Date}   from
 * @param {Date}   to
 * @param {string} axisFormat
 * @param {number[]|undefined} xAxisTicks
 * @param {'row'|'column'} layout
 * @param {string|null} timezone
 * @param {string}  selectedCategory  Active category id (lifted to the parent
 *                                    toolbar). Defaults to WEATHER if omitted.
 * @param {string}  selectedProbe     'both' | '1' | '2'. Defaults to 'both'.
 */
export default function WirelessMeasurementsPanel({
  wirelessSensors,
  displayPrefs,
  from,
  to,
  axisFormat,
  xAxisTicks,
  layout = 'row',
  timezone = null,
  selectedCategory = WIRELESS_CATEGORY_IDS.WEATHER,
  selectedProbe = 'both',
  selectedSource = 'both',
  // Reports which source (Primary/Aux) and probe (1/2) filters have data on the
  // current sensor selection, so the parent can hide useless toggle buttons.
  onAvailableFilters
}) {
  const [enlargedKey, setEnlargedKey] = useState(null);

  const catalog = useMemo(() => buildWirelessSensorCatalog(displayPrefs), [displayPrefs]);
  const activeCategory = useMemo(() => catalog.find((c) => c.id === selectedCategory) || catalog[0], [catalog, selectedCategory]);
  // Wrap so the array reference stays stable when the category hasn't changed
  // — otherwise the `|| []` fallback creates a new array each render and
  // busts the downstream `linesByChart` / `fieldsKey` memos. The 'all'
  // selection bypasses `activeCategory` entirely and concatenates every
  // category's charts into one grid.
  const activeCharts = useMemo(() => {
    if (selectedCategory === WIRELESS_CATEGORY_IDS.ALL) {
      return catalog.flatMap((c) => c.charts ?? []);
    }
    return activeCategory?.charts || [];
  }, [selectedCategory, catalog, activeCategory]);

  const fieldsKey = useMemo(() => wirelessFieldsForCharts(activeCharts).join(','), [activeCharts]);
  const fields = useMemo(() => (fieldsKey ? fieldsKey.split(',') : []), [fieldsKey]);

  const sensorIds = useMemo(() => (wirelessSensors ?? []).map((s) => s.external_sensor_id).filter(Boolean), [wirelessSensors]);

  const { rowsBySensor, isLoading, error } = useMultiWirelessSensorMeasurements(sensorIds, {
    from,
    to,
    fields,
    bucket: 'auto'
  });

  // Pre-build (times, lines) per chart so the enlarge dialog reuses the same
  // derived shape without re-walking the rows.
  const linesByChart = useMemo(() => {
    const out = {};
    for (const chart of activeCharts) {
      out[chart.key] = buildMultiSensorLines(rowsBySensor, chart, wirelessSensors ?? [], selectedProbe, selectedSource);
    }
    return out;
  }, [activeCharts, rowsBySensor, wirelessSensors, selectedProbe, selectedSource]);

  // Which source/probe filters actually have data on the current sensor
  // selection — drives the parent's hiding of toggle buttons (and the whole
  // toggle) that would filter to nothing.
  const availableFilters = useMemo(() => {
    const avail = { primary: false, aux: false, probe1: false, probe2: false };
    for (const chart of activeCharts) {
      if (!Array.isArray(chart.series)) continue;
      for (const s of chart.series) {
        if (!wirelessFieldHasData(rowsBySensor, wirelessSensors ?? [], s.field)) continue;
        if (s.label === 'Primary') avail.primary = true;
        else if (s.label === 'Aux') avail.aux = true;
        if (s.field?.endsWith('_1')) avail.probe1 = true;
        else if (s.field?.endsWith('_2')) avail.probe2 = true;
      }
    }
    return avail;
  }, [activeCharts, rowsBySensor, wirelessSensors]);

  useEffect(() => {
    if (onAvailableFilters) onAvailableFilters(availableFilters);
  }, [availableFilters, onAvailableFilters]);

  // Always full-strength glow, matching the device charts (kept identical so the
  // line glow looks the same across both surfaces).
  const glowFilterVar = 'url(#chart-glow-full)';

  const enlargedChart = enlargedKey ? (activeCharts.find((c) => c.key === enlargedKey) ?? null) : null;

  // ---------------------------------------------------------------------------

  if (!sensorIds.length) {
    return (
      <Box
        sx={{
          minHeight: { xs: 280, md: 340 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--blue)',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2
        }}
      >
        Select one or more wireless sensors above to see their measurements.
      </Box>
    );
  }

  if (isLoading && !rowsBySensor) {
    return (
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ minHeight: { xs: 280, md: 340 }, alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}
        role="status"
        aria-live="polite"
      >
        <CircularProgress size={22} sx={{ color: 'var(--green)' }} />
        <Box component="span">Loading chart data…</Box>
      </Stack>
    );
  }

  if (error && !rowsBySensor) {
    return (
      <Box
        sx={{
          minHeight: { xs: 280, md: 340 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--orange)',
          fontStyle: 'italic'
        }}
        role="alert"
      >
        Failed to load chart data
      </Box>
    );
  }

  const height = layout === 'row' ? 228 : 258;
  const columns = layout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr';

  return (
    <>
      {/*
        Category dropdown + Probe toggle live in the parent toolbar
        (sensor-network.jsx) so they sit on the same row as the time-range
        Select and the Download button. This panel just renders the chart grid
        for the selectedCategory / selectedProbe combination it receives.
      */}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: columns }}>
        {activeCharts.map((chart) => {
          const { times, lines } = linesByChart[chart.key] || { times: [], lines: [] };
          return (
            <ChartCard
              key={chart.key}
              chart={chart}
              lines={lines}
              times={times}
              from={from}
              to={to}
              xAxisTicks={xAxisTicks}
              axisFormat={axisFormat}
              height={height}
              glowFilterVar={glowFilterVar}
              onEnlarge={setEnlargedKey}
              timezone={timezone}
            />
          );
        })}
      </Box>

      {/* Enlarge dialog — same chart at 460px height. */}
      <Dialog
        open={Boolean(enlargedChart)}
        onClose={() => setEnlargedKey(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: '#07143f',
              backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
              border: '1px solid #0e346a'
            }
          }
        }}
      >
        {enlargedChart && (
          <>
            <DialogTitle sx={{ color: 'var(--blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                {enlargedChart.title}
                {enlargedChart.unit ? (
                  <Box component="span" sx={{ color: 'var(--green)', ml: 0.75, fontSize: '0.85em' }}>
                    ({enlargedChart.unit})
                  </Box>
                ) : null}
                {enlargedChart.info ? (
                  <Tooltip title={enlargedChart.info} arrow={false} slotProps={tooltipSlotProps}>
                    <Box
                      component="span"
                      aria-label={enlargedChart.info}
                      sx={{
                        ml: 0.6,
                        color: 'var(--blue)',
                        display: 'inline-flex',
                        fontSize: '0.8em',
                        cursor: 'help',
                        '&:hover': { color: 'var(--green)' }
                      }}
                    >
                      <AntIcon icon={InfoCircleOutlined} />
                    </Box>
                  </Tooltip>
                ) : null}
              </Box>
              <IconButton
                aria-label="close enlarged chart"
                onClick={() => setEnlargedKey(null)}
                sx={{ color: 'var(--blue)', '&:hover': { color: 'var(--green)' } }}
              >
                <AntIcon icon={CloseOutlined} />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box style={{ '--chart-glow-filter': glowFilterVar }}>
                {renderChartBody(
                  enlargedChart,
                  linesByChart[enlargedChart.key]?.lines ?? [],
                  linesByChart[enlargedChart.key]?.times ?? [],
                  {
                    from,
                    to,
                    xAxisTicks,
                    axisFormat,
                    height: 460,
                    idSuffix: '-lg',
                    timezone
                  }
                )}
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
