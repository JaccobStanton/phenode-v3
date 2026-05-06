// Pure transformers from backend `WirelessSensorListItem` shape to the row
// shape that `FleetOverviewView` consumes.
//
// Why these live here, not inside the hook:
//
//   The hook's job is fetch + cache; it returns the raw API shape so any
//   future consumer (a map view, an export, an admin table) doesn't have
//   to un-transform first. The container component owns "API shape →
//   view shape" — that's where the view's vocabulary ("siteName",
//   "metrics[].label") belongs.
//
//   Pure functions: trivial to unit-test, reusable from any container
//   that ends up rendering the same row card.
//
// Field reference (camelCase aliases — see services/schemas/
// wirelessSensor.js for why):
//   phenodeX/phenode_backend/schemas/wireless_sensors.py:70-81
//     (WirelessSensorListItem)
//   phenodeX/phenode_backend/api/wireless_sensors/routes.py:138-190
//     (route handler — health_status uses the same 30-min Live/Offline
//      cutoff as devices)

const FAHRENHEIT_RATIO = 9 / 5;

/**
 * Format an ISO 8601 datetime into a localized "M/D/YYYY, h:mm:ss A"
 * string. Returns 'Never' when the sensor has never reported.
 *
 * Why localized: `lastMeasurementAt` is the kind of value users glance
 * at to ask "is this thing live?" — a localized representation is far
 * more readable than the raw ISO. If we ever need a user-timezone
 * preference, this is the single place to inject it. (Same rationale
 * as utils/transforms/device.js — duplicated rather than extracted to
 * a shared util because the device + sensor formatters have already
 * diverged on temperature and unit handling, and a shared module
 * would hide that.)
 */
export function formatLastMeasurement(iso) {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

/**
 * Backend returns Celsius (`soilTemperatureC`). Display in Fahrenheit
 * to match the device fleet card's temperature convention so the two
 * fleet views read consistently. If a unit-preference toggle ships,
 * this is the single place to flip it.
 */
export function formatSoilTemperature(celsius) {
  if (celsius == null || Number.isNaN(celsius)) return 'N/A';
  const fahrenheit = celsius * FAHRENHEIT_RATIO + 32;
  return `${fahrenheit.toFixed(2)}°F`;
}

/**
 * `soilMoisture` is already a 0–100 percent on the wire — the backend
 * normalizes via `_as_percent` (routes.py:45-49) which scales raw 0–1
 * VWC into a percent. We just format with two decimals to match the
 * battery convention.
 */
export function formatSoilMoisture(percent) {
  if (percent == null || Number.isNaN(percent)) return 'N/A';
  return `${percent.toFixed(2)}%`;
}

export function formatBatteryPercent(percent) {
  if (percent == null || Number.isNaN(percent)) return 'N/A';
  return `${percent.toFixed(2)}%`;
}

/**
 * RSSI is a received-signal-strength indicator in dBm (typically a
 * negative integer like -65). No unit conversion needed — the value
 * comes straight from the radio. Showing the unit makes the negative
 * sign less surprising for non-RF readers.
 */
export function formatRssi(value) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(0)} dBm`;
}

/**
 * Map a single `WirelessSensorListItem` to the row shape `FleetOverviewView`
 * renders.
 *
 * Field choices:
 *   - siteName: prefer the user-set `label`. Fall back to the immutable
 *     `externalSensorId` so a freshly provisioned sensor with no label
 *     yet still has a stable identifier on screen. (Mirrors the device
 *     transformer's behavior.)
 *   - metrics: 5 sensor-appropriate values that fit the 5-column grid
 *     in FleetOverviewView. The wireless-sensor mock previously used
 *     PheNode metrics (Temperature/Rainfall/Wind Speed) that the sensor
 *     backend doesn't actually expose — those were misleading. The
 *     metrics now reflect what wireless soil sensors really measure.
 *   - healthStatus: backend computes the "Live"/"Offline" string using
 *     a 30-min cutoff (routes.py:161-167). We translate "Live" → "Active"
 *     here at the boundary so product copy is consistent across the UI
 *     (header counter, status filter button, the card cell itself).
 *     Translating in the transformer means everything downstream — display,
 *     search, filter, sort — operates on the UI vocabulary.
 */
const translateHealthStatus = (raw) => {
  if (raw === 'Live') return 'Active';
  return raw ?? 'Unknown';
};

export function wirelessSensorToFleetRow(sensor) {
  return {
    siteName: sensor?.label || sensor?.externalSensorId || 'Unnamed sensor',
    // Display string ("M/D/YYYY, h:mm:ss A" or "Never"). What the card renders.
    lastMeasurements: formatLastMeasurement(sensor?.lastMeasurementAt),
    // Raw ISO 8601 (or null) for sorting. See the matching comment in
    // utils/transforms/device.js — FleetOverviewView's default + status
    // sort comparators consume this; the formatted display string is lossy
    // and can't be reliably parsed back into a sortable Date.
    lastMeasurementAt: sensor?.lastMeasurementAt ?? null,
    metrics: [
      { label: 'Health Status:', value: translateHealthStatus(sensor?.healthStatus) },
      { label: 'Soil Moisture:', value: formatSoilMoisture(sensor?.soilMoisture) },
      { label: 'Soil Temp:', value: formatSoilTemperature(sensor?.soilTemperatureC) },
      { label: 'RSSI:', value: formatRssi(sensor?.rssi) },
      { label: 'Battery:', value: formatBatteryPercent(sensor?.batteryPercent) }
    ]
  };
}
