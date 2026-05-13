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

const FAHRENHEIT_RATIO = 9 / 5;

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
 * Backend returns Celsius (`temperature_c`). The dashboard convention is
 * Fahrenheit (matching the existing mock data the user has been seeing).
 * If/when the app gets a unit-preference toggle, this is the single place
 * to flip on it.
 */
export function formatTemperature(celsius) {
  if (celsius == null || Number.isNaN(celsius)) return 'N/A';
  const fahrenheit = celsius * FAHRENHEIT_RATIO + 32;
  return `${fahrenheit.toFixed(2)}°F`;
}

/**
 * `rainfall_today_mm` is the cumulative-today total in millimeters, per
 * the schema field name. The previous mock data labelled this as "mm/hr"
 * — that was a copy-paste artifact from a different metric. Showing
 * "X mm" here is what the data actually represents.
 */
export function formatTodaysRainfall(mm) {
  if (mm == null || Number.isNaN(mm)) return 'N/A';
  return `${mm} mm`;
}

/**
 * Wind speed is m/s straight from the backend. We surface the raw
 * unit here rather than converting to mph — that decision was made
 * after confirming the chart endpoint emits m/s and choosing to
 * keep both displays (fleet cards + sensor-measurements page) on a
 * single unit so users never have to mentally swap between the two.
 * If a unit toggle later joins the dashboard, this is the single
 * place to flip it.
 */
export function formatWindSpeed(value) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(2)} m/s`;
}

export function formatBatteryPercent(percent) {
  if (percent == null || Number.isNaN(percent)) return 'N/A';
  return `${percent.toFixed(2)}%`;
}

/**
 * Map a single `DeviceRead` to the row shape `FleetOverviewView` renders.
 *
 * Field choices:
 *   - siteName: prefer the user-set `label`. Fall back to the immutable
 *     `external_device_id` so a freshly provisioned device with no label
 *     yet still has a stable identifier on screen.
 *   - metrics order: matches the existing mock so the visual layout
 *     doesn't shift during the migration.
 *   - health_status: backend computes this string ("Live"/"Offline"/
 *     "Unknown") in the my-devices route. We translate "Live" → "Active"
 *     here at the boundary because product copy uses "Active" everywhere
 *     in the UI (header counter, status filter button, the card cell
 *     itself). Translating in the transformer means everything downstream
 *     — display, search, filter, sort — operates on the UI vocabulary
 *     instead of the API vocabulary.
 */
const translateHealthStatus = (raw) => {
  if (raw === 'Live') return 'Active';
  return raw ?? 'Unknown';
};

export function deviceReadToFleetRow(device) {
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
        { label: 'Temperature:', value: formatTemperature(device?.temperature_c) },
        { label: "Today's Rainfall:", value: formatTodaysRainfall(device?.rainfall_today_mm) },
        { label: 'Wind Speed:', value: formatWindSpeed(device?.wind_speed) },
        { label: 'Battery:', value: formatBatteryPercent(batteryPct), color: batteryColor(batteryPct) }
      ];
    })()
  };
}
