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
    update: (externalDeviceId) => `/devices/${externalDeviceId}`
  },
  wirelessSensors: {
    // GET — { success, sensors: WirelessSensorListItem[] } visible to current user.
    // Source: phenodeX/docs/frontend-backend-api.md:580
    mySensors: '/wireless-sensors/my-sensors',
    // GET — { success, sensor: WirelessSensorDetail }.
    // Source: same doc, line 605.
    detail: (externalSensorId) => `/wireless-sensors/${externalSensorId}`
  },
  user: {
    // GET — used by AuthApprovalPending to detect approval.
    // 200 once approved, 403 while pending.
    devices: '/user/devices'
  }
};

export default API;
