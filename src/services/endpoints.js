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
    token: '/auth/token'
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
    sensorData: (externalDeviceId) => `/devices/${externalDeviceId}/sensor-data`
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
    sensorData: (externalSensorId) => `/wireless-sensors/${externalSensorId}/sensor-data`
  },
  user: {
    // GET — used by AuthApprovalPending to detect approval.
    // 200 once approved, 403 while pending.
    devices: '/user/devices'
  }
};

export default API;
