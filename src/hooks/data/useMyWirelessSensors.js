import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
import { validateSensorListResponse } from 'services/schemas/wirelessSensor';

// =============================================================================
// useMyWirelessSensors — SWR hook for GET /api/wireless-sensors/my-sensors.
// =============================================================================
//
// Returns:
//   {
//     sensors:   WirelessSensorListItem[] | undefined,  // raw, validated API shape
//     isLoading: boolean,
//     error:     ApiError | ValidationError | undefined,
//     mutate:    (data?, opts?) => Promise<WirelessSensorListItem[]>,
//   }
//
// Returning the *raw* WirelessSensorListItem[] is intentional — see the
// comment block in utils/transforms/wirelessSensor.js. Containers
// transform to view shape; the hook stays unopinionated about how the
// data is rendered.
//
// Cache key: `[buildUrl('/wireless-sensors/my-sensors'), accessToken]`
//   - Two pages calling useMyWirelessSensors() in the same session hit
//     one cached array, not two requests (deduped by SWRProvider's 15s
//     window).
//   - Including the token in the key invalidates the cache automatically
//     when the user logs out (token → null → key changes → entry orphaned).
//
// Why `null` when unauthenticated:
//   SWR treats `null` as "skip this fetch entirely." Cleaner than gating
//   with a `shouldFetch` flag and avoids a doomed 401 round-trip on
//   every mount.
//
// Why a per-hook validating fetcher (instead of the global SWR fetcher):
//   We validate the response shape AT the boundary so backend contract
//   drift fails loudly. The validating wrapper does fetch → unwrap →
//   validate → return bare array; on validation failure a Yup
//   ValidationError throws and ends up in SWR's `error`.
//
//   The endpoint response is wrapped: { success: true, sensors: [...] }
//   — see WirelessSensorsListResponse in
//   phenodeX/phenode_backend/schemas/wireless_sensors.py:84-86.
//   `validateSensorListResponse` validates the envelope and returns
//   the unwrapped array, so the hook surface stays parallel with
//   useMyDevices (no `data.sensors` indirection at the consumer).
//
// refreshInterval: 60000ms — matches useMyDevices. The fleet list is
// the kind of data that should drift toward freshness over time. If a
// page needs more frequent updates it can call mutate() directly.
//
// Migration history (here for the next person who reads this hook):
//   This used to be mock-backed because the original /my-sensors response
//   only carried { _id, externalSensorId, label } per sensor — populating
//   the metric grid required N+1 detail fetches. The backend has since
//   extended WirelessSensorListItem to carry summary fields server-side
//   (lastMeasurementAt, healthStatus, batteryPercent, soilMoisture,
//   soilTemperatureC, rssi — see schemas/wireless_sensors.py:70-81),
//   parallel to how DeviceRead exposes its summary fields. That landing
//   is what flipped this hook from mock to live.

const fetchAndValidateSensors = async (key) => {
  const data = await fetcher(key);
  return validateSensorListResponse(data);
};

export default function useMyWirelessSensors() {
  const { accessToken, isAuthenticated } = useAuth();

  const swrKey = isAuthenticated && accessToken ? [buildUrl(API.wirelessSensors.mySensors), accessToken] : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetchAndValidateSensors, {
    refreshInterval: 60000
    // dedupingInterval / revalidateOnFocus / shouldRetryOnError / onError
    // come from <SWRConfig> in providers/SWRProvider.jsx — no per-hook
    // override needed.
  });

  return { sensors: data, isLoading, error, mutate };
}
