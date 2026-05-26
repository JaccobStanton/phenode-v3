import { useMemo } from 'react';
import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';

// =============================================================================
// useImageDetail — SWR hook for a single image's full record.
// =============================================================================
//
// Backend: GET /api/devices/{external_device_id}/images/{image_id}
//          phenodeX/phenode_backend/api/devices/routes.py:649
//
// Returns:
//   {
//     src:        string | null,    // ready-to-use <img src>
//     filename:   string | undefined,
//     timestamp:  string | undefined, // ISO-Z
//     isLoading:  boolean,
//     error:      ApiError | undefined,
//   }
//
// `src` resolution order:
//   1. `s3_url` — direct CDN URL. Preferred when present because the
//      browser caches it and we avoid pushing megabytes through the
//      JSON channel.
//   2. `base64encoded` → wrapped into a `data:image/jpeg;base64,...`
//      URL. This is the dev / local-seeded path — the seed-demo handler
//      stores PIL-rendered JPEGs as base64 in the DB (see
//      phenodeX/phenode_backend/api/devices/routes.py:773), and the
//      list endpoint omits the base64 to keep paging cheap, so the
//      carousel has to fetch detail to actually render anything.
//   3. Neither field set → `null`. Caller should render a placeholder.
//
// MIME type: hardcoded `image/jpeg` because every capture path
// currently produces JPEG (PIL save / camera firmware). If the
// backend ever ships PNGs we'll need to read a mime field off the
// row or sniff the magic bytes; for now jpeg is a safe assumption.
//
// Why `enabled` instead of just passing null externally:
//   The carousel only needs detail when the list row's `s3_url` is
//   missing. Threading that decision through this hook (via
//   `enabled: !listRow.src`) keeps the call-site readable — the hook
//   takes care of the "skip the SWR fetch" semantics rather than
//   forcing every caller to know that `null` is the disable sentinel.
//
// Cache:
//   - refreshInterval: 0 — image bytes are content-addressable. They
//     don't change once written. Polling them is pure waste.
//   - dedupingInterval: 5 minutes — the same image opened in the
//     carousel then re-opened in the View dialog hits the cache.
//   - revalidateOnFocus: false — same reason. Tab focus shouldn't
//     re-fetch immutable image data.

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * @param {string|null} externalDeviceId  Device id — null skips fetch.
 * @param {number|string|null} imageId    Image id — null skips fetch.
 * @param {Object}      [options]
 * @param {boolean}     [options.enabled=true]
 *                                        Pass false to skip even when
 *                                        both ids are set (e.g. the
 *                                        list row already has s3_url
 *                                        so we don't need detail).
 */
export default function useImageDetail(externalDeviceId, imageId, { enabled = true } = {}) {
  const { accessToken, isAuthenticated } = useAuth();

  const url = useMemo(() => {
    if (!externalDeviceId || imageId == null) return null;
    return buildUrl(API.devices.imageDetail(externalDeviceId, imageId));
  }, [externalDeviceId, imageId]);

  const swrKey = enabled && isAuthenticated && accessToken && url ? [url, accessToken] : null;

  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    dedupingInterval: FIVE_MINUTES_MS
  });

  // Resolve the usable <img src> per the rules above. Memo so the
  // returned object reference is stable when the data hasn't changed —
  // important because consumers often pass `src` into a useEffect dep
  // array.
  const src = useMemo(() => {
    if (!data) return null;
    if (data.s3_url) return data.s3_url;
    if (data.base64encoded) return `data:image/jpeg;base64,${data.base64encoded}`;
    return null;
  }, [data]);

  return {
    src,
    filename: data?.filename,
    timestamp: data?.timestamp,
    isLoading,
    error
  };
}
