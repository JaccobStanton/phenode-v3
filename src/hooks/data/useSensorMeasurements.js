import useSWR from 'swr';

import { fetchSensorMeasurementCharts, fetchSensorInfo, fetchSoilProbeReadings } from 'services/api';

// =============================================================================
// Sensor-measurement hooks — currently mock-backed, SWR-shaped.
// =============================================================================
//
// These hooks have no real-backend endpoints established yet. They're
// scaffolded against mock data so consumers can be built against a stable
// contract today; when the backend lands, only the SWR key + fetcher per
// hook needs to change.
//
// All three follow the same pattern as useMyDevices: SWR with a
// per-hook unique key, an inline fetcher pointing at the mock function,
// and the SWRProvider's global dedup / focus / retry / 401 policy.
//
// Why each hook gets its own sentinel key (instead of, say, a single
// 'mock:sensor-measurements' that returns everything):
//   - SWR dedupes / caches per key. Three keys = three independent
//     cache entries that revalidate independently.
//   - When these flip to real endpoints, each hook will key on its
//     own URL anyway — keeping the keys split now means zero consumer
//     churn at flip time.
//
// useSoilProbeReadings is parameterized by `probeId`. Its key is a
// tuple [sentinel, probeId] so changing the probe re-keys SWR (cache
// hit per probe, no manual invalidation needed).

const MOCK_KEY_CHARTS = 'mock:sensor-measurement-charts';
const MOCK_KEY_INFO = 'mock:sensor-info';
const MOCK_KEY_SOIL = 'mock:soil-probe-readings';

/**
 * Returns the measurement-chart series for the active sensor.
 */
export function useSensorMeasurementCharts() {
  const { data, error, isLoading, mutate } = useSWR(MOCK_KEY_CHARTS, () => fetchSensorMeasurementCharts());
  return { data, isLoading, error, mutate };
}

/**
 * Returns the sensor info readings (mock-backed).
 */
export function useSensorInfo() {
  const { data, error, isLoading, mutate } = useSWR(MOCK_KEY_INFO, () => fetchSensorInfo());
  return { data, isLoading, error, mutate };
}

/**
 * Returns the soil-probe readings for a single probe.
 *
 * @param {string} probeId  The probe identifier; the SWR cache is keyed
 *                          per-probe so switching probes hits a fresh
 *                          cache slot rather than re-using a stale one.
 */
export function useSoilProbeReadings(probeId = 'probe-1') {
  const { data, error, isLoading, mutate } = useSWR([MOCK_KEY_SOIL, probeId], ([, id]) => fetchSoilProbeReadings(id));
  return { data, isLoading, error, mutate };
}
