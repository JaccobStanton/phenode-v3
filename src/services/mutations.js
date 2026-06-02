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
 * @param {boolean} [includeWirelessSensors=true] - when false, requests the
 *   device CSV ONLY (no linked wireless-sensor CSVs bundled). Used by the
 *   "Environmental Data" download type. Backend honors this once the
 *   include_wireless_sensors flag lands; harmless no-op until then.
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadDeviceSensorData = (externalDeviceId, fromIso, toIso, accessToken, includeWirelessSensors = true) =>
  mutationRequest(buildUrl(API.devices.sensorDataDownload(externalDeviceId, fromIso, toIso, includeWirelessSensors)), {
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
 * Download a device's images as a ZIP archive (one file per image
 * captured in the date range; an S3_URLS.txt is included for any images
 * stored externally rather than inline). Always responds with
 * application/zip ("phenode_images.zip").
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/devices/routes.py:1164
 *
 * @param {string} externalDeviceId - immutable external_device_id
 * @param {string} fromIso - ISO 8601 start timestamp
 * @param {string} toIso - ISO 8601 end timestamp
 * @param {string} accessToken - Bearer token from useAuth()
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadDeviceImages = (externalDeviceId, fromIso, toIso, accessToken) =>
  mutationRequest(buildUrl(API.devices.imagesDownload(externalDeviceId, fromIso, toIso)), {
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
 * Download EVERYTHING for one device as a single ZIP archive — the
 * environmental CSV, the diagnostics/health CSV, one CSV per wireless
 * sensor, and the captured images. The backend applies the user's saved
 * data_download_preferences to each CSV before sealing the archive
 * ("all-data.zip").
 *
 * `sensorList` is a comma-separated string of external_sensor_ids. Pass
 * 'none' (or an empty selection mapped to 'none' by the caller) to let the
 * backend auto-include the sensors already linked to the device.
 *
 * Backend reference:
 *   phenodeX/phenode_backend/api/devices/routes.py:1206
 *
 * @param {string} externalDeviceId - immutable external_device_id
 * @param {string} sensorList - comma-separated external_sensor_ids, or 'none'
 * @param {string} fromIso - ISO 8601 start timestamp
 * @param {string} toIso - ISO 8601 end timestamp
 * @param {string} accessToken - Bearer token from useAuth()
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadAllDeviceData = (externalDeviceId, sensorList, fromIso, toIso, accessToken) =>
  mutationRequest(buildUrl(API.devices.allDataDownload(externalDeviceId, sensorList, fromIso, toIso)), {
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

// =============================================================================
// Admin panel mutations — SUPER_ADMIN-gated User + Device management.
// =============================================================================
//
// All of these resolve URLs through API.admin.* (services/endpoints.js) and
// go through mutationRequest, inheriting the 401-refresh-and-retry behavior.
// Callers (the admin tab components) own SWR cache invalidation — each holds
// the relevant `mutate` from useAdminData and calls it after a success.
//
// Backend reference: phenodeX/phenode_backend/api/admin/{users,routes}.py

/**
 * Create an email/password user from the admin panel.
 * Body: { email, password, full_name?, role, is_approved }.
 * Backend: POST /admin/users/ (201). 403 if a non-super-admin requests an
 * ADMIN/SUPER_ADMIN role; 409 if the email already exists.
 */
export const adminCreateUser = ({ email, password, fullName, role, isApproved }, accessToken) =>
  mutationRequest(buildUrl(API.admin.users.base), {
    method: 'POST',
    body: {
      email,
      password,
      full_name: fullName?.trim() || null,
      role,
      is_approved: isApproved
    },
    token: accessToken
  });

/**
 * Approve or reject a user. Backend: POST /admin/users/approve.
 * Body: { user_id, approved }. Returns { message, user }.
 */
export const adminApproveUser = (userId, approved, accessToken) =>
  mutationRequest(buildUrl(API.admin.users.approve), {
    method: 'POST',
    body: { user_id: userId, approved },
    token: accessToken
  });

/**
 * Create a PheNode device. Backend: POST /admin/devices (201).
 * `externalDeviceId` must not start with WS-. 409 on duplicate id/label.
 * Returns DeviceRead (use its `.id` for a follow-up assign).
 */
export const adminCreateDevice = ({ externalDeviceId, label }, accessToken) =>
  mutationRequest(buildUrl(API.admin.devices), {
    method: 'POST',
    body: {
      external_device_id: externalDeviceId,
      label: label?.trim() || null,
      organization_id: null,
      latitude: null,
      longitude: null,
      health: null,
      sensors: null
    },
    token: accessToken
  });

/**
 * Assign a device to a user. Backend: POST /admin/devices/{device_id}/assign.
 * `deviceId` is the NUMERIC db id (DeviceRead.id), not the external id.
 */
export const adminAssignDevice = (deviceId, userId, accessToken) =>
  mutationRequest(buildUrl(API.admin.deviceAssign(deviceId)), {
    method: 'POST',
    body: { user_id: userId },
    token: accessToken
  });

/**
 * Clear a device's user assignment.
 * Backend: DELETE /admin/devices/{device_id}/assign.
 */
export const adminUnassignDevice = (deviceId, accessToken) =>
  mutationRequest(buildUrl(API.admin.deviceAssign(deviceId)), {
    method: 'DELETE',
    token: accessToken
  });

/**
 * Create a wireless sensor (optionally physically linked to a device).
 * Backend: POST /admin/wireless-sensors (201). `externalSensorId` must
 * start with WS-. 409 on duplicate.
 */
export const adminCreateWirelessSensor = ({ externalSensorId, label, deviceId }, accessToken) =>
  mutationRequest(buildUrl(API.admin.wirelessSensors), {
    method: 'POST',
    body: {
      external_sensor_id: externalSensorId,
      label: label?.trim() || null,
      device_id: deviceId != null && deviceId !== '' ? Number(deviceId) : null
    },
    token: accessToken
  });

/**
 * Link a virtual wireless sensor to a PheNode device.
 * Backend: POST /admin/devices/{device_id}/wireless-sensors.
 * Body: { wireless_sensor_id }. Returns updated AdminDeviceRead.
 */
export const adminLinkWirelessSensor = (deviceId, wirelessSensorId, accessToken) =>
  mutationRequest(buildUrl(API.admin.deviceWirelessSensors(deviceId)), {
    method: 'POST',
    body: { wireless_sensor_id: Number(wirelessSensorId) },
    token: accessToken
  });

/**
 * Remove a virtual wireless-sensor mapping from a PheNode device.
 * Backend: DELETE /admin/devices/{device_id}/wireless-sensors/{wireless_sensor_id}.
 */
export const adminUnlinkWirelessSensor = (deviceId, wirelessSensorId, accessToken) =>
  mutationRequest(buildUrl(API.admin.deviceWirelessSensor(deviceId, wirelessSensorId)), {
    method: 'DELETE',
    token: accessToken
  });
