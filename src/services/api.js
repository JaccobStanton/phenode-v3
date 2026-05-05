// API service surface for the V3 frontend (transitional).
//
// Long-term role of this file (per the V3 architecture sketch): a thin
// client for *mutations only* — POST/PUT/DELETE calls that don't fit
// SWR's cache-keyed-by-URL model. GETs live inside SWR hooks and key on
// the URL directly.
//
// Today this file still hosts mock fetchers for endpoints we haven't
// yet wired to a real backend:
//   - fetchSensorFleet            → wireless-sensor fleet. We had a
//                                    live-data implementation but rolled
//                                    it back: the real /api/wireless-
//                                    sensors/my-sensors endpoint returns
//                                    only { _id, externalSensorId, label }
//                                    per sensor, forcing N+1 detail
//                                    fetches. Backend is updating
//                                    WirelessSensorListItem to mirror
//                                    DeviceRead (summary fields on the
//                                    list response). Until that ships,
//                                    we stay on the mock so the page
//                                    keeps rendering.
//   - fetchSensorMeasurementCharts
//   - fetchSensorInfo
//   - fetchSoilProbeReadings      → no real endpoints exist yet
//
// As each real endpoint comes online, the corresponding mock here gets
// deleted and the hook is rewritten to key on the URL via the global
// SWR fetcher.
//
// Already migrated and removed from this file:
//   - fetchPhenodeFleet → replaced by hooks/data/useMyDevices.js, which
//     hits the real /api/devices/my-devices endpoint via SWR.

import { fetcher, buildUrl } from './fetcher';

import { sensorFleetRows } from 'data/mocks/fleet';
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
// Wireless-sensor fleet (mock-backed — pending backend redesign)
// ---------------------------------------------------------------------------

export const fetchSensorFleet = () => microDelay(sensorFleetRows);

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
