// Central catalog of backend paths. Every SWR hook and every mutation in
// `services/api.js` should resolve URLs through this module — *not* by
// inlining string literals — so a backend rename only requires editing
// one file instead of grepping every consumer.
//
// Also: SWR uses the URL as the cache key. Two hooks calling the same
// endpoint via API.devices.myDevices share a single cache entry / single
// network request automatically. Two hooks each interpolating their own
// `${API_URL}/devices/my-devices` literal would *also* share a key — but
// the moment one of them drifts (a missing slash, a trailing `?`, a typo)
// the cache splits. Centralizing prevents that whole category of bug.
//
// Verified against:
//   phenodeX/docs/frontend-backend-api.md
//   phenodeX/phenode_backend/api/*/routes.py

const API = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    googleLogin: '/auth/google/login',
    token: '/auth/token',
    // PUT — current user changes (or sets) their own password.
    // Body: { current_password?, new_password }. current_password is
    // required if the user already has a password hash; optional for
    // Google-only accounts setting one for the first time.
    // Source: phenodeX/docs/frontend-backend-api.md:340-372
    password: '/auth/password'
  },
  devices: {
    // GET — DeviceRead[] visible to current user.
    // Source: phenodeX/phenode_backend/api/devices/routes.py:38
    myDevices: '/devices/my-devices',
    // PUT — update device label. Path param is the external_device_id,
    // not the numeric DB id. Source: same file, see frontend-backend-api.md:348-360.
    update: (externalDeviceId) => `/devices/${externalDeviceId}`,
    // GET — typed JSON time-series for one device. Required query params
    // `from` / `to` (ISO-8601). Optional `fields` (CSV string), `limit`
    // (default 10000, max 100000), `bucket` ('raw' | '5m' | '10m' | '15m' |
    // '30m' | '1h' | '3h' | '6h' | '12h' | '1d' | 'auto').
    //
    // Response shape:
    //   { deviceExternalId, from, to, rows: [...] }
    //
    // Row shape depends on bucket:
    //   raw     → { time, latitude, longitude, temperature, humidity, ... }
    //   bucketed → { time, temperature_min, temperature_max, temperature_avg, ... }
    //
    // Source: phenodeX/phenode_backend/api/devices/routes.py:823
    sensorData: (externalDeviceId) => `/devices/${externalDeviceId}/sensor-data`,
    // GET — paginated list of images captured by a device, newest first.
    // Required path param: external_device_id. Optional query params:
    //   page       (default 1, min 1)
    //   page_size  (default 25, min 1, max 100)
    //   from       (ISO-8601 — filter to images at/after this timestamp)
    //   to         (ISO-8601 — filter to images at/before this timestamp)
    //
    // Response shape (ImageListResponse):
    //   {
    //     images: [{ id, device_id, timestamp, latitude, longitude,
    //                filename, s3_url, has_data }],
    //     page, page_size, total
    //   }
    //
    // The list endpoint returns *metadata only* — no base64 payload — so
    // it stays cheap to page. Use `imageDetail` to pull the full
    // base64-encoded body for a single image.
    //
    // Source: phenodeX/phenode_backend/api/devices/routes.py:572
    images: (externalDeviceId) => `/devices/${externalDeviceId}/images`,
    // GET — single image with `base64encoded` payload included
    // (ImageDetail extends ImageRead with `base64encoded`). Use when the
    // carousel/lightbox needs to display a thumbnail-less image that has
    // no `s3_url`.
    // Source: phenodeX/phenode_backend/api/devices/routes.py:649
    imageDetail: (externalDeviceId, imageId) => `/devices/${externalDeviceId}/images/${imageId}`,
    // DELETE — remove a single image identified by its filename. The
    // backend requires ADMIN role (require_role('ADMIN')) — non-admin
    // callers will receive 403. URL-encode the filename so values
    // containing reserved characters survive the path segment.
    // Source: phenodeX/phenode_backend/api/devices/routes.py:795
    imageDeleteByFilename: (externalDeviceId, filename) =>
      `/devices/${externalDeviceId}/images/delete-by-filename/${encodeURIComponent(filename)}`,
    // POST — push environment variables (Notehub vars) to a device.
    // Accepts arbitrary key/value pairs (DeviceEnvironmentVariablesPayload
    // has `extra: allow`). PheNode uses this to set wifi_ssid /
    // wifi_password — the device reboots and reconnects with the new
    // credentials. Source: phenodeX/phenode_backend/api/devices/routes.py:388
    environmentVariables: (externalDeviceId) => `/devices/${externalDeviceId}/environment-variables`,
    // POST — server-generated CSV download. The backend pulls the
    // user's saved `data_download_preferences` (decimal places,
    // timezone, blank/zero/hyphen handling) and applies them to the
    // file before responding. Response is text/csv when the device has
    // no linked wireless sensors, or application/zip when it does.
    // ISO timestamps are URL-encoded because path segments are sent
    // as-is by the browser and ':' / '+' chars can confuse some proxies.
    // Source: phenodeX/phenode_backend/api/devices/routes.py:909
    sensorDataDownload: (externalDeviceId, fromIso, toIso) =>
      `/devices/${externalDeviceId}/sensor-data/${encodeURIComponent(fromIso)}/${encodeURIComponent(toIso)}`
  },
  wirelessSensors: {
    // GET — { success, sensors: WirelessSensorListItem[] } visible to current user.
    // Each item now carries summary fields (lastMeasurementAt, healthStatus,
    // batteryPercent, soilMoisture, soilTemperatureC, rssi) populated
    // server-side via a batched latest-reading query — parallel to how
    // /devices/my-devices exposes DeviceRead summary fields.
    // Source: phenodeX/phenode_backend/api/wireless_sensors/routes.py:138-190
    //         phenodeX/phenode_backend/schemas/wireless_sensors.py:70-86
    mySensors: '/wireless-sensors/my-sensors',
    // GET — { success, sensor: WirelessSensorDetail }.
    // Source: phenodeX/docs/frontend-backend-api.md:605
    detail: (externalSensorId) => `/wireless-sensors/${externalSensorId}`,
    // GET — typed JSON time-series for one wireless sensor. Same query
    // params and response envelope as the device endpoint, with a
    // different field vocabulary (mVbat, temperatureBme, vwcPercent_1,
    // electricalConductivity_1, etc.) defined in services/downloads.py:
    // _WIRELESS_FIELD_KEYS.
    //
    // Response shape:
    //   { sensorExternalId, from, to, rows: [...] }
    //
    // Source: phenodeX/phenode_backend/api/wireless_sensors/routes.py:342
    sensorData: (externalSensorId) => `/wireless-sensors/${externalSensorId}/sensor-data`,
    // POST — server-generated ZIP download containing one CSV per
    // requested sensor. `sensorList` is a comma-separated string of
    // external_sensor_id values (the backend splits on ',', see
    // wireless_sensors/routes.py:522). User's saved
    // data_download_preferences are applied to each CSV before the
    // archive is sealed. Always responds with application/zip
    // (even for a single sensor — there's no single-CSV variant of
    // this endpoint). Source: phenodeX/phenode_backend/api/wireless_sensors/routes.py:498
    sensorDataDownload: (sensorList, fromIso, toIso) =>
      `/wireless-sensors/sensor-data/${encodeURIComponent(sensorList)}/${encodeURIComponent(fromIso)}/${encodeURIComponent(toIso)}`
  },
  user: {
    // GET — used by AuthApprovalPending to detect approval.
    // 200 once approved, 403 while pending.
    devices: '/user/devices'
  },
  userPreferences: {
    // GET — UserPreferencesRead for the current user. Auto-creates a
    // preferences row with defaults if one doesn't exist yet.
    // PUT — accepts UserPreferencesUpdate; merges uiPreferences with the
    // existing row instead of replacing wholesale.
    // Source: phenodeX/phenode_backend/api/preferences/routes.py
    base: '/user-preferences'
  }
};

export default API;
