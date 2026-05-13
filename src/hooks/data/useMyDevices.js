import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
// schemas/device is dynamically-imported INSIDE the fetcher below — see
// the comment there for the reason. Static-importing it would pull yup
// (and its deps: property-expr, tiny-case, toposort) into the eager
// dashboard bundle, adding ~14 KB compressed to first paint for code
// that doesn't run until the API response arrives.

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
  // Kick off both the network request AND the schema module load in
  // parallel. Yup + the schema file are ~14 KB compressed; pulling them
  // off the eager dashboard bundle means the entry chunk is smaller
  // and first paint can happen sooner. The two awaits are sequential
  // here only because we need the data before we can validate it, but
  // the second `import()` is effectively free after the first call —
  // ES module loading is cached by the runtime, so subsequent SWR
  // refreshes don't re-fetch the chunk.
  const fetchPromise = fetcher(key);
  const schemaModulePromise = import('services/schemas/device');
  const [data, { validateDeviceListResponse }] = await Promise.all([fetchPromise, schemaModulePromise]);
  return validateDeviceListResponse(data);
};

export default function useMyDevices() {
  const { accessToken, isAuthenticated } = useAuth();

  const swrKey = isAuthenticated && accessToken ? [buildUrl(API.devices.myDevices), accessToken] : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetchAndValidateDevices, {
    refreshInterval: 60000,
    // compare: structural-equality check SWR runs against the existing
    // cached data on every revalidation. When it returns true, SWR keeps
    // the existing reference and skips the state update — meaning no
    // re-render in any consumer of this hook.
    //
    // Why this matters: without it, every 60s SWR poll returns a FRESH
    // array reference (even if the backend data is byte-identical to
    // what we already have), which cascades through every downstream
    // useMemo with `[devices]` deps — recomputing fleet rows, plottable
    // arrays, marker icons, etc. — and visibly redrawing the map / cards
    // for no reason. JSON.stringify is the cheapest "good enough" deep
    // compare for the response sizes we get back (<1ms for a few hundred
    // devices). When the backend HAS genuinely-new data the strings
    // differ and SWR re-renders normally — same behavior in the changed
    // case, just no spurious renders in the no-op case.
    compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
    // dedupingInterval / revalidateOnFocus / shouldRetryOnError / onError
    // come from <SWRConfig> in providers/SWRProvider.jsx — no per-hook
    // override needed.
  });

  return { devices: data, isLoading, error, mutate };
}
