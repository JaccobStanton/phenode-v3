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
//   phenodeX/phenode_backend/api/wireless_sensors/routes.py:138-240
//     (route handler — health_status uses the configurable
//      DEVICE_LIVE_WINDOW_MINUTES window (default 120 min), the same
//      setting PheNode devices use — see routes.py:206-214 and
//      core/config.py:48. "Live" if seen within the window, else
//      "Offline".)

import { batteryColor, healthStatusColor } from './metricColors';
import { formatDateTime } from 'utils/displayDateTime';
import { formatTemperature as formatTemperatureWithUnit } from 'utils/displayUnits';

/**
 * Format an ISO 8601 datetime as a localized "M/D/YYYY, h:mm:ss A" string
 * in the user's Display preference timezone. Returns 'Never' when the
 * sensor has never reported, 'Unknown' when the value can't be parsed.
 *
 * The actual formatting lives in utils/displayDateTime.js so every visible
 * timestamp in the app (cards, charts, tooltips) routes through the same
 * timezone-aware helper.
 *
 * @param {string | null | undefined} iso
 * @param {string | null | undefined} timezone - IANA zone or null for browser-local
 */
export function formatLastMeasurement(iso, timezone) {
  return formatDateTime(iso, timezone);
}

/**
 * Backend returns Celsius (`soilTemperatureC`). Renders in the user's
 * preferred unit when one is supplied; defaults to Fahrenheit for
 * back-compat with callers that haven't been migrated to read
 * `useDisplayPreferences().tempUnit`. Shares the conversion logic in
 * utils/displayUnits.js with the device transformer so both fleet
 * views read consistently.
 *
 * @param {number|null|undefined} celsius - canonical Celsius value
 * @param {'F'|'C'} tempUnit - target unit; defaults to 'F'
 */
export function formatSoilTemperature(celsius, tempUnit = 'F') {
  return formatTemperatureWithUnit(celsius, tempUnit, 2);
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
 * Format a 12-char lowercase hex MAC (no separators, the shape the
 * backend ships — see `_mac_from_external_sensor_id` and
 * `_mac_from_measurements` in
 * phenodeX/phenode_backend/api/wireless_sensors/routes.py:39-57) into
 * the canonical uppercase colon-separated display form:
 *
 *     "e3452c89b6ff"  →  "E3:45:2C:89:B6:FF"
 *
 * Returns '—' for missing / non-string / wrong-length inputs so the
 * diagram heading and any other consumer never reads as empty or
 * mangled. We deliberately don't try to be clever about partially-
 * valid MACs (e.g. 8 hex chars) — a wrong-length value is more likely
 * to be a backend bug we want to surface than something we should
 * silently pretty-print.
 *
 * Why a string-level check (not a regex): the regex would be roughly
 * `/^[0-9a-f]{12}$/i` — fine, but a length check after toString +
 * lowercase is simpler to read and the input is already trusted by
 * the Yup schema at the API boundary.
 */
export function formatMacAddress(raw) {
  if (typeof raw !== 'string') return '—';
  const trimmed = raw.trim();
  if (trimmed.length !== 12) return '—';
  return trimmed.toUpperCase().match(/.{2}/g).join(':');
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
 *     the configurable DEVICE_LIVE_WINDOW_MINUTES window (default 120 min,
 *     routes.py:206-214) — the same setting PheNode devices use. We
 *     translate "Live" → "Active"
 *     here at the boundary so product copy is consistent across the UI
 *     (header counter, status filter button, the card cell itself).
 *     Translating in the transformer means everything downstream — display,
 *     search, filter, sort — operates on the UI vocabulary.
 */
const translateHealthStatus = (raw) => {
  if (raw === 'Live') return 'Active';
  return raw ?? 'Unknown';
};

/**
 * @param {Object} sensor - WirelessSensorListItem from the API
 * @param {Object} [displayPrefs] - optional display-preferences object
 *   from useDisplayPreferences(). When omitted, falls back to the
 *   legacy defaults (Fahrenheit for soil temperature) so callers that
 *   haven't been migrated produce the same output as before.
 */
export function wirelessSensorToFleetRow(sensor, displayPrefs) {
  const tempUnit = displayPrefs?.tempUnit ?? 'F';
  return {
    siteName: sensor?.label || sensor?.externalSensorId || 'Unnamed sensor',
    // Raw immutable identifier (the externalSensorId — the WS- prefixed
    // hardware ID). Carried separately from siteName so the view can
    // toggle which one is shown — siteName uses the user-friendly label
    // first and falls back to this ID, while the MAC Address toggle in
    // the toolbar forces the ID to be shown for every card regardless
    // of label.
    externalId: sensor?.externalSensorId || 'Unknown',
    // Display string ("M/D/YYYY, h:mm:ss A" or "Never") rendered in the
    // user's Display preference timezone. What the card renders.
    lastMeasurements: formatLastMeasurement(sensor?.lastMeasurementAt, displayPrefs?.timezone),
    // Raw ISO 8601 (or null) for sorting. See the matching comment in
    // utils/transforms/device.js — FleetOverviewView's default + status
    // sort comparators consume this; the formatted display string is lossy
    // and can't be reliably parsed back into a sortable Date.
    lastMeasurementAt: sensor?.lastMeasurementAt ?? null,
    metrics: (() => {
      // Same pattern as the device transformer: compute health +
      // battery once each so the value/display and the color decision
      // derive from the same source.
      const health = translateHealthStatus(sensor?.healthStatus);
      const batteryPct = sensor?.batteryPercent;
      return [
        { label: 'Health Status:', value: health, color: healthStatusColor(health) },
        { label: 'Soil Moisture:', value: formatSoilMoisture(sensor?.soilMoisture) },
        { label: 'Soil Temp:', value: formatSoilTemperature(sensor?.soilTemperatureC, tempUnit) },
        { label: 'RSSI:', value: formatRssi(sensor?.rssi) },
        { label: 'Battery:', value: formatBatteryPercent(batteryPct), color: batteryColor(batteryPct) }
      ];
    })()
  };
}
