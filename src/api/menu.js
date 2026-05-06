import useSWR, { useSWRConfig } from 'swr';
import { useCallback, useMemo } from 'react';

// =============================================================================
// Drawer-open state stored in SWR's cache so any component can read it
// without prop-drilling. Key/value shape:
//
//   key:   'api/menumaster'
//   value: { isDashboardDrawerOpened: boolean }
//
// Why SWR (not a Context or Zustand store) — this matches the Mantis
// template's existing pattern and keeps the dependency surface small,
// since SWR is already loaded for the data layer.
//
// Why the toggle is a HOOK (`useDrawerToggle`) instead of a plain
// imported function:
//
//   The previous version exported a top-level `handlerDrawerOpen()` that
//   called the global `mutate` imported from 'swr'. That global mutate
//   binds to SWR's *default* cache. Once `providers/SWRProvider.jsx`
//   was added with a custom localStorage-backed `provider:`, the
//   useSWR consumers in this hook started reading from the CUSTOM
//   cache while the global mutate kept writing to the DEFAULT cache.
//   Result: the click fired, the cache update happened, but no
//   subscriber re-rendered — the drawer button looked dead.
//
//   Fix: bind to the active SWRConfig via `useSWRConfig().mutate`.
//   That requires the toggle to live inside a hook (so it can call
//   `useSWRConfig`), so callers do:
//
//     const toggleDrawer = useDrawerToggle();
//     onClick={() => toggleDrawer(!drawerOpen)}
//
//   instead of importing a free function.
//
// Reference: https://swr.vercel.app/docs/mutation#bound-mutate
// =============================================================================

const initialState = {
  isDashboardDrawerOpened: false
};

const endpoints = {
  key: 'api/menu',
  master: 'master',
  dashboard: '/dashboard' // server URL
};

const MENU_KEY = endpoints.key + endpoints.master;

export function useGetMenuMaster() {
  const { data, isLoading } = useSWR(MENU_KEY, () => initialState, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  // `data ?? initialState` — defensive default. With a synchronous
  // fetcher SWR usually populates `data` on first render, but the
  // first paint can briefly see `undefined`. Falling back to
  // initialState keeps consumers from crashing on
  // `menuMaster.isDashboardDrawerOpened` reads.
  return useMemo(
    () => ({
      menuMaster: data ?? initialState,
      menuMasterLoading: isLoading
    }),
    [data, isLoading]
  );
}

/**
 * Returns a stable callback that toggles the dashboard drawer.
 *
 * Usage:
 *   const toggleDrawer = useDrawerToggle();
 *   <IconButton onClick={() => toggleDrawer(!drawerOpen)} />
 *
 * Why a hook (not a free function): see the file-level comment above —
 * the bound mutate from useSWRConfig() is the only one that writes to
 * the same cache the useSWR readers are subscribed to.
 */
export function useDrawerToggle() {
  const { mutate } = useSWRConfig();

  return useCallback(
    (isDashboardDrawerOpened) => {
      mutate(
        MENU_KEY,
        (currentMenuMaster) => ({
          ...(currentMenuMaster ?? initialState),
          isDashboardDrawerOpened
        }),
        false
      );
    },
    [mutate]
  );
}
