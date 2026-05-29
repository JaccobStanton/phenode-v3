import { useMemo } from 'react';
import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
import { validateMeasurementResponse } from 'services/schemas/measurements';
import { normalizeMeasurementRow as normalizeRow } from 'hooks/data/normalizeMeasurementRow';

// =============================================================================
// useMultiWirelessSensorMeasurements — SWR hook for N parallel wireless sensor
// fetches.
// =============================================================================
//
// The wireless-sensors page lets the user select multiple wireless sensors at
// once to overlay on the same chart panel. Rules of hooks forbid calling
// `useSWR` in a loop, so this hook builds ONE composite SWR key (sorted sensor
// ids + range + fields + bucket + token) and fans out the N HTTP requests
// inside the fetcher via `Promise.all`. SWR caches the merged result.
//
// Returns:
//   {
//     rowsBySensor: { [externalSensorId]: { rows, error } } | undefined,
//     isLoading:    boolean,
//     isValidating: boolean,
//     error:        Error | undefined   // top-level (composite-fetch) error
//     mutate:       () => Promise<...>,
//   }
//
// Per-sensor `rows` are already passed through `normalizeMeasurementRow`, so
// downstream consumers get the same `{ time, fields: { <key>: {min,max,avg} } }`
// shape as the single-sensor hook.

const DEFAULT_LIMIT = 10000;
const DEFAULT_REFRESH_INTERVAL_MS = 60000;

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

// Composite fetcher: swrKey is shaped as [accessToken, [sensorId, url], ...].
// Returns { sensorId → response | { __error: Error } }. Per-sensor failures
// are captured rather than rejecting the whole promise so a single failed
// sensor doesn't blank the chart for the others.
async function fetchAndValidateMulti(swrKey) {
  const [accessToken, ...entries] = swrKey;
  const results = await Promise.all(
    entries.map(async ([sensorId, url]) => {
      try {
        const raw = await fetcher([url, accessToken]);
        const validated = await validateMeasurementResponse(raw);
        return [sensorId, validated];
      } catch (err) {
        return [sensorId, { __error: err }];
      }
    })
  );
  return Object.fromEntries(results);
}

/**
 * @param {string[]|null} sensorIds         List of wireless-sensor external ids.
 *                                          Empty / null → no fetch.
 * @param {Object}        options
 * @param {Date|string|number} options.from REQUIRED. Range start.
 * @param {Date|string|number} options.to   REQUIRED. Range end.
 * @param {string[]}      [options.fields]  Field projection — applied to every sensor.
 * @param {string}        [options.bucket]  'raw' | 'auto' | '5m' | etc.
 * @param {number}        [options.limit]   Per-sensor row limit, default DEFAULT_LIMIT.
 * @param {number}        [options.refreshIntervalMs]
 *                                          Default 60s. 0 disables polling.
 */
export default function useMultiWirelessSensorMeasurements(
  sensorIds,
  { from, to, fields, bucket, limit = DEFAULT_LIMIT, refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = {}
) {
  const { accessToken, isAuthenticated } = useAuth();

  const flooredFrom = useMemo(() => (from ? floorToGranularityIso(from) : null), [from]);
  const flooredTo = useMemo(() => (to ? floorToGranularityIso(to) : null), [to]);

  // Sort + dedup the sensor ids so the SWR key is stable across re-renders
  // that hand us the same set in a different order.
  const sortedIdsKey = useMemo(() => {
    if (!Array.isArray(sensorIds)) return '';
    return [...new Set(sensorIds.filter(Boolean))].sort().join(',');
  }, [sensorIds]);

  const fieldsKey = Array.isArray(fields) ? fields.join(',') : '';

  // Composite SWR key — keyed on every input that should invalidate the
  // cache: token (logout), the sensor set, the range, the field projection,
  // and the bucket. SWR's structural-equality compare suppresses re-renders
  // when a 60s poll returns the same data.
  const swrKey = useMemo(() => {
    if (!isAuthenticated || !accessToken || !sortedIdsKey || !flooredFrom || !flooredTo) return null;
    const ids = sortedIdsKey.split(',');
    const qs = buildQueryString({
      from: flooredFrom,
      to: flooredTo,
      fields: fieldsKey ? fieldsKey.split(',') : undefined,
      bucket,
      limit
    });
    const entries = ids.map((id) => {
      const path = API.wirelessSensors.sensorData(id);
      return [id, `${buildUrl(path)}?${qs}`];
    });
    return [accessToken, ...entries];
  }, [isAuthenticated, accessToken, sortedIdsKey, flooredFrom, flooredTo, fieldsKey, bucket, limit]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetchAndValidateMulti, {
    refreshInterval: refreshIntervalMs,
    compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });

  // Normalize rows per sensor, separating per-sensor errors from the
  // top-level (e.g. token-refresh) error.
  const rowsBySensor = useMemo(() => {
    if (!data) return undefined;
    const out = {};
    for (const [sensorId, resp] of Object.entries(data)) {
      if (resp && resp.__error) {
        out[sensorId] = { rows: undefined, error: resp.__error };
      } else {
        out[sensorId] = { rows: (resp?.rows ?? []).map(normalizeRow), error: undefined };
      }
    }
    return out;
  }, [data]);

  return {
    rowsBySensor,
    isLoading,
    isValidating,
    error,
    mutate
  };
}
