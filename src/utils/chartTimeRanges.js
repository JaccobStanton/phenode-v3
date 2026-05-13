// =============================================================================
// chartTimeRanges — canonical time-range options for the sensor-measurements
// chart panel.
// =============================================================================
//
// Why this file exists separately from data/mocks/time-ranges.js:
//
//   The mock file's `timeRangeOptions` is consumed by three other pages
//   (sensor-network, multi-sensor-graph, system-diagnostics) and changing
//   it would silently affect them. The sensor-measurements page needs a
//   richer table — each entry has not just a label but also the lookback
//   in milliseconds and an axis-format hint so the chart's X-axis can
//   render an appropriate tick label for the chosen range (HH:mm for
//   short ranges, MM/DD for week-scale ranges, MMM YY for year-scale).
//
// Range list and ordering matches the spec the backend team built the
// bucketing API around:
//
//   5 min, 15 min, 30 min, 1 h, 3 h, 6 h, 12 h, 24 h, 2 d, 7 d, 30 d,
//   90 d, 6 mo, 1 y, 2 y, 5 y
//
// The bucketing-vs-raw decision is server-side (we pass `bucket: 'auto'`
// and the backend's auto-bucketing logic at api/devices/routes.py:853
// picks the appropriate aggregation). Frontend just hands the server a
// time window.
//
// Backend reference:
//   phenodeX/phenode_backend/api/devices/routes.py:853-866 (auto-bucketing)

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Axis-format hints. Drives the X-axis tick label `valueFormatter` —
 * short ranges show time-of-day; week-scale ranges show date+time;
 * month-scale ranges drop time entirely; year-scale ranges show the
 * month abbreviated. The categories are coarse on purpose — picking a
 * format per individual range would over-specify and force tweaks in
 * 16 places whenever the visual spec changes.
 */
export const AXIS_FORMATS = {
  // < 1 day: just the clock time.
  TIME: 'time',
  // 1-7 days: date + clock.
  DATETIME: 'datetime',
  // 7-90 days: just the date.
  DATE: 'date',
  // 90+ days: abbreviated month and year.
  MONTH: 'month'
};

/**
 * Full ordered range table. The chart panel's Select uses .label for
 * the menu options; the lookup helpers below take a label string and
 * return the ms / axisFormat pair.
 *
 * `ms` is the lookback duration in milliseconds — `from = now - ms`,
 * `to = now`. Keeping the unit as milliseconds means the math at the
 * call site is just subtraction; no Date arithmetic required.
 */
export const CHART_TIME_RANGES = [
  { label: 'Last 5 minutes', ms: 5 * MINUTE, axisFormat: AXIS_FORMATS.TIME },
  { label: 'Last 15 minutes', ms: 15 * MINUTE, axisFormat: AXIS_FORMATS.TIME },
  { label: 'Last 30 minutes', ms: 30 * MINUTE, axisFormat: AXIS_FORMATS.TIME },
  { label: 'Last hour', ms: 1 * HOUR, axisFormat: AXIS_FORMATS.TIME },
  { label: 'Last 3 hours', ms: 3 * HOUR, axisFormat: AXIS_FORMATS.TIME },
  { label: 'Last 6 hours', ms: 6 * HOUR, axisFormat: AXIS_FORMATS.TIME },
  { label: 'Last 12 hours', ms: 12 * HOUR, axisFormat: AXIS_FORMATS.TIME },
  { label: 'Last 24 hours', ms: 24 * HOUR, axisFormat: AXIS_FORMATS.TIME },
  { label: 'Last 2 days', ms: 2 * DAY, axisFormat: AXIS_FORMATS.DATETIME },
  { label: 'Last 7 days', ms: 7 * DAY, axisFormat: AXIS_FORMATS.DATETIME },
  { label: 'Last 30 days', ms: 30 * DAY, axisFormat: AXIS_FORMATS.DATE },
  { label: 'Last 90 days', ms: 90 * DAY, axisFormat: AXIS_FORMATS.DATE },
  { label: 'Last 6 months', ms: 180 * DAY, axisFormat: AXIS_FORMATS.MONTH },
  { label: 'Last 1 year', ms: 365 * DAY, axisFormat: AXIS_FORMATS.MONTH },
  { label: 'Last 2 years', ms: 2 * 365 * DAY, axisFormat: AXIS_FORMATS.MONTH },
  { label: 'Last 5 years', ms: 5 * 365 * DAY, axisFormat: AXIS_FORMATS.MONTH }
];

/**
 * Convenience: the labels alone, in the same order, for use as the
 * Select menu's option list. Two-line wrapping isn't needed because
 * the `CHART_TIME_RANGES` array is already iterable for menu rendering,
 * but the labels-only export keeps the call site cleaner when the
 * component only needs strings.
 */
export const CHART_TIME_RANGE_LABELS = CHART_TIME_RANGES.map((r) => r.label);

/**
 * Default selection — matches the existing dashboard convention. Most
 * users want a "today" view first; the hour ranges below it are
 * available when they need finer granularity.
 */
export const DEFAULT_CHART_TIME_RANGE = 'Last 24 hours';

/**
 * Look up a range entry by its label. Returns `undefined` if the label
 * doesn't match — callers should treat that the same as the default,
 * not as an error, so a typo'd or stale URL param falls back gracefully.
 */
export function findChartTimeRange(label) {
  return CHART_TIME_RANGES.find((r) => r.label === label);
}

/**
 * Compute the `[from, to]` Date window for a given label. `to` is
 * `now` at call time; `from` is `now - ms`. Returns Date instances
 * (not ISO strings) so the caller can re-format as needed; the
 * useDeviceMeasurements hook floors them to the nearest minute for
 * its URL key.
 *
 * If the label doesn't match, falls back to DEFAULT_CHART_TIME_RANGE
 * so the caller never has to handle null.
 *
 * @param {string} label
 * @returns {{ from: Date, to: Date, axisFormat: string }}
 */
export function computeChartWindow(label) {
  const range = findChartTimeRange(label) ?? findChartTimeRange(DEFAULT_CHART_TIME_RANGE);
  const to = new Date();
  const from = new Date(to.getTime() - range.ms);
  return { from, to, axisFormat: range.axisFormat };
}

/**
 * Format an axis tick. The X-axis on each chart passes its date values
 * through this function via MUI x-charts' `valueFormatter`. The
 * format choice is driven by `axisFormat` (from `computeChartWindow`)
 * — at the short end we show HH:mm; at the long end MMM YY. This
 * means a 5-minute view looks like "14:23" while a 5-year view looks
 * like "May 26".
 *
 * `value` may be a Date OR a number (Unix ms) depending on how MUI
 * x-charts invokes the formatter. Both are handled.
 */
export function formatAxisTick(value, axisFormat) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  switch (axisFormat) {
    case AXIS_FORMATS.TIME:
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case AXIS_FORMATS.DATETIME:
      return date.toLocaleString([], {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case AXIS_FORMATS.DATE:
      return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
    case AXIS_FORMATS.MONTH:
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    default:
      return date.toISOString();
  }
}
