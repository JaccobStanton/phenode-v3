import { useMemo } from 'react';
import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
import { validateMeasurementResponse } from 'services/schemas/measurements';

// =============================================================================
// useWirelessSensorMeasurements — SWR hook for the wireless-sensor
// time-series endpoint.
// =============================================================================
//
// Backend: GET /api/wireless-sensors/{external_sensor_id}/sensor-data
//          phenodeX/phenode_backend/api/wireless_sensors/routes.py:342
//
// Parallel to `useDeviceMeasurements` — same envelope, same normalized
// row shape, same SWR semantics, same minute-floored URL key. Differs
// only in:
//   - Endpoint URL (wireless-sensors vs devices)
//   - Field vocabulary (mVbat / temperatureTeros12_N / vwcPercent_N /
//     electricalConductivity_N / lux / rssi instead of temperature /
//     humidity / pressure / wind_speed / rainfall / battery_voltage)
//
// Returns:
//   {
//     rows:      MeasurementRow[] | undefined,  // normalized — see below
//     from:      string | undefined,            // ISO-Z echoed from backend
//     to:        string | undefined,
//     isLoading: boolean,
//     isValidating: boolean,                    // true for ANY fetch
//     error:     ApiError | ValidationError | undefined,
//     mutate:    () => Promise<...>,
//   }
//
// Normalized row shape (returned regardless of bucket mode):
//
//   {
//     time:   string,                     // ISO-Z
//     fields: {
//       mVbat:                      { min, max, avg },
//       lux:                        { min, max, avg },
//       rssi:                       { min, max, avg },
//       vwcPercent_1:               { min, max, avg },
//       vwcPercent_2:               { min, max, avg },
//       electricalConductivity_1:   { min, max, avg },
//       electricalConductivity_2:   { min, max, avg },
//       temperatureTeros12_1:       { min, max, avg },
//       temperatureTeros12_2:       { min, max, avg }
//       // (only fields present in the response are populated)
//     }
//   }
//
// Why this list and not all 40+ fields the backend ships
// (services/downloads.py:544-586): the chart layer renders 6 charts
// against this list; broader fields (BME280 air metrics, deeper probes
// at d2/d3/d4, etc.) aren't surfaced yet so shipping them in the
// response would just inflate payload. If a future chart wants air
// temperature or another field, add the key here AND to
// WIRELESS_SENSOR_CHART_CONFIGS in sensor-network.jsx — both lists
// stay in lockstep.
//
// Auth + auto-refresh: same as useDeviceMeasurements. The `[url, accessToken]`
// tuple form attaches the Bearer header, and including the token in
// the SWR key invalidates the cache automatically on logout.

const DEFAULT_LIMIT = 10000;
const DEFAULT_REFRESH_INTERVAL_MS = 60000;

/**
 * Floor a Date / ISO string / millisecond timestamp to the nearest
 * `granularitySec` seconds, returning an ISO-Z string. See the
 * "Performance notes" in useDeviceMeasurements for why — same
 * rationale here: without flooring, `to = new Date()` ticks every
 * render and SWR re-fetches constantly.
 */
const floorToGranularityIso = (input, granularitySec = 60) => {
  const ms = input instanceof Date ? input.getTime() : typeof input === 'number' ? input : new Date(input).getTime();
  if (!Number.isFinite(ms)) return null;
  const floored = Math.floor(ms / 1000 / granularitySec) * granularitySec * 1000;
  return new Date(floored).toISOString();
};

const buildQueryString = ({ from, to, fields, bucket, limit }) => {
  const params = new URLSearchParams();
  params.set('from', from);
  params.set('to', to);
  if (Array.isArray(fields) && fields.length > 0) params.set('fields', fields.join(','));
  if (bucket) params.set('bucket', bucket);
  params.set('limit', String(limit));
  return params.toString();
};

/**
 * Wireless-sensor field vocabulary the chart layer renders. Mirrors a
 * curated subset of phenodeX/phenode_backend/services/downloads.py:544-586
 * (`_WIRELESS_FIELD_KEYS`) — see the module-level comment for the
 * "why this list" rationale.
 *
 * Exported so the chart config in sensor-network.jsx can pass the
 * same array to the hook's `fields` projection (saves bandwidth) and
 * iterate it when building chart configs (single source of truth).
 */
