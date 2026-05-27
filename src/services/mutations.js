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

/**
 * Delete a single image from a device by its filename.
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/devices/routes.py:795 —
 *   DELETE /devices/{external_device_id}/images/delete-by-filename/{filename}
 *
 * The backend uses filename (not numeric id) as the lookup key — see
 * the route signature. Filename is URL-encoded by the endpoint helper
 * so reserved characters in the name survive the path segment.
 *
 * Auth: the backend route is gated by `require_role('ADMIN')`. Non-
 * admin callers will receive 403; the caller should surface a friendly
 * "you don't have permission" toast on `error.status === 403` rather
 * than the raw ApiError message.
 *
 * Cache invalidation is the caller's responsibility — the caller
 * already holds the `mutate` callback from the useDeviceImages hook
 * and should invoke it after a successful delete to drop the row
 * from the table.
 *
 * @param {string} externalDeviceId - The device's external id.
 * @param {string} filename - The image filename to delete.
 * @param {string} accessToken - Bearer token from useAuth().
 * @returns {Promise<{success: boolean}>} `{ success: true }` on success.
 */
export const deleteDeviceImage = (externalDeviceId, filename, accessToken) =>
  mutationRequest(buildUrl(API.devices.imageDeleteByFilename(externalDeviceId, filename)), {
    method: 'DELETE',
    token: accessToken
  });

/**
 * Update the current user's preferences — timezone + units (and any
 * data-download fields the caller passes through).
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/preferences/routes.py — PUT /user-preferences
 *   Body: UserPreferencesUpdate {
 *           dataDownloadPreferences?: {...},
 *           uiPreferences?: { timezone?: string|null, units?: {...} }
 *         }
 *   Response: UserPreferencesRead { dataDownloadPreferences, uiPreferences }
 *
 * The backend MERGES uiPreferences into the existing row (not a wholesale
 * replace) — so a partial payload like `{ uiPreferences: { units: { temperature: 'C' } } }`
 * only touches the temperature field. We still send the full uiPreferences
 * object from the Account Settings form for simplicity, but the merge
 * behavior means future partial-update consumers can also use this same
 * mutation.
 *
 * @param {Object} payload - UserPreferencesUpdate shape.
 * @param {string} accessToken - Bearer token from useAuth().
 * @returns {Promise<Object>} UserPreferencesRead — the full updated record.
 */
export const updateUserPreferences = (payload, accessToken) =>
  mutationRequest(buildUrl(API.userPreferences.base), {
    method: 'PUT',
    body: payload,
    token: accessToken
  });

/**
 * Push environment variables to a device — primarily used to set the
 * WiFi SSID and password. The backend forwards the payload to Notehub
 * and the device picks up the new variables on its next sync, then
 * reboots and reconnects with the new credentials.
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/devices/routes.py:388 —
 *   POST /devices/{external_id}/environment-variables
 *   Body: arbitrary key/value pairs (DeviceEnvironmentVariablesPayload
 *         has `extra: allow`). For wifi: { wifi_ssid, wifi_password }.
 *
 * @param {string} externalDeviceId - The device's immutable external_device_id.
 * @param {Object} variables - Key/value env vars to push (e.g. { wifi_ssid, wifi_password }).
 * @param {string} accessToken - Bearer token from useAuth().
 * @returns {Promise<Object>} Backend response.
 */
export const setDeviceEnvironmentVariables = (externalDeviceId, variables, accessToken) =>
  mutationRequest(buildUrl(API.devices.environmentVariables(externalDeviceId)), {
    method: 'POST',
    body: variables,
    token: accessToken
  });

