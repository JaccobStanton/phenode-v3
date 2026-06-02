import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';

// =============================================================================
// useAdminData — SWR hooks for the SUPER_ADMIN admin panel list endpoints.
// =============================================================================
//
// Four read endpoints back the two admin tabs:
//
//   - GET /admin/users/pending   → UserRead[]                (pending approvals)
//   - GET /admin/users/          → UserRead[]                (all users)
//   - GET /admin/devices         → AdminDeviceRead[]         (PheNode devices)
//   - GET /admin/wireless-sensors→ AdminWirelessSensorRead[] (wireless sensors)
//
// Cache key shape `[buildUrl(path), accessToken]`:
//   - Mirrors useMyDevices / useMyWirelessSensors. The global `fetcher`
//     reads the token from the tuple's second element, so including the
//     token in the key also invalidates the cache on logout (token → null
//     → key changes → entry orphaned).
//   - `null` key when unauthenticated tells SWR to skip the fetch — avoids
//     a doomed 401 before the user object hydrates.
//
// No yup validation layer here (unlike useMyDevices): these are admin-only
// internal lists rendered into plain tables, not the typed view models the
// dashboard charts depend on. Keeping them schema-free avoids pulling yup
// into this rarely-loaded chunk. If a backend contract drift ever bites,
// the table cells degrade to "—"/empty rather than crash.
//
// refreshInterval values mirror the old v2 AdminPage cadence so the panel
// stays live as devices/sensors report in and approvals land:
//   users 5s · devices 8s · sensors 12s.

const makeKey = (path, token) => (token ? [buildUrl(path), token] : null);

export function useAdminPendingUsers() {
  const { accessToken } = useAuth();
  const { data, error, isLoading, mutate } = useSWR(makeKey(API.admin.users.pending, accessToken), fetcher, { refreshInterval: 5000 });
  return { pendingUsers: Array.isArray(data) ? data : undefined, error, isLoading, mutate };
}

export function useAdminUsers() {
  const { accessToken } = useAuth();
  const { data, error, isLoading, mutate } = useSWR(makeKey(API.admin.users.base, accessToken), fetcher, { refreshInterval: 5000 });
  return { users: Array.isArray(data) ? data : undefined, error, isLoading, mutate };
}

export function useAdminDevices() {
  const { accessToken } = useAuth();
  const { data, error, isLoading, mutate } = useSWR(makeKey(API.admin.devices, accessToken), fetcher, { refreshInterval: 8000 });
  return { devices: Array.isArray(data) ? data : undefined, error, isLoading, mutate };
}

export function useAdminWirelessSensors() {
  const { accessToken } = useAuth();
  const { data, error, isLoading, mutate } = useSWR(makeKey(API.admin.wirelessSensors, accessToken), fetcher, { refreshInterval: 12000 });
  return { sensors: Array.isArray(data) ? data : undefined, error, isLoading, mutate };
}