const KNOWN_WIRELESS_SENSOR_FIELDS = [
  'mVbat',
  'lux',
  'rssi',
  'vwcPercent_1',
  'vwcPercent_2',
  'electricalConductivity_1',
  'electricalConductivity_2',
  'temperatureTeros12_1',
  'temperatureTeros12_2'
];

/**
 * Normalize a single response row into the canonical
 * `{ time, fields: { <name>: { min, max, avg } } }` shape.
 *
 * Reads from BOTH possible source shapes (raw / bucketed) — see the
 * matching helper in useDeviceMeasurements for the full rationale.
 */
const normalizeRow = (row) => {
  const fields = {};
  for (const key of KNOWN_WIRELESS_SENSOR_FIELDS) {
    const minKey = `${key}_min`;
    const maxKey = `${key}_max`;
    const avgKey = `${key}_avg`;
    const hasBucketed = minKey in row || maxKey in row || avgKey in row;
    if (hasBucketed) {
      const min = row[minKey] ?? null;
      const max = row[maxKey] ?? null;
      const avg = row[avgKey] ?? null;
      if (min === null && max === null && avg === null) continue;
      fields[key] = { min, max, avg };
    } else if (key in row && row[key] !== null && row[key] !== undefined) {
      const value = row[key];
      fields[key] = { min: value, max: value, avg: value };
    }
  }
  return { time: row.time, fields };
};

const fetchAndValidateMeasurements = async (key) => {
  const data = await fetcher(key);
  return validateMeasurementResponse(data);
};

/**
 * @param {string|null} externalSensorId    Wireless sensor to fetch — null skips the fetch entirely.
 * @param {Object}      options
 * @param {Date|string|number} options.from REQUIRED. Range start.
 * @param {Date|string|number} options.to   REQUIRED. Range end.
 * @param {string[]}    [options.fields]    Subset of KNOWN_WIRELESS_SENSOR_FIELDS.
 *                                           Omit to fetch all.
 * @param {string}      [options.bucket]    'raw' | '5m' | '10m' | '15m' |
 *                                           '30m' | '1h' | '3h' | '6h' |
 *                                           '12h' | '1d' | 'auto'.
 * @param {number}      [options.limit]     Default DEFAULT_LIMIT (10k).
 * @param {number}      [options.refreshIntervalMs]
 *                                           Default 60s. Pass 0 to disable polling.
 */
export default function useWirelessSensorMeasurements(
  externalSensorId,
  { from, to, fields, bucket, limit = DEFAULT_LIMIT, refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = {}
) {
  const { accessToken, isAuthenticated } = useAuth();

  // Same minute-flooring as the device hook so the SWR key is stable
  // across re-renders within the same minute.
  const flooredFrom = useMemo(() => (from ? floorToGranularityIso(from) : null), [from]);
  const flooredTo = useMemo(() => (to ? floorToGranularityIso(to) : null), [to]);

  // Serialize `fields` to a stable string for the URL builder; same
  // pattern as the device hook.
  const fieldsKey = Array.isArray(fields) ? fields.join(',') : '';

  const url = useMemo(() => {
    if (!externalSensorId || !flooredFrom || !flooredTo) return null;
    const path = API.wirelessSensors.sensorData(externalSensorId);
    const qs = buildQueryString({
      from: flooredFrom,
      to: flooredTo,
      fields: fieldsKey ? fieldsKey.split(',') : undefined,
      bucket,
      limit
    });
    return `${buildUrl(path)}?${qs}`;
  }, [externalSensorId, flooredFrom, flooredTo, fieldsKey, bucket, limit]);

  const swrKey = isAuthenticated && accessToken && url ? [url, accessToken] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetchAndValidateMeasurements, {
    refreshInterval: refreshIntervalMs,
    // Same JSON-equality compare used by the device hook — suppresses
    // state updates (and downstream re-renders) when the polled
    // response is structurally identical to the cached data.
    compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });

  const rows = useMemo(() => {
    if (!data?.rows) return undefined;
    return data.rows.map(normalizeRow);
  }, [data]);

  return {
    rows,
    from: data?.from,
    to: data?.to,
    isLoading,
    isValidating,
    error,
    mutate
  };
}

export { KNOWN_WIRELESS_SENSOR_FIELDS };
