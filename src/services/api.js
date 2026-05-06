// API service surface for the V3 frontend (transitional).
//
// Long-term role of this file (per the V3 architecture sketch): a thin
// client for *mutations only* — POST/PUT/DELETE calls that don't fit
// SWR's cache-keyed-by-URL model. GETs live inside SWR hooks and key on
// the URL directly.
//
// Today this file still hosts mock fetchers for endpoints we haven't
// yet wired to a real backend:
//   - fetchSensorMeasurementCharts
//   - fetchSensorInfo
//   - fetchSoilProbeReadings        → no real endpoints exist yet
//
// As each real endpoint comes online, the corresponding mock here gets
// deleted and the hook is rewritten to key on the URL via the global
// SWR fetcher.
//
// Already migrated and removed from this file:
//   - fetchPhenodeFleet → replaced by hooks/data/useMyDevices.js, hitting
//     /api/devices/my-devices via SWR.
//   - fetchSensorFleet  → replaced by hooks/data/useMyWirelessSensors.js,
//     hitting /api/wireless-sensors/my-sensors via SWR. The list endpoint
//     was extended server-side to carry summary fields (lastMeasurementAt,
//     healthStatus, batteryPercent, soilMoisture, soilTemperatureC, rssi)
//     parallel to DeviceRead, so the fan-out N+1 detail-fetch pattern is
//     no longer needed.

import { fetcher, buildUrl } from './fetcher';

import { sensorMeasurementCharts, soilProbeReadings, sensorInfoReadings } from 'data/mocks/sensor-measurements';

export const API_URL = import.meta.env.VITE_API_URL;

// Generic delay helper so mock fetches "feel" async — keeps consumers honest.
const microDelay = (value, ms = 0) =>
  new Promise((resolve) => {
    if (ms <= 0) {
      resolve(value);
      return;
    }
    setTimeout(() => resolve(value), ms);
  });

// ---------------------------------------------------------------------------
// Sensor measurements (mock-backed)
// ---------------------------------------------------------------------------

export const fetchSensorMeasurementCharts = () => microDelay(sensorMeasurementCharts);

export const fetchSoilProbeReadings = (probeId = 'probe-1') => microDelay(soilProbeReadings[probeId] ?? soilProbeReadings['probe-1']);

export const fetchSensorInfo = () => microDelay(sensorInfoReadings);

// ---------------------------------------------------------------------------
// Real-fetch helpers (re-exported for consumers that need the raw fetcher
// or URL builder — e.g., one-off mutations not worth their own SWR hook)
// ---------------------------------------------------------------------------

export { fetcher, buildUrl };
