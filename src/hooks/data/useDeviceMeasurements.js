import { useMemo } from 'react';
import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
import { validateMeasurementResponse } from 'services/schemas/measurements';
import { normalizeMeasurementRow as normalizeRow } from 'hooks/data/normalizeMeasurementRow';

// =============================================================================
// useDeviceMeasurements — SWR hook for the device time-series endpoint.
// =============================================================================
//
// Backend: GET /api/devices/{external_device_id}/sensor-data
//          phenodeX/phenode_backend/api/devices/routes.py:823
//
// Returns:
//   {
//     rows:      MeasurementRow[] | undefined,  // normalized — see below
//     from:      string | undefined,            // ISO-Z echoed from backend
//     to:        string | undefined,
//     isLoading: boolean,
//     error:     ApiError | ValidationError | undefined,
//     mutate:    () => Promise<...>,
//   }
//
// Normalized row shape (returned regardless of bucket mode):
//
//   {
//     time:   string,                     // ISO-Z
//     fields: {
//       temperature:     { min, max, avg },
//       humidity:        { min, max, avg },
//       pressure:        { min, max, avg },
//       wind_speed:      { min, max, avg },
//       wind_gust:       { min, max, avg },
//       wind_direction:  { min, max, avg },
//       rainfall:        { min, max, avg },
//       tips_per_minute: { min, max, avg },
//       battery_voltage: { min, max, avg },
//       vapor_pressure:  { min, max, avg }
//       // (only fields present in the response are populated)
//     }
//   }
//
// Why normalize raw vs bucketed into one shape here, not at the chart layer:
//
//   The chart component already has plenty going on (axis config, color
//   mapping, animation, layout). If it had to also branch on "which mode
//   did we ask for?" then every chart-side change (different axis, new
//   metric, threshold line) would also need to handle two code paths.
//   Normalizing at the hook boundary means the chart layer only sees one
//   row shape and can write `row.fields.temperature.avg` without caring
//   how the data arrived. For raw rows, min === max === avg === the raw
//   value, so the same line/area rendering works for both modes.
//
// Performance notes:
//
//   The SWR key is `[url, accessToken]` where `url` is composed from the
//   passed `from`/`to`/`fields`/`bucket`/`limit` AND the time arguments
//   are FLOORED to the nearest minute before they enter the URL. This is
//   critical for caching: without flooring, the URL changes every render
//   (because `Date.now()` ticks every millisecond) and SWR re-fetches
//   constantly. With flooring, the URL only changes when the caller
//   meaningfully changes the time range. Stale-while-revalidate against
//   the floored URL is exactly what we want — the user sees instant data
//   on the next poll boundary instead of a spinner on every render.
//
// Auth + auto-refresh:
//
//   The `[url, accessToken]` tuple form is what `services/fetcher.js`
//   uses to attach the Bearer header. Including the token in the SWR
//   key also invalidates the cache automatically on logout (token →
//   null → null key → SWR skips the fetch).
//
// refreshInterval: 60000ms — matches the convention established by
// useMyDevices. Sub-minute polling is wasteful given the underlying
// device cadence (~1 reading per ~5 min).

const DEFAULT_LIMIT = 10000;
const DEFAULT_REFRESH_INTERVAL_MS = 60000;

/**
 * Floor a Date / ISO string / millisecond timestamp to the nearest
 * `granularitySec` seconds, returning an ISO-Z string.
 *
 * Why this exists: see "Performance notes" in the module-level doc.
 * 60-second granularity is the right default — polling cadence is
 * 60s, so anything finer than that just churns the cache without
 * delivering fresher data.
 *
 * @param {Date|string|number} input
 * @param {number} granularitySec
 * @returns {string} ISO-Z
 */
const floorToGranularityIso = (input, granularitySec = 60) => {
  const ms = input instanceof Date ? input.getTime() : typeof input === 'number' ? input : new Date(input).getTime();
  if (!Number.isFinite(ms)) return null;
  const floored = Math.floor(ms / 1000 / granularitySec) * granularitySec * 1000;
  return new Date(floored).toISOString();
};

/**
 * Compose the final query string for the GET request. Skips empty
 * params so we don't ship `?fields=&bucket=` noise. Always includes
 * `from`, `to`, `limit` — those are the load-bearing knobs.
 */
