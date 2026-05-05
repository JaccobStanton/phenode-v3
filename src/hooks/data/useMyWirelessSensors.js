import useSWR from 'swr';

import { fetchSensorFleet } from 'services/api';

// =============================================================================
// useMyWirelessSensors — wireless-sensor fleet, currently mock-backed.
// =============================================================================
//
// Returns:
//   {
//     rows:      Row[] | undefined,   // already-transformed row shape (mock)
//     isLoading: boolean,
//     error:     Error | undefined,
//     mutate:    SWR's revalidator
//   }
//
// =============================================================================
// Why this is mock-backed (and is staying that way for now)
// =============================================================================
//
// The real /api/wireless-sensors/my-sensors endpoint returns only
// { _id, externalSensorId, label } per sensor — see
// phenodeX/docs/frontend-backend-api.md:580. Populating the fleet
// view's metric grid (Health Status, Soil Moisture, Battery, etc.)
// requires per-sensor detail calls to /api/wireless-sensors/{externalSensorId}.
//
// We had a working live-data implementation that did the list-then-fan-out
// (1 + N requests, with Promise.allSettled for failure isolation), but
// that pattern is the wrong place for that work to live — the device
// endpoint already proves the right shape, where summary fields live
// directly on the list response (DeviceRead carries health_status,
// temperature_c, battery_percent, etc., all derived server-side).
//
// Backend is making WirelessSensorListItem parallel to DeviceRead —
// adding last_measurement_at, health_status, battery_percent,
// soil_moisture, soil_temperature_c, and rssi to the list response.
// When that lands, this hook flips to a bare useSWR([url, token])
// call (same shape as useMyDevices) and a transformer in
// utils/transforms/wirelessSensor.js handles the row mapping.
//
// Until then: mock-backed, but wrapped in SWR for shape consistency
// with the rest of the data layer.
//
// =============================================================================
// Why this still uses SWR despite being mock-backed
// =============================================================================
//
//   - Same return contract as useMyDevices (data + isLoading + error +
//     mutate). When this hook flips to a real endpoint, no consumer
//     code has to change shape.
//   - Inherits the global SWR config — when refresh-token rotation
//     gets added, every SWR hook benefits without per-hook wiring.
//   - Cache deduplication: two pages calling this hook share one
//     "request" (mock or real).

const MOCK_KEY = 'mock:wireless-sensors-fleet';

export default function useMyWirelessSensors() {
  const { data, error, isLoading, mutate } = useSWR(MOCK_KEY, () => fetchSensorFleet(), {
    // dedup + focus + retry policy come from SWRProvider; no overrides.
  });

  return { rows: data, isLoading, error, mutate };
}
