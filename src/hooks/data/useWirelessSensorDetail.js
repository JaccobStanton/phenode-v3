import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';
// schemas/wirelessSensor is dynamically-imported INSIDE the fetcher
// below — see useMyWirelessSensors for the same pattern. Keeps yup
// off the eager dashboard bundle; the chunk is co-amortized with the
// list hook (whichever fires first downloads the schema module).

// =============================================================================
// useWirelessSensorDetail — SWR hook for GET /wireless-sensors/{externalSensorId}
// =============================================================================
//
// Returns:
//   {
//     sensor:    WirelessSensorDetail | undefined,  // raw, validated API shape
//     isLoading: boolean,
//     isValidating: boolean,
//     error:     ApiError | ValidationError | undefined,
//     mutate:    (data?, opts?) => Promise<WirelessSensorDetail>,
//   }
//
// Returning the *raw* WirelessSensorDetail is intentional — the
// container component owns "API shape → view shape", same convention as
// useMyDevices / useMyWirelessSensors. The detail-shape carries nested
// groups that the consumer renders directly into the Sensor Information
// card (location.altitude, battery.batteryPercent), the Soil Data
// toggle (soilSensors[0/1]), and the diagram heading
// (externalSensorId, lastMeasurement) — see
// sections/wireless-sensors/sensor-network.jsx for the rendering side.
//
// Cache key: `[buildUrl('/wireless-sensors/{id}'), accessToken]`
//   - The URL contains the externalSensorId, so each sensor gets its
//     own cache entry. Switching the dropdown to a different sensor
//     reads from cache instantly (stale-while-revalidate), then
//     refreshes in the background.
//   - Including the token in the key invalidates everything on logout.
//
// Why null when externalSensorId is missing:
//   SWR treats `null` as "skip this fetch entirely." Cleaner than
//   gating with a `shouldFetch` flag and avoids a doomed request when
//   the user lands on the page before the sensor list resolves.
//
// refreshInterval: 60000ms — matches useMyDevices / useMyWirelessSensors
// / useDeviceMeasurements. The detail object aggregates the latest
// reading; refreshing once a minute means the Sensor Info card
// freshens without piling on per-render fetches.

const fetchAndValidateSensorDetail = async (key) => {
  // Kick off the network request AND the schema-module load in parallel.
  // Same rationale as useMyWirelessSensors — the schema chunk download
  // overlaps with the API round-trip. Subsequent calls reuse the
  // cached chunk for free.
  const fetchPromise = fetcher(key);
  const schemaModulePromise = import('services/schemas/wirelessSensor');
  const [data, { validateSensorDetailResponse }] = await Promise.all([fetchPromise, schemaModulePromise]);
  return validateSensorDetailResponse(data);
};

export default function useWirelessSensorDetail(externalSensorId) {
  const { accessToken, isAuthenticated } = useAuth();

  const swrKey =
    isAuthenticated && accessToken && externalSensorId ? [buildUrl(API.wirelessSensors.detail(externalSensorId)), accessToken] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetchAndValidateSensorDetail, {
    refreshInterval: 60000,
    // Same JSON-equality compare used by useMyDevices — most poll cycles
    // return a structurally-identical detail object (no new measurement
    // since last poll), and we don't want to re-render the info card
    // for byte-identical data. JSON.stringify is fine here: the detail
    // object is small (a handful of nested groups, no time-series).
    compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });

  return { sensor: data, isLoading, isValidating, error, mutate };
}
