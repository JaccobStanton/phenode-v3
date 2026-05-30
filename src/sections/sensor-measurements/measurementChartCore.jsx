import { memo } from 'react';

import { LineChart } from '@mui/x-charts/LineChart';

import { axisTickNumberFor, formatAxisTick, formatTooltipDate } from 'utils/chartTimeRanges';

// =============================================================================
// measurementChartCore — shared chart styling + the memoized line-chart
// renderer, extracted from sensor-measurements.jsx so BOTH the page (Weather
// grid) and MeasurementTabPanel (Light/Soil/Power + Weather extras) render
// pixel-identical charts from one source. Previously the panel kept an
// approximate copy of the sx, which dropped the area-fill opacity + hover
// treatment and produced a hard solid fill instead of the glow look.
// =============================================================================

// Hoisted chart sx — one stable reference shared across all charts. The line-
// stroke color is interpolated per-chart via a CSS variable set on the wrapper
// Box, so this object is fully chart-agnostic.
export const chartSx = {
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
    // Reference a STATIC SVG <filter> by id (mounted once via <ChartGlowDefs/>)
    // rather than computing drop-shadow per element. The wrapper Box sets
    // `--chart-glow-filter` based on point count (full ≤500, lite above).
    filter: 'var(--chart-glow-filter, url(#chart-glow-full))'
  },
  // No area fill — charts are line + glow only (per Jake). The area element
  // is also disabled at the series level (`area: false`); this keeps any
  // stray area element invisible too.
  '& .MuiAreaElement-root': {
    fillOpacity: 0
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
  // Hover indicator (the dashed vertical line that follows the cursor) picks up
  // the per-chart line color from the CSS variable. !important is required
  // because MUI ships its stroke as a styled-component-level rule.
  '& .MuiChartsAxisHighlight-root': {
    stroke: 'var(--chart-line-color) !important',
    strokeOpacity: 0.75,
    strokeWidth: 1.25
  },
  background: 'transparent',
  borderRadius: 1
};

// Y-axis tick label formatter. Compacts large values (1500 → "1.5k") and
// appends the chart's unit suffix. Curried because MUI x-charts' valueFormatter
// API takes a single-arg callback.
export const makeYAxisFormatter = (unit) => (value) => {
  if (value === null || value === undefined) return '';
  const compact = Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
  return unit ? `${compact} ${unit}` : compact;
};

// =============================================================================
// MeasurementChart — memoized single-series LineChart wrapper.
// =============================================================================
// Memoized with PRIMITIVE props so React.memo's shallowEqual short-circuits
// when nothing changed for this chart (toolbar/tab fidgeting elsewhere won't
// force a redraw). The "No data" empty-state lives at the PARENT so the grid
// vs enlarged-Dialog versions can style "empty" differently. `idSuffix` keeps
// the grid + enlarged instances from colliding on MUI's internal axis ids.
export const MeasurementChart = memo(function MeasurementChart({
  config,
  seriesTimes,
  seriesData,
  xAxisMin,
  xAxisMax,
  xAxisTicks,
  axisFormat,
  height,
  yAxisWidth,
  xAxisFontSize,
  yAxisFontSize,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  idSuffix,
  // IANA timezone string (or null for browser-local). Passed through to the
  // X-axis valueFormatter so axis ticks + tooltips render in the user's
  // chosen Display preference timezone. Primitive prop → React.memo's
  // shallowEqual still short-circuits when nothing changed.
  timezone
}) {
  // Y-axis padding — 4% of the range, 0.1 floor so a flat series still renders
  // a visible band rather than collapsing into the axis.
  const minVal = Math.min(...seriesData);
  const maxVal = Math.max(...seriesData);
  const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

  return (
    <LineChart
      xAxis={[
        {
          id: `${config.key}-x${idSuffix}`,
          scaleType: 'time',
          data: seriesTimes,
          tickNumber: axisTickNumberFor(axisFormat),
          tickInterval: xAxisTicks,
          min: xAxisMin,
          max: xAxisMax,
          domainLimit: 'strict',
          tickLabelStyle: { fontSize: xAxisFontSize, fill: 'var(--green)' },
          valueFormatter: (value, context) =>
            context?.location === 'tooltip' ? formatTooltipDate(value, timezone) : formatAxisTick(value, axisFormat, timezone)
        }
      ]}
      yAxis={[
        {
          id: `${config.key}-y${idSuffix}`,
          min: minVal - pad,
          max: maxVal + pad,
          width: yAxisWidth,
          tickLabelStyle: { fontSize: yAxisFontSize, fill: 'var(--green)' },
          valueFormatter: makeYAxisFormatter(config.unit)
        }
      ]}
      series={[
        {
          id: `${config.key}-line${idSuffix}`,
          data: seriesData,
          color: config.color,
          area: false,
          showMark: false,
          curve: 'linear',
          valueFormatter: (value) =>
            value === null || value === undefined ? 'No data' : `${Number(value).toFixed(2)}${config.unit ? ` ${config.unit}` : ''}`
        }
      ]}
      grid={{ horizontal: true, vertical: true }}
      height={height}
      margin={{ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }}
      hideLegend
      sx={chartSx}
    />
  );
});