/**
 * Download a device's sensor-data CSV. Backend applies the user's
 * saved data_download_preferences (decimal places, timezone, blank/
 * zero handling, etc.) server-side before responding.
 *
 * Response shape varies:
 *   - No linked wireless sensors → `text/csv` ("phenode_sensor_data.csv")
 *   - Has linked wireless sensors → `application/zip` containing the
 *     device CSV plus one CSV per sensor ("phenode_sensor_data.zip")
 * The browser's Save As dialog gets the right filename either way
 * because mutationRequest reads Content-Disposition for us.
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/devices/routes.py:909
 *
 * @param {string} externalDeviceId - immutable external_device_id
 * @param {string} fromIso - ISO 8601 start timestamp
 * @param {string} toIso - ISO 8601 end timestamp
 * @param {string} accessToken - Bearer token from useAuth()
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadDeviceSensorData = (externalDeviceId, fromIso, toIso, accessToken) =>
  mutationRequest(buildUrl(API.devices.sensorDataDownload(externalDeviceId, fromIso, toIso)), {
    method: 'POST',
    token: accessToken,
    parseAs: 'blob'
  });

/**
 * Download a device's diagnostics/health CSV (Notecard telemetry: rssi, sinr,
 * bars, voltage, temp, …) for a date range. Mirrors downloadDeviceSensorData —
 * the backend applies the user's data_download_preferences before responding.
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/devices/routes.py:989
 *
 * @param {string} externalDeviceId - immutable external_device_id
 * @param {string} fromIso - ISO 8601 start timestamp
 * @param {string} toIso - ISO 8601 end timestamp
 * @param {string} accessToken - Bearer token from useAuth()
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadDeviceHealthData = (externalDeviceId, fromIso, toIso, accessToken) =>
  mutationRequest(buildUrl(API.devices.healthDataDownload(externalDeviceId, fromIso, toIso)), {
    method: 'POST',
    token: accessToken,
    parseAs: 'blob'
  });

/**
 * Download wireless-sensor data as a ZIP archive (one CSV per
 * requested sensor). Backend applies data_download_preferences before
 * sealing each CSV.
 *
 * For a single-sensor download, pass the one external_sensor_id as
 * `sensorList`. The archive will contain a single `{id}.csv` inside.
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/wireless_sensors/routes.py:498
 *
 * @param {string} sensorList - comma-separated external_sensor_ids
 * @param {string} fromIso - ISO 8601 start timestamp
 * @param {string} toIso - ISO 8601 end timestamp
 * @param {string} accessToken - Bearer token from useAuth()
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadWirelessSensorData = (sensorList, fromIso, toIso, accessToken) =>
  mutationRequest(buildUrl(API.wirelessSensors.sensorDataDownload(sensorList, fromIso, toIso)), {
    method: 'POST',
    token: accessToken,
    parseAs: 'blob'
  });

/**
 * Change (or set) the current user's password.
 *
 * Two flows the backend supports (per
 * phenodeX/docs/frontend-backend-api.md:340-372):
 *
 *   - Existing-password users: must pass `currentPassword` AND
 *     `newPassword`. The backend bcrypt-verifies the current value
 *     before swapping the hash.
 *   - Google-only / migrated users with no password hash yet: pass
 *     just `newPassword`. `currentPassword` should be omitted (or
 *     null) so the backend treats it as a first-time set.
 *
 * Response shape: `{ success: true, message: 'Password updated' }`.
 * The fetcher already throws ApiError on non-2xx, so callers can
 * branch on `err.status` for friendlier copy:
 *   - 400: missing current password OR new password failed validation
 *   - 401: current password incorrect
 *   - 404: user not found (shouldn't happen for a signed-in caller)
 *
 * @param {Object} payload
 * @param {string} [payload.currentPassword]
 * @param {string} payload.newPassword
 * @param {string} accessToken
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const changePassword = ({ currentPassword, newPassword }, accessToken) =>
  mutationRequest(buildUrl(API.auth.password), {
    method: 'PUT',
    body: {
      // Only include `current_password` if it was supplied — the
      // backend treats a missing key as the "no hash yet" path.
      // Sending an empty string would fail bcrypt verification on
      // existing-password accounts AND fail the no-hash branch's
      // "not yet set" guard, so absence is the safer default.
      ...(currentPassword ? { current_password: currentPassword } : {}),
      new_password: newPassword
    },
    token: accessToken
  });
