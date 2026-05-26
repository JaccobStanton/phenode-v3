import { useMemo } from 'react';
import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';

// =============================================================================
// useDeviceImages — SWR hook for the per-device image-listing endpoint.
// =============================================================================
//
// Backend: GET /api/devices/{external_device_id}/images
//          phenodeX/phenode_backend/api/devices/routes.py:572
//
// Query params (all optional):
//   page       — 1-based page index (default 1, min 1).
//   page_size  — rows per page (default 25, min 1, max 100). We default
//                to 10 here because the imaging table renders 10 rows at
//                a time; matching the backend page size to the table page
//                size means one page of UI === one network request, and
//                paging through the table is a paged network walk rather
//                than a fetch-all-then-slice. If a different page size
//                makes sense for another consumer, override at the call
//                site.
//   from / to  — ISO-8601 timestamps. Backend filters images whose
//                `timestamp` falls within [from, to] inclusive. Either
//                side is optional. Omit both to get the most-recent N
//                images regardless of capture time — which is exactly
//                the imaging page's default behavior.
//
// Response (ImageListResponse — phenodeX/phenode_backend/schemas/images.py):
//
//   {
//     images: [{ id, device_id, timestamp, latitude, longitude,
//                filename, s3_url, has_data }],
//     page, page_size, total
//   }
//
// The list endpoint returns metadata only — no base64 payload — so paging
// stays cheap. Consumers that need the actual image bytes for a single
// row should hit /devices/{ext}/images/{id} via a one-shot fetcher; that
// detail endpoint returns `base64encoded` and is intentionally NOT pulled
// in here so the table render doesn't accidentally fan out an N-image
// payload request.
//
// Cache key: `[url, accessToken]`
//   - The URL includes page / page_size / from / to so each filtered or
//     paged view is its own cache entry. Re-visiting page 1 (the default
//     landing state) hits the SWR cache without a round-trip.
//   - Including the token in the key invalidates the cache automatically
//     on logout (token → null → null key → SWR skips the fetch).
//
// Skipping the fetch when externalDeviceId is null is intentional: the
// imaging page only knows the device id AFTER useMyDevices resolves, so
// the first render passes null and SWR cleanly no-ops instead of firing
// a doomed request.
//
// refreshInterval: 60000ms — lines up with the convention established by
// useMyDevices / useDeviceMeasurements. PheNode image cadence is on the
// order of one capture every ~30 minutes (see the seed-demo handler in
// routes.py:728), so sub-minute polling would be wasteful.

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_REFRESH_INTERVAL_MS = 60000;

/**
 * Compose the query string for /devices/{ext}/images. Skips empty
 * params so we don't ship `?from=&to=` noise that would change the
 * cache key for no semantic reason.
 */
const buildQueryString = ({ page, pageSize, from, to }) => {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params.toString();
};

/**
 * Coerce a Date / dayjs / ISO string / millisecond timestamp into the
 * ISO-Z string the backend expects. Returns null for nullish inputs so
 * the URL builder can drop the param entirely.
 */
const toIsoString = (input) => {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'string') return input;
  if (typeof input === 'number') return new Date(input).toISOString();
  // dayjs objects expose .toISOString(); Date objects too.
  if (typeof input.toISOString === 'function') return input.toISOString();
  return null;
};

/**
 * @param {string|null} externalDeviceId    Device to fetch — null skips the fetch.
 * @param {Object}      options
 * @param {number}      [options.page=1]    1-based page index.
 * @param {number}      [options.pageSize=10] Rows per page (max 100).
 * @param {Date|string|number|null} [options.from] ISO/Date/dayjs — filter start.
 * @param {Date|string|number|null} [options.to]   ISO/Date/dayjs — filter end.
 * @param {number}      [options.refreshIntervalMs] Override poll cadence.
 *                                                  Pass 0 to disable polling.
 */
export default function useDeviceImages(
  externalDeviceId,
  { page = 1, pageSize = DEFAULT_PAGE_SIZE, from = null, to = null, refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = {}
) {
  const { accessToken, isAuthenticated } = useAuth();

  const fromIso = useMemo(() => toIsoString(from), [from]);
  const toIso = useMemo(() => toIsoString(to), [to]);

  const url = useMemo(() => {
    if (!externalDeviceId) return null;
    const path = API.devices.images(externalDeviceId);
    const qs = buildQueryString({ page, pageSize, from: fromIso, to: toIso });
    return `${buildUrl(path)}?${qs}`;
  }, [externalDeviceId, page, pageSize, fromIso, toIso]);

  const swrKey = isAuthenticated && accessToken && url ? [url, accessToken] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    refreshInterval: refreshIntervalMs,
    // Identical-payload guard — see useMyDevices for full rationale. The
    // image list is paged and we poll for new captures every minute; on
    // most polls the response is byte-identical and we don't want to
    // re-render the carousel or refresh row keys for nothing.
    compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
    // dedupingInterval / revalidateOnFocus / shouldRetryOnError / onError
    // come from <SWRConfig> in providers/SWRProvider.jsx.
  });

  return {
    images: data?.images,
    page: data?.page,
    pageSize: data?.page_size,
    total: data?.total,
    isLoading,
    isValidating,
    error,
    mutate
  };
}
