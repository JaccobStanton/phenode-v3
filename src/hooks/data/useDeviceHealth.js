import { useMemo } from 'react';
import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
import { validateMeasurementResponse } from 'services/schemas/measurements';

// =============================================================================
// useDeviceHealth — SWR hook for the device diagnostics/health time-series.
// =============================================================================
//
// Backend: GET /api/devices/{external_device_id}/health-data
//          phenodeX/phenode_backend/api/devices/routes.py:1032
//          phenodeX/phenode_backend/services/downloads.py:862 (build_device_health_rows)
//
// This is the diagnostics sibling of useDeviceMeasurements. Same response
// envelope ({ deviceExternalId, from, to, bucket, rows }) and the same raw-vs-
// bucketed row duality, so the normalization below is intentionally identical
// to useDeviceMeasurements — the only thing that differs is the endpoint and
// the field vocabulary. The two hooks are kept separate (rather than one
// parametrized hook) because they hit different endpoints with different field
// sets, and the system-diagnostics page is the only consumer that needs the
// health feed. If a third caller appears, factor out the shared normalizer.
//
// Returns:
//   {
//     rows:        HealthRow[] | undefined,   // normalized — see below
//     from:        string | undefined,
//     to:          string | undefined,
//     isLoading:   boolean,
//     isValidating: boolean,
//     error:       ApiError | ValidationError | undefined,
//     mutate:      () => Promise<...>,
//   }
//
// Normalized row shape (same as useDeviceMeasurements):
//
//   {
//     time:   string,                         // ISO-Z
//     fields: { <name>: { min, max, avg } }   // only populated fields
//   }
//
// For raw rows min === max === avg === the raw value, so the chart layer's
// area-band rendering degenerates to a plain line — identical handling to the
// environmental feed.

const DEFAULT_LIMIT = 10000;
const DEFAULT_REFRESH_INTERVAL_MS = 60000;

// Numeric health fields the chart layer can plot. `rat` (radio access tech) is
// a string label, not a series, so it's deliberately excluded from this list —
// the backend will still return it, the normalizer just won't carry it.
//
// Mirror of phenodeX/phenode_backend/services/downloads.py:786
// (DEVICE_HEALTH_FIELDS), minus `rat`. If the backend adds a numeric health
// field, add it here in lockstep so the chart layer can request + render it.
const KNOWN_HEALTH_FIELDS = ['rssi', 'sinr', 'bars', 'notecard_voltage', 'notecard_temp', 'wifi_rssi', 'wifi_snr', 'wifi_bars'];

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

const normalizeRow = (row) => {
  const fields = {};
  for (const key of KNOWN_HEALTH_FIELDS) {
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

const fetchAndValidateHealth = async (key) => {
  const data = await fetcher(key);
  return validateMeasurementResponse(data);
};

/**
 * @param {string|null} externalDeviceId    Device to fetch — null skips the fetch entirely.
 * @param {Object}      options
 * @param {Date|string|number} options.from REQUIRED. Range start.
 * @param {Date|string|number} options.to   REQUIRED. Range end.
 * @param {string[]}    [options.fields]    Subset of KNOWN_HEALTH_FIELDS. Omit to fetch all.
 * @param {string}      [options.bucket]    'raw' | '5m' | … | '1d' | 'auto'. Omit → raw.
 * @param {number}      [options.limit]     Default DEFAULT_LIMIT (10k).
 * @param {number}      [options.refreshIntervalMs]  Default 60s. Pass 0 to disable polling.
 */
export default function useDeviceHealth(
  externalDeviceId,
  { from, to, fields, bucket, limit = DEFAULT_LIMIT, refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = {}
) {
  const { accessToken, isAuthenticated } = useAuth();

  const flooredFrom = useMemo(() => (from ? floorToGranularityIso(from) : null), [from]);
  const flooredTo = useMemo(() => (to ? floorToGranularityIso(to) : null), [to]);

  const fieldsKey = Array.isArray(fields) ? fields.join(',') : '';

  const url = useMemo(() => {
    if (!externalDeviceId || !flooredFrom || !flooredTo) return null;
    const path = API.devices.healthData(externalDeviceId);
    const qs = buildQueryString({
      from: flooredFrom,
      to: flooredTo,
      fields: fieldsKey ? fieldsKey.split(',') : undefined,
      bucket,
      limit
    });
    return `${buildUrl(path)}?${qs}`;
  }, [externalDeviceId, flooredFrom, flooredTo, fieldsKey, bucket, limit]);

  const swrKey = isAuthenticated && accessToken && url ? [url, accessToken] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetchAndValidateHealth, {
    refreshInterval: refreshIntervalMs,
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

export { KNOWN_HEALTH_FIELDS };