const buildQueryString = ({ from, to, fields, bucket, limit }) => {
  const params = new URLSearchParams();
  params.set('from', from);
  params.set('to', to);
  if (Array.isArray(fields) && fields.length > 0) params.set('fields', fields.join(','));
  if (bucket) params.set('bucket', bucket);
  params.set('limit', String(limit));
  return params.toString();
};

const fetchAndValidateMeasurements = async (key) => {
  const data = await fetcher(key);
  return validateMeasurementResponse(data);
};

/**
 * @param {string|null} externalDeviceId    Device to fetch — null skips the fetch entirely.
 * @param {Object}      options
 * @param {Date|string|number} options.from REQUIRED. Range start.
 * @param {Date|string|number} options.to   REQUIRED. Range end.
 * @param {string[]}    [options.fields]    Subset of known device fields.
 *                                           Omit to fetch all.
 * @param {string}      [options.bucket]    'raw' | '5m' | '10m' | '15m' |
 *                                           '30m' | '1h' | '3h' | '6h' |
 *                                           '12h' | '1d' | 'auto'.
 *                                           Omit to default to raw on the
 *                                           backend (consistent with the
 *                                           snapshot endpoint).
 * @param {number}      [options.limit]     Default DEFAULT_LIMIT (10k).
 * @param {number}      [options.refreshIntervalMs]
 *                                           Default 60s. Pass 0 to disable
 *                                           polling (useful for tests or
 *                                           one-shot screenshot exports).
 */
export default function useDeviceMeasurements(
  externalDeviceId,
  { from, to, fields, bucket, limit = DEFAULT_LIMIT, refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = {}
) {
  const { accessToken, isAuthenticated } = useAuth();

  // Floor from/to to the nearest minute BEFORE they hit the URL — see
  // "Performance notes" in the module doc for why. Memoized so the
  // floored strings are referentially stable when from/to don't
  // meaningfully change.
  const flooredFrom = useMemo(() => (from ? floorToGranularityIso(from) : null), [from]);
  const flooredTo = useMemo(() => (to ? floorToGranularityIso(to) : null), [to]);

  // Serialize `fields` to a stable string for the URL builder. Using
  // the array directly as a dep would re-run useMemo on every render
  // (new array identity each parent render), so we depend on the
  // joined form. The empty-array case collapses to an empty string
  // which `buildQueryString` then skips.
  const fieldsKey = Array.isArray(fields) ? fields.join(',') : '';

  const url = useMemo(() => {
    if (!externalDeviceId || !flooredFrom || !flooredTo) return null;
    const path = API.devices.sensorData(externalDeviceId);
    const qs = buildQueryString({
      from: flooredFrom,
      to: flooredTo,
      fields: fieldsKey ? fieldsKey.split(',') : undefined,
      bucket,
      limit
    });
    return `${buildUrl(path)}?${qs}`;
  }, [externalDeviceId, flooredFrom, flooredTo, fieldsKey, bucket, limit]);

  // SWR key. Null when any of: unauthenticated, missing token, missing
  // device id, missing time range. SWR skips fetches on null keys —
  // cleaner than gating with a `shouldFetch` boolean and a doomed
  // round-trip.
  const swrKey = isAuthenticated && accessToken && url ? [url, accessToken] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetchAndValidateMeasurements, {
    refreshInterval: refreshIntervalMs,
    // Skip the state update when the response is structurally identical
    // to the cached data — see useMyDevices for the full rationale. For
    // chart data this is especially valuable: most poll cycles between
    // device readings (~5 min cadence) return the SAME rows we already
    // have, so the chart used to redraw every 60s for no reason.
    compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
    // dedupingInterval / revalidateOnFocus / shouldRetryOnError / onError
    // come from <SWRConfig> in providers/SWRProvider.jsx.
  });

  // Normalize on the way out. useMemo on `data` so we don't re-walk the
  // (potentially thousands-of-rows) array on every render when the
  // underlying data hasn't changed.
  const rows = useMemo(() => {
    if (!data?.rows) return undefined;
    return data.rows.map(normalizeRow);
  }, [data]);

  return {
    rows,
    from: data?.from,
    to: data?.to,
    isLoading,
    // isValidating is true any time SWR has a fetch in flight — first
    // load, background poll, manual mutate(). Exposed alongside isLoading
    // so the UI can show a "refresh in progress" affordance on the
    // refresh button even when cached data is already on screen
    // (stale-while-revalidate). Difference: isLoading is true ONLY when
    // there's no cached data yet; isValidating is true for ALL fetches.
    isValidating,
    error,
    mutate
  };
}
