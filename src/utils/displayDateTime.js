// =============================================================================
// displayDateTime — central timestamp formatters that honor the user's saved
// Display preference (uiPreferences.timezone).
// =============================================================================
//
// Every visible timestamp in the app — sensor cards, fleet rows, chart axes,
// chart tooltips, fleet map info windows — should flow through one of the
// helpers here, so the Account Settings → Display → Timezone control means
// what its label says: change it, and every clock in the app moves with it.
//
// Conventions (kept consistent with the legacy formatters these replace):
//
//   - Null / empty timestamp → 'Never'.
//   - Unparseable timestamp   → 'Unknown'.
//   - Null / empty timezone arg → use the browser's local zone (resolved via
//     Intl). Lets the "Use device timezone" sentinel in Account Settings work
//     as advertised — pick that, and the app follows whatever zone your
//     computer is set to.
//
// Why a thin wrapper around `Date.prototype.toLocale*` instead of dayjs/luxon:
// `toLocaleString` already accepts an IANA `timeZone` option and uses the
// browser's locale automatically. Reaching for a library would add a runtime
// dependency for what is fundamentally a one-liner.

/**
 * Resolve a stored timezone preference to an IANA zone string suitable for
 * Intl.DateTimeFormat. A null / empty / whitespace preference falls back to
 * the browser's own zone via `Intl.DateTimeFormat().resolvedOptions()`.
 *
 * Returns `undefined` only if the runtime can't resolve a zone — in which
 * case the caller's Intl options will omit `timeZone` entirely, deferring to
 * the runtime default (same end result as the legacy `toLocaleString()`).
 *
 * @param {string | null | undefined} timezone
 * @returns {string | undefined}
 */
export function resolveTimezone(timezone) {
  if (typeof timezone === 'string' && timezone.trim()) return timezone.trim();
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

// Internal: parse + validate a date-ish input. Returns the Date when valid,
// or null when the input is missing / unparseable. Callers map the null to
// the appropriate sentinel string for their surface ('Never' / 'Unknown' /
// empty).
function toDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Format a timestamp as a localized "M/D/YYYY, h:mm:ss A" string in the
 * user's chosen timezone. Drop-in replacement for the legacy
 * `formatLastMeasurement` in utils/transforms/{device,wirelessSensor}.js —
 * same 'Never' / 'Unknown' fallbacks, same default presentation, just
 * timezone-aware.
 *
 * @param {string | Date | null | undefined} value - ISO string or Date
 * @param {string | null | undefined} timezone - IANA zone or null for browser-local
 * @param {Intl.DateTimeFormatOptions} [overrides] - optional format overrides
 * @returns {string}
 */
export function formatDateTime(value, timezone, overrides) {
  if (value == null || value === '') return 'Never';
  const date = toDate(value);
  if (date === null) return 'Unknown';
  const zone = resolveTimezone(timezone);
  // `toLocaleString(undefined, …)` = use the browser's default locale.
  // Setting `timeZone` reinterprets the wall-clock representation without
  // changing the underlying instant — exactly what the user expects.
  return date.toLocaleString(undefined, { ...(zone ? { timeZone: zone } : {}), ...(overrides || {}) });
}

/**
 * Format a timestamp with an explicit set of Intl options in the user's
 * chosen timezone. For chart tooltips / axis ticks where the caller already
 * has a specific shape in mind (e.g. "Mar 15, 2026, 02:23 PM"). Returns an
 * empty string for missing / unparseable input so chart valueFormatter
 * callbacks never inject 'Never' / 'Unknown' strings into a numeric axis.
 *
 * @param {string | Date | null | undefined} value
 * @param {Intl.DateTimeFormatOptions} options
 * @param {string | null | undefined} timezone - IANA zone or null for browser-local
 * @returns {string}
 */
export function formatDateTimeWith(value, options, timezone) {
  const date = toDate(value);
  if (date === null) return '';
  const zone = resolveTimezone(timezone);
  return date.toLocaleString(undefined, zone ? { ...options, timeZone: zone } : options);
}

/**
 * Time-only variant of formatDateTimeWith — passes the same options bag
 * through `toLocaleTimeString`. Used for chart axis-tick labels where the
 * range is short enough that only the time-of-day is meaningful.
 */
export function formatTimeWith(value, options, timezone) {
  const date = toDate(value);
  if (date === null) return '';
  const zone = resolveTimezone(timezone);
  return date.toLocaleTimeString(undefined, zone ? { ...options, timeZone: zone } : options);
}

/**
 * Date-only variant of formatDateTimeWith — passes the same options bag
 * through `toLocaleDateString`. Used for chart axis-tick labels where the
 * range spans multiple days and the time-of-day would be visual noise.
 */
export function formatDateWith(value, options, timezone) {
  const date = toDate(value);
  if (date === null) return '';
  const zone = resolveTimezone(timezone);
  return date.toLocaleDateString(undefined, zone ? { ...options, timeZone: zone } : options);
}
