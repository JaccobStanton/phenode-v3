import { memo, useMemo, useState } from 'react';

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
import { ScatterChart } from '@mui/x-charts/ScatterChart';

import AntIcon from 'components/AntIcon';
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';
import InfoCircleOutlined from '@ant-design/icons-svg/lib/asn/InfoCircleOutlined';
import ZoomInOutlined from '@ant-design/icons-svg/lib/asn/ZoomInOutlined';

import useDeviceMeasurements from 'hooks/data/useDeviceMeasurements';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import useWirelessSensorMeasurements from 'hooks/data/useWirelessSensorMeasurements';
import { reflectedCardChromeSx, tooltipSlotProps } from 'themes/sx-tokens';
import { axisTickNumberFor, formatAxisTick, formatTooltipDate, pollingIntervalForRange } from 'utils/chartTimeRanges';
import { chartSx, makeYAxisFormatter, MeasurementChart } from 'sections/sensor-measurements/measurementChartCore';
import { fieldProjectionsForCharts } from 'sections/sensor-measurements/measurementCatalog';

// =============================================================================
// MeasurementTabPanel — catalog-driven chart grid for every tab.
// =============================================================================
//
// Single-series LINE charts render through the shared MeasurementChart from
// measurementChartCore — the exact component the Weather grid used — so the
// styling (glow filter, 0.16 area fill, hover highlight, y-padding) is
// identical, not approximated. Multi-series overlays (soil-profile depths,
// accelerometer axes, Calypso vs Atmos), the GDD step series, and the
// wind-direction scatter use local renderers that share the same `chartSx`.
//
// The panel owns its data fetching: it derives a per-source field projection
// from the tab's charts and requests ONLY those columns. A source the tab
// doesn't use gets a null id so its hook skips the fetch entirely. Each card
// has an enlarge button that opens a themed Dialog with the same chart at full
// width — matching the Weather grid's enlarge affordance.

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

// Single-series: null-filtered {times, values} so the line is continuous and
// the X-axis hugs the data extent (matches the Weather grid's per-field
// series build).
function buildSingleSeries(rows, field, transform) {
  const tf = transform ?? ((v) => v);
  const times = [];
  const values = [];
  for (const r of rows ?? []) {
    const v = r.fields?.[field]?.avg;
    if (v === null || v === undefined) continue;
    times.push(new Date(r.time));
    values.push(tf(v));
  }
  return { times, values };
}

// Multi-series / step: all series share ONE timestamp array (required because
// MUI x-charts series within a chart share one xAxis.data). To make tooltips
// reliably resolve, we build `times` as the UNION of all series' non-null
// timestamps — NOT every row in the response. Without this, sparse fields
// (e.g. soil probes reporting 23 of 144 rows) leave most snapped tooltip
// indices all-null, the null formatter then filters every row, and the user
// gets no tooltip card and no marker.
//
// With the union, every snapped index has at least one series with a real
// value; the other series gets `null` where its cadence doesn't line up with
// the first, `connectNulls: true` bridges that gap visually, and the null
// formatter in renderChartBody hides the missing series cleanly from the
// tooltip row list.
function buildAlignedSeries(rows, chart) {
  const fields =
    Array.isArray(chart.series) && chart.series.length
      ? chart.series
      : [{ field: chart.primaryField, label: chart.title, color: chart.color, transform: chart.transform }];

  // Per-series: collect Map<isoTime, transformedValue> of NON-null readings.
  // Filter out series with zero readings up front so the chart never plots a
  // legend entry for a probe that has no data on this device.
  const seriesData = fields
    .map((f) => {
      const tf = f.transform ?? chart.transform ?? ((v) => v);
      const map = new Map();
      for (const r of rows ?? []) {
        const v = r.fields?.[f.field]?.avg;
        if (v === null || v === undefined) continue;
        map.set(r.time, tf(v));
      }
      return { label: f.label, color: f.color ?? chart.color, map };
    })
    .filter((s) => s.map.size > 0);

  // Union of non-null timestamps across all series, ascending.
  const unionIsoTimes = new Set();
  for (const s of seriesData) {
    for (const t of s.map.keys()) unionIsoTimes.add(t);
  }
  const sortedIsoTimes = [...unionIsoTimes].sort();
  const times = sortedIsoTimes.map((t) => new Date(t));

  // Each series' values aligned to the union; null where that series has no
  // reading at a given union timestamp (only happens when series report on
  // different cadences). connectNulls bridges those gaps visually.
  const lines = seriesData.map((s) => ({
    label: s.label,
    color: s.color,
    values: sortedIsoTimes.map((t) => s.map.get(t) ?? null)
  }));

  return { times, lines };
}

