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
 * Pick the appropriate AXIS_FORMATS bucket for an arbitrary from/to
 * span. Used by the chart panel when the user supplies a custom date
 * range via the DateTimePickers — the preset ranges have their
 * axisFormat baked into the CHART_TIME_RANGES table, but custom
 * ranges need the same TIME / DATETIME / DATE / MONTH bucketing
 * applied dynamically.
 *
 * Thresholds mirror the implicit bucketing in CHART_TIME_RANGES so
 * the visual format is consistent whether the user picked a preset
 * or rolled their own:
 *   < 1 day        → TIME      (HH:mm)
 *   1-7 days       → DATETIME  (date + clock)
 *   7-90 days      → DATE      (M/D)
 *   90+ days       → MONTH     (MMM YY)
 *
 * Returns the default DEFAULT_CHART_TIME_RANGE's axisFormat for
 * invalid (negative / zero) spans so callers never get an undefined.
 */
export function pickAxisFormatForRange(from, to) {
  const fromMs = from instanceof Date ? from.getTime() : new Date(from).getTime();
  const toMs = to instanceof Date ? to.getTime() : new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return AXIS_FORMATS.TIME;
  const span = toMs - fromMs;
  if (span <= 0) return AXIS_FORMATS.TIME;
  if (span < 1 * DAY) return AXIS_FORMATS.TIME;
  if (span < 7 * DAY) return AXIS_FORMATS.DATETIME;
  if (span < 90 * DAY) return AXIS_FORMATS.DATE;
  return AXIS_FORMATS.MONTH;
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
/**
 * Format a timestamp for chart tooltip use. ALWAYS detailed: includes
 * month, day, year, and time-of-day regardless of the chart's selected
 * time range.
 *
 * Why this is separate from formatAxisTick: the axis-tick format is
 * intentionally coarse (e.g. MONTH → "MMM YY") so labels don't overlap
 * each other along the axis. But that same coarse format on a tooltip
 * is useless — hovering different points within the same month all
 * render the same "Mar 26" string. The user can't tell which data
 * point they're looking at. The tooltip needs full precision: it has
 * the screen space, and the user is asking "what value, when?" — so
 * answer both completely.
 *
 * Example: "Mar 15, 2026, 02:23 PM".
 */
// `timezone` (IANA zone string, or null/undefined for browser-local) is
// threaded through both formatters so the chart axes and tooltips render in
// whatever zone the user picked in Account Settings → Display. Callers read
// it via useDisplayPreferences().timezone and pass it down. Null falls back
// to the browser's zone — see resolveTimezone for the details.
import { formatDateTimeWith, formatDateWith, formatTimeWith } from 'utils/displayDateTime';

export function formatTooltipDate(value, timezone) {
  return formatDateTimeWith(
    value,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    },
    timezone
  );
}

export function formatAxisTick(value, axisFormat, timezone) {
  switch (axisFormat) {
    case AXIS_FORMATS.TIME:
      return formatTimeWith(value, { hour: '2-digit', minute: '2-digit' }, timezone);
    case AXIS_FORMATS.DATETIME:
      return formatDateTimeWith(
        value,
        {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        },
        timezone
      );
    case AXIS_FORMATS.DATE:
      return formatDateWith(value, { month: 'numeric', day: 'numeric' }, timezone);
    case AXIS_FORMATS.MONTH:
      return formatDateWith(value, { month: 'short', year: '2-digit' }, timezone);
    default: {
      const date = value instanceof Date ? value : new Date(value);
      return Number.isFinite(date.getTime()) ? date.toISOString() : '';
    }
  }
}

/**
 * Suggested tick count for the X-axis given the chosen axisFormat. Used
 * by formats where auto-tick-placement produces a sane count of
 * distinct labels — TIME / DATETIME / DATE all fall here.
 *
 * NOT used for MONTH — see computeAxisTicks below. tickNumber on a time
 * scale is only a hint, and MUI x-charts ignores it when its auto-stride
 * resolution (typically days at a 6-month window) is finer than the
 * format's label granularity (months). The result was the "Mar 26 /
 * Mar 26 / Apr 26 / Apr 26..." duplicate-label bug on the 6mo view.
 * For that case we hand MUI an explicit tick array instead.
 */
export function axisTickNumberFor(axisFormat) {
  switch (axisFormat) {
    case AXIS_FORMATS.TIME:
      return 6;
    case AXIS_FORMATS.DATETIME:
      return 7;
    case AXIS_FORMATS.DATE:
      return 8;
    case AXIS_FORMATS.MONTH:
      // Falls through — MONTH uses computeAxisTicks (tickInterval) so
      // this hint is ignored anyway, but return a sensible value for
      // any caller that decides to use it.
      return 6;
    default:
      return 8;
  }
}

/**
 * Compute an explicit array of Date positions for the X-axis when the
 * format would otherwise produce duplicate labels under MUI's auto-tick
 * placement.
 *
 * Returns:
 *   - For MONTH format: an array of "first of the month" Dates between
 *     `from` and `to`, evenly downsampled so the visible count lands
 *     around 6 regardless of total range. So "Last 6 months" → 6 ticks
 *     (one per month), "Last 1 year" → 6 ticks (every ~2 months),
 *     "Last 5 years" → 6 ticks (every ~10 months). Each tick falls on
 *     a calendar month boundary so the rendered "MMM YY" label changes
 *     between every tick.
 *   - For every other format: `undefined`. MUI's auto-placement handles
 *     those formats fine — the duplicate-label issue is specific to
 *     MONTH's coarse-grained label resolution.
 *
 * Passed to MUI x-charts' `xAxis.tickInterval` prop. When an array, MUI
 * uses those exact positions and ignores `tickNumber`.
 */
export function computeAxisTicks(from, to, axisFormat) {
  if (axisFormat !== AXIS_FORMATS.MONTH) return undefined;
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return undefined;

  // First, generate one position per month-boundary within the range.
  // Then downsample with a stride so the visible count stays ~6.
  const allMonthStarts = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  if (cursor < start) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor <= end) {
    allMonthStarts.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  if (allMonthStarts.length === 0) return undefined;

  const targetTickCount = 6;
  const stride = Math.max(1, Math.ceil(allMonthStarts.length / targetTickCount));
  const downsampled = [];
  for (let i = 0; i < allMonthStarts.length; i += stride) {
    downsampled.push(allMonthStarts[i]);
  }
  // Ensure the last month is included so the tick at the far right of
  // the axis isn't suspiciously missing for users who scan endpoints.
  const last = allMonthStarts[allMonthStarts.length - 1];
  if (downsampled[downsampled.length - 1] !== last) {
    downsampled.push(last);
  }
  return downsampled;
}
