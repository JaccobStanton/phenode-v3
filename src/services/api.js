// API service surface for the V3 frontend.
//
// During the transitional period (V3 frontend, V2 backend) most of these
// functions return mock data so the rest of the app can be built against a
// stable contract. As real endpoints come online (mirroring phenodeX's
// phenode_frontend/src/services/api.js), each function below should be swapped
// for an actual `fetch` call. Component code doesn't need to change — only the
// implementation of these functions.

import { fetcher, buildUrl } from './fetcher';

import { phenodeFleetRows, sensorFleetRows } from 'data/mocks/fleet';
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
// Fleet
// ---------------------------------------------------------------------------

export const fetchPhenodeFleet = () => microDelay(phenodeFleetRows);

export const fetchSensorFleet = () => microDelay(sensorFleetRows);

// ---------------------------------------------------------------------------
// Sensor measurements
// ---------------------------------------------------------------------------

export const fetchSensorMeasurementCharts = () => microDelay(sensorMeasurementCharts);

export const fetchSoilProbeReadings = (probeId = 'probe-1') =>
  microDelay(soilProbeReadings[probeId] ?? soilProbeReadings['probe-1']);

export const fetchSensorInfo = () => microDelay(sensorInfoReadings);

// ---------------------------------------------------------------------------
// Real-fetch helpers (kept ready for when endpoints come online)
// ---------------------------------------------------------------------------

/**
 * Example real fetch wrapper for future use:
 *
 *   const url = buildUrl('/devices');
 *   return fetcher(url);
 */
export { fetcher, buildUrl };
