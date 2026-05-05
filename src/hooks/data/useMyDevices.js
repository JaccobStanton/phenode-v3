import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl } from 'services/fetcher';

// =============================================================================
// useMyDevices — SWR hook for GET /api/devices/my-devices.
// =============================================================================
//
// Returns:
//   {
//     devices:   DeviceRead[] | undefined,   // raw API shape
//     isLoading: boolean,
//     error:     ApiError    | undefined,
//     mutate:    (data?, opts?) => Promise<DeviceRead[]>,  // SWR's revalidator
//   }
//
// Returning the *raw* DeviceRead[] is intentional — see comments in
// utils/transforms/device.js. Containers transform to view shape.
//
// Cache key: `[buildUrl('/devices/my-devices'), accessToken]`
//   - Two pages calling useMyDevices() in the same session hit one cached
//     array, not two requests (deduped by SWRProvider's 15s window).
//   - Including the token in the key invalidates the cache automatically
//     when the user logs out (token → null → key changes → entry orphaned).
//
// Why pass `null` as the key when unauthenticated:
//   SWR treats `null` as "skip this fetch entirely." Cleaner than gating
//   with a `shouldFetch` flag and avoids a doomed 401 round-trip on
//   every mount. Same pattern phenodeX uses
//   (phenode_frontend/src/services/swrHooks.js:113-114).
//
// refreshInterval: 60000ms — the device list is the kind of data that
// should drift toward freshness over time. 60s lines up with phenodeX's
// existing convention. If a page needs more frequent updates it can
// call mutate() directly.

export default function useMyDevices() {
  const { accessToken, isAuthenticated } = useAuth();

  const swrKey = isAuthenticated && accessToken ? [buildUrl(API.devices.myDevices), accessToken] : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, {
    refreshInterval: 60000,
    // dedupingInterval / revalidateOnFocus / shouldRetryOnError / onError
    // come from <SWRConfig> in providers/SWRProvider.jsx — no per-hook
    // override needed.
  });

  return { devices: data, isLoading, error, mutate };
}
