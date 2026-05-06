// =============================================================================
// Per-metric color rules for the fleet overview cards.
// =============================================================================
//
// Why these rules live in their own module (instead of inside each
// transformer): the same coloring applies to both PheNode (device)
// and wireless-sensor fleet rows. Centralizing means a future
// "Critical battery threshold is now 15%" change is a one-line edit
// in one place — and any new fleet type added later picks up the
// same vocabulary by importing from here.
//
// Rules summary:
//
//   Health Status:
//     'Active'  → var(--green)    (alive and reporting)
//     'Offline' → var(--purple)   (no recent measurement)
//     anything else (Unknown, '', etc.) → var(--green) fallback
//
//   Battery percentage (numeric, raw — NOT the formatted string):
//     null / undefined / NaN → var(--green) fallback (hides the issue
//                              cleanly when we have no data; surfacing
//                              red on missing data would read as a
//                              false positive)
//     ≤30%   → var(--critical)
//     ≤50%   → var(--orange)
//     >50%   → var(--green)
//
// All other metrics that don't match a rule above keep the default
// var(--green) — that's the historical color and the "nothing
// special" baseline.
//
// Numeric input expectation:
//   batteryColor takes the RAW number (e.g. 27.4), not the formatted
//   string (e.g. "27.40%"). The transformer has the raw number
//   on hand before it formats for display, so passing it directly
//   avoids the brittle alternative of parsing the percentage back
//   out of the display string.

const COLOR_DEFAULT = 'var(--green)';
const COLOR_OFFLINE = 'var(--purple)';
const COLOR_BATTERY_CRITICAL = 'var(--critical)';
const COLOR_BATTERY_LOW = 'var(--orange)';

/**
 * Color for the Health Status metric value. The transformer translates
 * the backend's "Live" → "Active" before this function sees it, so
 * we only need to handle the UI vocabulary here.
 */
export function healthStatusColor(value) {
  if (value === 'Offline') return COLOR_OFFLINE;
  return COLOR_DEFAULT;
}

/**
 * Color for the Battery metric value, given the RAW numeric percent
 * (not the formatted "X.XX%" display string).
 *
 * Returns the green default for missing/NaN values rather than red —
 * a sensor that hasn't reported yet shouldn't immediately scream
 * "critical battery!" because the absence of data is a different
 * problem than a confirmed low reading.
 */
export function batteryColor(percent) {
  if (percent == null || Number.isNaN(percent)) return COLOR_DEFAULT;
  if (percent <= 30) return COLOR_BATTERY_CRITICAL;
  if (percent <= 50) return COLOR_BATTERY_LOW;
  return COLOR_DEFAULT;
}
