// =============================================================================
// Mutations — non-SWR write calls (PUT/POST/DELETE) for the V3 frontend.
// =============================================================================
//
// SWR hooks live in hooks/data/* and own the read side. This module owns
// the write side — calls that update server state and don't fit the
// useSWR-keyed-by-URL model.
//
// Each function here:
//
//   1. Resolves the URL via services/endpoints.js (single source of
//      truth for backend paths — a backend rename only edits one file).
//   2. Calls mutationRequest from services/fetcher.js, which provides
//      the same 401-auto-refresh-and-retry behavior the SWR fetcher
//      has. Callers don't need to think about token rotation.
//   3. Returns the parsed JSON response on success or throws ApiError
//      on failure. Callers (typically a mutation handler in a view
//      component) catch the ApiError and surface its `.detail` in a
//      toast.
//
// Cache invalidation is the CALLER's responsibility — these functions
// don't know which SWR keys hold the data they just changed. The
// container component already has the SWR `mutate` callback in scope
// and invokes it after a successful rename.

import API from './endpoints';
import { buildUrl, mutationRequest } from './fetcher';

/**
 * Rename a PheNode (device) — sets the user-facing label. The
 * external_device_id remains the immutable hardware identifier.
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/devices/routes.py — PUT /devices/{external_device_id}
 *   Body: { label: string }
 *
 * @param {string} externalDeviceId - The device's immutable external_device_id.
 * @param {string} label - The new user-facing label.
 * @param {string} accessToken - Bearer token from useAuth().
 * @returns {Promise<Object>} Updated device object from the backend.
 */
export const renameDevice = (externalDeviceId, label, accessToken) =>
  mutationRequest(buildUrl(API.devices.update(externalDeviceId)), {
    method: 'PUT',
    body: { label },
    token: accessToken
  });

/**
 * Rename a wireless sensor — sets the user-facing label. The
 * external_sensor_id remains the immutable hardware identifier.
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/wireless_sensors/routes.py:229 —
 *   PUT /wireless-sensors/{external_sensor_id}
 *   Body: { label: string }  (and optionally location/lat/lon, omitted here)
 *
 * @param {string} externalSensorId - The sensor's immutable externalSensorId.
 * @param {string} label - The new user-facing label.
 * @param {string} accessToken - Bearer token from useAuth().
 * @returns {Promise<Object>} { success, sensor: {...} } envelope from the backend.
 */
export const renameSensor = (externalSensorId, label, accessToken) =>
  mutationRequest(buildUrl(API.wirelessSensors.detail(externalSensorId)), {
    method: 'PUT',
    body: { label },
    token: accessToken
  });