// Scatter points per series — supports both single-source (chart.primaryField)
// and multi-source (chart.series) configs. Returns one {label, color, points}
// entry per series with non-null points only; empty series are filtered.
function buildScatterSeries(rows, chart) {
  const seriesDefs =
    Array.isArray(chart.series) && chart.series.length
      ? chart.series
      : [{ field: chart.primaryField, label: chart.title, color: chart.color, transform: chart.transform }];
  return seriesDefs
    .map((f, sIdx) => {
      const tf = f.transform ?? chart.transform ?? ((v) => v);
      const points = [];
      (rows ?? []).forEach((r, rIdx) => {
        const v = r.fields?.[f.field]?.avg;
        if (v === null || v === undefined) return;
        // Sibling-field lookup (e.g. compassField) — used by the wind-direction
        // tooltip to read the backend-derived compass string off the same row
        // as the degree value. Stays a plain string so it round-trips through
        // MUI x-charts' point objects untouched.
        const sibling = f.compassField ? (r.fields?.[f.compassField]?.avg ?? null) : null;
        points.push({ x: new Date(r.time), y: tf(v), id: `${sIdx}-${rIdx}`, compass: sibling });
      });
      return { label: f.label, color: f.color ?? chart.color, points };
    })
    .filter((s) => s.points.length > 0);
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

// Render just the chart body (no card chrome) for a chart — reused by both the
// grid card and the enlarge Dialog at different heights. `idSuffix` keeps the
// two instances from colliding on MUI's internal axis/series ids.
function renderChartBody(chart, rows, { from, to, xAxisTicks, axisFormat, height, idSuffix, timezone }) {
  if (chart.availability === 'needs-backend') {
    return <Box sx={emptyBodySx}>Sensor not connected — no data available yet</Box>;
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

  if (chart.chartType === 'scatter') {
    const scatterLines = buildScatterSeries(rows, chart);
    if (!scatterLines.length) return <Box sx={emptyBodySx}>No data for this time range</Box>;
    const isMultiScatter = scatterLines.length > 1;
    // When the catalog declares a custom formatter (e.g. wind direction's
    // degrees → compass headings), use it for both the Y-axis ticks and the
    // tooltip value. Falls back to the standard numeric/unit formatter for
    // any future scatter chart that doesn't need translation.
    const yAxisValueFormatter = chart.yAxisValueFormatter ?? makeYAxisFormatter(chart.unit);
    // Catalog hook: pointValueFormatter receives (value, point) so it can read
    // sibling fields (compass string, etc.) for richer tooltips. Default keeps
    // the original numeric+unit shape for every other scatter.
    const pointValueFormatter =
      chart.pointValueFormatter ?? ((value) => (value == null ? null : `${Number(value).toFixed(0)}${chart.unit ? ` ${chart.unit}` : ''}`));
    return (
      <ScatterChart
        xAxis={[{ ...baseX, min: from, max: to }]}
        yAxis={[
          {
            width: 56,
            min: 0,
            max: 360,
            // Snap ticks to the 8-point compass (every 45°) so the axis reads
            // N, NE, E, SE, S, SW, W, NW evenly. tickInterval as a numeric
            // array tells MUI x-charts to use exactly these values.
            ...(chart.yAxisValueFormatter ? { tickInterval: [0, 45, 90, 135, 180, 225, 270, 315] } : null),
            tickLabelStyle: { fontSize: 11, fill: 'var(--green)' },
            valueFormatter: yAxisValueFormatter
          }
        ]}
        series={scatterLines.map((s, i) => ({
          id: `${chart.key}-scatter-${i}${idSuffix}`,
          data: s.points,
          label: isMultiScatter ? s.label : undefined,
          color: s.color,
          markerSize: 3,
          // Receives the scatter point ({ x, y, id, compass? }); forward the
          // y value AND the point itself so catalog formatters can pull
          // sibling fields (e.g. point.compass for wind direction).
          valueFormatter: (p) => (p == null ? null : pointValueFormatter(p.y, p))
        }))}
        grid={{ horizontal: true, vertical: true }}
        height={height}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        hideLegend={!isMultiScatter}
        slotProps={isMultiScatter ? { legend: { labelStyle: { fontSize: 11, fill: 'var(--green)' } } } : undefined}
        sx={chartSx}
      />
    );
  }

  const isMulti = Array.isArray(chart.series) && chart.series.length > 1;

  // Single-series line → the SHARED MeasurementChart (pixel-identical to the
  // Weather grid). Its X-axis hugs the data extent and it computes y-padding
  // + area fill internally.
  if (!isMulti && chart.chartType !== 'step') {
    const { times, values } = buildSingleSeries(rows, chart.primaryField, chart.transform);
    if (!values.length) return <Box sx={emptyBodySx}>No data for this time range</Box>;
    return (
      <MeasurementChart
        config={{ key: chart.key, unit: chart.unit, color: chart.color }}
        seriesTimes={times}
        seriesData={values}
        xAxisMin={times[0]}
        xAxisMax={times[times.length - 1]}
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

  // Multi-series overlay OR step (GDD). Aligned arrays + connectNulls.
  const { times, lines } = buildAlignedSeries(rows, chart);
  if (!lines.length || !times.length) return <Box sx={emptyBodySx}>No data for this time range</Box>;
  const allVals = lines.flatMap((l) => l.values).filter((v) => v !== null && v !== undefined);
  const minVal = allVals.length ? Math.min(...allVals) : 0;
  const maxVal = allVals.length ? Math.max(...allVals) : 1;
  const pad = Math.max(0.1, (maxVal - minVal) * 0.04);
  const curve = chart.chartType === 'step' ? 'stepAfter' : 'linear';

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
      // `renderedAsMulti` keys off the actual rendered series count, NOT the
      // catalog declaration. If a chart declares two probes but only one has
      // data on this device, lines.length === 1 → render it like a single-
      // series chart (area glow on, no legend) for visual parity with the
      // other charts. With both lines, drop the area fill so overlapping
      // translucent bands don't muddy the chart.
      series={lines.map((l, i) => {
        const renderedAsMulti = lines.length > 1;
        return {
          id: `${chart.key}-l${i}${idSuffix}`,
          data: l.values,
          label: renderedAsMulti ? l.label : undefined,
          color: l.color,
          area: !renderedAsMulti,
          showMark: chart.chartType === 'step',
          curve,
          connectNulls: true,
          // Return `null` (not "No data") for null values so MUI's default
          // tooltip skips the entry entirely — see
          // node_modules/@mui/x-charts/esm/ChartsTooltip/ChartsAxisTooltipContent.js
          // line 41 (`if (formattedValue == null) return null`). Otherwise the
          // chart's connectNulls=true visually bridges gaps but the tooltip
          // still says "No data" at every hovered position with no underlying
          // sample, which is misleading.
          valueFormatter: (value) =>
            value === null || value === undefined ? null : `${Number(value).toFixed(2)}${chart.unit ? ` ${chart.unit}` : ''}`
        };
      })}
      grid={{ horizontal: true, vertical: true }}
      height={height}
      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      hideLegend={lines.length < 2}
      slotProps={lines.length > 1 ? { legend: { labelStyle: { fontSize: 11, fill: 'var(--green)' } } } : undefined}
      sx={chartSx}
    />
  );
}

// One grid card: title + enlarge button + chart body. Memoized so a 60s poll
// or tab fidget doesn't redraw cards whose data + window are unchanged.
const CatalogCard = memo(function CatalogCard({
  chart,
  rows,
  from,
  to,
  xAxisTicks,
  axisFormat,
  height,
  glowFilterVar,
  timezone,
  onEnlarge
}) {
  return (
    <Box style={{ '--chart-line-color': chart.color ?? '#48f7f5', '--chart-glow-filter': glowFilterVar }} sx={chartCardSx}>
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
      {renderChartBody(chart, rows, { from, to, xAxisTicks, axisFormat, height, idSuffix: '', timezone })}
    </Box>
  );
});

/**
 * @param {Object[]} charts      Resolved chart configs (from buildMeasurementCatalog).
 * @param {string|null} deviceId Selected PheNode external id.
 * @param {string|null} wirelessSensorId Auto-picked primary wireless sensor external id.
 * @param {Date} from
 * @param {Date} to
 * @param {string} axisFormat
 * @param {number[]|undefined} xAxisTicks
 * @param {'row'|'column'} layout
 */
export default function MeasurementTabPanel({ charts, deviceId, wirelessSensorId, from, to, axisFormat, xAxisTicks, layout = 'row' }) {
  const [enlargedKey, setEnlargedKey] = useState(null);

  // Chart axes + tooltips render in the user's Display preference timezone.
  // Null falls back to the browser's local zone (resolveTimezone handles it).
  const { timezone } = useDisplayPreferences();

  const { device: deviceFields, wireless: wirelessFields } = useMemo(() => fieldProjectionsForCharts(charts), [charts]);
  const needDevice = deviceFields.length > 0;
  const needWireless = wirelessFields.length > 0;

  // Disable the 60s SWR background poll when the user picks a long time
  // range (>7 days). For long ranges, per-poll deltas aren't visible at
  // the chart's resolution, and re-firing aggregation queries against
  // millions of `sensor_data` rows every minute wastes DB cycles — the
  // exact pattern that triggered the May 28, 2026 incident. Short ranges
  // (≤7 days) get `undefined` here so the hook's own 60s default applies.
  // See pollingIntervalForRange's JSDoc for the full rationale.
  const refreshIntervalMs = pollingIntervalForRange(from, to);

  const {
    rows: deviceRows,
    isLoading: deviceLoading,
    error: deviceError
  } = useDeviceMeasurements(needDevice ? deviceId : null, { from, to, fields: deviceFields, bucket: 'auto', refreshIntervalMs });

  const {
    rows: wirelessRows,
    isLoading: wirelessLoading,
    error: wirelessError
  } = useWirelessSensorMeasurements(needWireless ? wirelessSensorId : null, {
    from,
    to,
    fields: wirelessFields,
    bucket: 'auto',
    refreshIntervalMs
  });

  const rowsFor = (chart) => (chart.source === 'wireless' ? wirelessRows : deviceRows);

  const pointCount = Math.max(deviceRows?.length ?? 0, wirelessRows?.length ?? 0);
  const glowFilterVar = pointCount > 500 ? 'url(#chart-glow-lite)' : 'url(#chart-glow-full)';

  const isLoading = (needDevice && deviceLoading && !deviceRows) || (needWireless && wirelessLoading && !wirelessRows);
  const hardError = (needDevice && deviceError && !deviceRows) || (needWireless && wirelessError && !wirelessRows);
  const wirelessMissing = needWireless && !needDevice && !wirelessSensorId;

  const enlargedChart = enlargedKey ? (charts.find((c) => c.key === enlargedKey) ?? null) : null;

  if (wirelessMissing) {
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
        This PheNode has no linked wireless sensor, so there’s no data to show on this tab.
      </Box>
    );
  }

  if (hardError) {
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

  if (isLoading) {
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

  const height = layout === 'row' ? 228 : 258;
  const columns = layout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr';

  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: columns }}>
        {charts.map((chart) => (
          <CatalogCard
            key={chart.key}
            chart={chart}
            rows={rowsFor(chart)}
            from={from}
            to={to}
            xAxisTicks={xAxisTicks}
            axisFormat={axisFormat}
            height={height}
            glowFilterVar={glowFilterVar}
            timezone={timezone}
            onEnlarge={setEnlargedKey}
          />
        ))}
      </Box>

      {/* Enlarge Dialog — single instance, renders whichever chart was clicked
          at full width. idSuffix="-lg" avoids MUI id collisions with the grid. */}
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
              <Box style={{ '--chart-line-color': enlargedChart.color ?? '#48f7f5', '--chart-glow-filter': glowFilterVar }}>
                {renderChartBody(enlargedChart, rowsFor(enlargedChart), {
                  from,
                  to,
                  xAxisTicks,
                  axisFormat,
                  height: 460,
                  idSuffix: '-lg',
                  timezone
                })}
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
