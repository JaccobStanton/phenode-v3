// Pure transformers from backend `DeviceRead` shape to the row shape that
// `FleetOverviewView` consumes.
//
// Why these live here, not inside the hook:
//
//   The hook's job is to fetch + cache. It should return the API's actual
//   shape (`DeviceRead[]`) so any future consumer that wants devices for a
//   different reason (a map view, a CSV export, an admin table) doesn't
//   first have to un-transform the data. The container component owns
//   "API shape → view shape" — that's where the view's vocabulary
//   ("siteName", "metrics[].label") belongs.
//
//   These transformers are pure functions: easy to unit-test, easy to
//   reuse from any container that ends up rendering the same row card.
//
// Backend field reference:
//   phenodeX/phenode_backend/schemas/devices.py:31-49 (DeviceRead)
//   phenodeX/phenode_backend/api/devices/routes.py:51-57 (health_status
//     is computed server-side: "Live" if seen within 30 min, else "Offline")

import { batteryColor, healthStatusColor } from './metricColors';
import {
  formatTemperature as formatTemperatureWithUnit,
  formatSpeed as formatSpeedWithUnit,
  formatRainfall as formatRainfallWithUnit
} from 'utils/displayUnits';

/**
 * Format an ISO 8601 datetime into a localized "M/D/YYYY, h:mm:ss A"
 * string. Returns 'Never' when the device has never reported.
 *
 * Why localized: `last_measurement_at` is the kind of value users glance
 * at to ask "is this thing live?" — a localized representation is far
 * more readable than the raw ISO. If we ever need a user-timezone
 * preference, this is the single place to inject it.
 */
export function formatLastMeasurement(iso) {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

/**
 * Backend returns Celsius (`temperature_c`). Renders in the user's
 * preferred unit when one is supplied; defaults to Fahrenheit for
 * backwards compatibility with callers that haven't yet been migrated
 * to read `useDisplayPreferences().tempUnit`.
 *
 * The actual conversion + format lives in utils/displayUnits.js so the
 * logic can be reused outside the transformer layer (charts, sensor-
 * measurements page, exports). This wrapper preserves the legacy
 * single-argument call shape so existing consumers compile unchanged.
 *
 * @param {number|null|undefined} celsius - canonical Celsius value
 * @param {'F'|'C'} tempUnit - target unit; defaults to 'F'
 * @returns {string} formatted "23.45°C" / "74.21°F" / "N/A"
 */
export function formatTemperature(celsius, tempUnit = 'F') {
  return formatTemperatureWithUnit(celsius, tempUnit, 2);
}

/**
 * `rainfall_today_mm` is the cumulative-today total in millimeters, per
 * the schema field name. Renders in the user's preferred rain unit when
 * one is supplied; defaults to millimeters for back-compat. Like
 * formatTemperature, the actual conversion lives in utils/displayUnits.js
 * so it's reusable outside this transformer (charts, exports).
 *
 * @param {number|null|undefined} mm - canonical millimeter value
 * @param {'mm'|'in'} rainUnit - target unit; defaults to 'mm'
 */
export function formatTodaysRainfall(mm, rainUnit = 'mm') {
  return formatRainfallWithUnit(mm, rainUnit, 2);
}

/**
 * Wind speed comes from the backend in m/s (verified against the chart
 * endpoint). Renders in the user's preferred speed unit when one is
 * supplied; defaults to m/s for back-compat with consumers that
 * haven't migrated yet.
 *
 * @param {number|null|undefined} metersPerSecond - canonical m/s value
 * @param {'ms'|'mph'|'kmh'} speedUnit - target unit; defaults to 'ms'
 */
export function formatWindSpeed(metersPerSecond, speedUnit = 'ms') {
  return formatSpeedWithUnit(metersPerSecond, speedUnit, 2);
}

export function formatBatteryPercent(percent) {
  if (percent == null || Number.isNaN(percent)) return 'N/A';
  return `${percent.toFixed(2)}%`;
}

// Backend computes health_status server-side ("Live" / "Offline" /
// "Unknown") in the my-devices route. We translate "Live" → "Active"
// at the boundary because product copy uses "Active" everywhere in the
// UI (header counter, status filter button, the card cell itself).
// Translating in the transformer means everything downstream —
// display, search, filter, sort — operates on the UI vocabulary
// instead of the API vocabulary.
const translateHealthStatus = (raw) => {
  if (raw === 'Live') return 'Active';
  return raw ?? 'Unknown';
};

/**
 * Map a single `DeviceRead` to the row shape `FleetOverviewView` renders.
 *
 * Field choices:
 *   - siteName: prefer the user-set `label`. Fall back to the immutable
 *     `external_device_id` so a freshly provisioned device with no label
 *     yet still has a stable identifier on screen.
 *   - metrics order: matches the existing mock so the visual layout
 *     doesn't shift during the migration.
 *
 * @param {Object} device - backend DeviceRead
 * @param {Object} [displayPrefs] - optional display-preferences object
 *   from useDisplayPreferences(). When omitted, the row falls back to
 *   the legacy defaults (Fahrenheit for temperature, m/s for wind, mm
 *   for rainfall) so callers that haven't yet been migrated still
 *   produce the same output as before. Only the unit identifiers we
 *   actually convert here are read from the prefs — adding a new
 *   converted column (e.g. wind speed) is a 1-line change inside the
 *   metrics array, no signature change.
 */
export function deviceReadToFleetRow(device, displayPrefs) {
  const tempUnit = displayPrefs?.tempUnit ?? 'F';
  const speedUnit = displayPrefs?.speedUnit ?? 'ms';
  const rainUnit = displayPrefs?.rainUnit ?? 'mm';
  return {
    siteName: device?.label || device?.external_device_id || 'Unnamed device',
    // Raw immutable identifier (the MAC-style external_device_id). Carried
    // separately from siteName so the view can toggle which one is shown
    // — siteName uses the user-friendly label first and falls back to this
    // ID, while the MAC Address toggle in the toolbar forces the ID to
    // be shown for every card regardless of label.
    externalId: device?.external_device_id || 'Unknown',
    // Display string ("M/D/YYYY, h:mm:ss A" or "Never"). What the card renders.
    lastMeasurements: formatLastMeasurement(device?.last_measurement_at),
    // Raw ISO 8601 (or null) for sorting. Kept separate from `lastMeasurements`
    // because the formatter is lossy — once it's a localized date string we
    // can't reliably parse it back, and naive lexicographic sort on the
    // formatted "M/D/YYYY..." string would order March before May within
    // the same year, but reorder Decembers before Novembers across years.
    // FleetOverviewView's default + status sort comparators consume this.
    lastMeasurementAt: device?.last_measurement_at ?? null,
    metrics: (() => {
      // Compute health + battery once each — both the value/display
      // and the color decision derive from the same raw number, so
      // pulling them into local consts avoids reading the same field
      // twice and keeps the two derivations next to each other.
      const health = translateHealthStatus(device?.health_status);
      const batteryPct = device?.battery_percent;
      return [
        { label: 'Health Status:', value: health, color: healthStatusColor(health) },
        { label: 'Temperature:', value: formatTemperature(device?.temperature_c, tempUnit) },
        { label: "Today's Rainfall:", value: formatTodaysRainfall(device?.rainfall_today_mm, rainUnit) },
        { label: 'Wind Speed:', value: formatWindSpeed(device?.wind_speed, speedUnit) },
        { label: 'Battery:', value: formatBatteryPercent(batteryPct), color: batteryColor(batteryPct) }
      ];
    })()
  };
}
