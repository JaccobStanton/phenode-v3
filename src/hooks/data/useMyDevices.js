import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
import { validateDeviceListResponse } from 'services/schemas/device';

// =============================================================================
// useMyDevices — SWR hook for GET /api/devices/my-devices.
// =============================================================================
//
// Returns:
//   {
//     devices:   DeviceRead[] | undefined,   // raw, validated API shape
//     isLoading: boolean,
//     error:     ApiError | ValidationError | undefined,
//     mutate:    (data?, opts?) => Promise<DeviceRead[]>,
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
//   every mount.
//
// Why a per-hook fetcher (instead of inheriting the global from SWRConfig):
//   We need to validate the response shape AT the boundary so a backend
//   contract drift fails loudly. The validating wrapper does fetch →
//   validate; on success the validated array goes into SWR's `data`,
//   on validation failure a Yup ValidationError throws and ends up in
//   SWR's `error` (where the fleet view's error state surfaces it).
//
//   Alternative would be to validate inside a useMemo on the component
//   side, but that hides the failure from SWR's error reporting and
//   means each consumer has to re-implement validation handling. Push
//   it down to the hook and treat invalid data as a fetch failure.
//
// refreshInterval: 60000ms — the device list is the kind of data that
// should drift toward freshness over time. 60s lines up with phenodeX's
// existing convention. If a page needs more frequent updates it can
// call mutate() directly.

const fetchAndValidateDevices = async (key) => {
  const data = await fetcher(key);
  return validateDeviceListResponse(data);
};

export default function useMyDevices() {
  const { accessToken, isAuthenticated } = useAuth();

  const swrKey = isAuthenticated && accessToken ? [buildUrl(API.devices.myDevices), accessToken] : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetchAndValidateDevices, {
    refreshInterval: 60000
    // dedupingInterval / revalidateOnFocus / shouldRetryOnError / onError
    // come from <SWRConfig> in providers/SWRProvider.jsx — no per-hook
    // override needed.
  });

  return { devices: data, isLoading, error, mutate };
}
