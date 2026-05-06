import PropTypes from 'prop-types';
import { useMemo, useRef } from 'react';
import { SWRConfig } from 'swr';

import { LOGOUT_EVENT } from 'contexts/AuthContext';
import useAuth from 'hooks/useAuth';
import { fetcher } from 'services/fetcher';

// =============================================================================
// SWRProvider — global SWR config wrapper.
// =============================================================================
//
// What it does:
//
//   - Sets the global `fetcher` from services/fetcher.js so individual hooks
//     can `useSWR(key)` without re-importing the fetcher each time.
//
//   - Persists the cache to localStorage so a hard refresh feels instant.
//     The user lands on /dashboard with last-known device data already
//     painted; SWR revalidates in the background and replaces with fresh.
//
//   - dedupingInterval: 15000 (ms) — SWR coalesces identical-key requests
//     within this window. Two pages calling the same hook in quick
//     succession share a single network request.
//
//   - revalidateOnFocus: false — heavy lists shouldn't re-fetch every
//     time the tab regains focus.
//
//   - shouldRetryOnError — SWR's default exponential-backoff retry is
//     useful for transient network errors, pointless for 401s. Skipping
//     retry on 401 also prevents a queue of doomed retries running while
//     the onError handler is mid-logout.
//
//   - onError — global hook for unrecoverable errors. The interesting
//     case is 401: hard-logout the user (clears tokens AND does
//     window.location.assign('/login') in one shot). Other statuses are
//     left for the calling page to surface — they're not "the session is
//     broken" errors.
//
// Why the persistence cache is wiped on logout:
//
//   The cache holds user-scoped data (device lists, sensor readings).
//   If user A logs out and user B logs in on the same browser, user B
//   shouldn't briefly see user A's fleet before SWR revalidates. The
//   provider listens for AuthContext's LOGOUT_EVENT and clears the Map
//   plus the localStorage entry synchronously — so by the time the
//   hard-navigation to /login fires, there's nothing user-scoped left.

const PERSIST_KEY = 'phenode:swr-cache';

/**
 * Build the SWR cache. Runs once when SWRProvider mounts. Reads any
 * persisted entries from localStorage so the first render of any
 * useSWR consumer sees instant cached data, then writes the live Map
 * back on `beforeunload` so the next session picks up where this one
 * left off.
 *
 * Why we wipe on LOGOUT_EVENT (instead of just trusting the next user
 * to revalidate over the stale data): the staleness window is small,
 * but it's a real "saw the previous user's devices for a beat" UX
 * issue on shared browsers. Clearing the Map + the localStorage entry
 * synchronously inside the listener closes that window.
 */
const createCacheProvider = () => () => {
  let map;
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(PERSIST_KEY) : null;
    map = new Map(stored ? JSON.parse(stored) : []);
  } catch {
    // Storage unreadable / JSON corrupt — start with empty cache.
    map = new Map();
  }

  if (typeof window !== 'undefined') {
    // Flush the live Map to localStorage on page unload. Wrapped in
    // try/catch because Storage can throw QuotaExceededError on full
    // quota and the unload handler must not crash the navigation.
    window.addEventListener('beforeunload', () => {
      try {
        window.localStorage.setItem(PERSIST_KEY, JSON.stringify(Array.from(map.entries())));
      } catch {
        // ignore — best-effort persistence; next load just starts cold
      }
    });

    // Wipe on logout so the next user (if any) doesn't briefly see the
    // previous user's data. Synchronous: by the time AuthContext's
    // logout finishes navigating, the persistence is already cleared.
    window.addEventListener(LOGOUT_EVENT, () => {
      map.clear();
      try {
        window.localStorage.removeItem(PERSIST_KEY);
      } catch {
        // ignore
      }
    });
  }

  return map;
};

export default function SWRProvider({ children }) {
  const { logout } = useAuth();

  // Once we've kicked off a hard logout, don't fire it again. Multiple
  // in-flight 401s would otherwise each call logout({ hard: true }) → a
  // pile of redundant window.location.assign calls. Browsers tolerate
  // that, but the ref keeps the intent (and the logs) clean.
  const hasLoggedOutRef = useRef(false);

  // Memoize the SWRConfig value object so SWR's context doesn't churn
  // on every render — that would cascade re-renders through every
  // useSWR consumer in the tree. `logout` from useAuth is itself
  // useCallback-stable (deps: [navigate]).
  //
  // Note: `provider` is constructed once via createCacheProvider() so
  // the cache Map persists across renders. SWRConfig calls the
  // provider function once at mount and reuses the returned Map for
  // the lifetime of the tree.
  const config = useMemo(
    () => ({
      fetcher,
      provider: createCacheProvider(),
      dedupingInterval: 15000,
      revalidateOnFocus: false,
      // Return the previous key's `data` while the new key's first fetch
      // is in flight. Most-importantly, this hides the "Loading…" flash
      // that used to appear after a silent token rotation:
      //
      //   Background revalidation (refreshInterval) hits an expired
      //   access token → 401 → fetcher auto-refreshes → new accessToken
      //   in localStorage → AuthContext picks up the change → SWR keys
      //   that include the token (e.g. useMyDevices, useMyWirelessSensors)
      //   change → SWR treats the new key as a fresh subscription with
      //   no cache → isLoading flips true → the fleet view flashes
      //   "Loading PheNodes/Sensors…" even though the user never actually
      //   lost their session.
      //
      // With keepPreviousData: true, SWR returns the OLD key's data
      // while the new key's fetch is pending, then swaps in the fresh
      // result on success. Token rotation becomes invisible — which is
      // the whole point of having auto-refresh in the first place.
      //
      // Trade-off: for a brief moment after a key change the user sees
      // data fetched with the previous auth context. That's fine here
      // because token rotation by definition produces the same backend
      // response; the data is identical, only the bearer changes.
      keepPreviousData: true,
      shouldRetryOnError: (err) => err?.status !== 401,
      onError: (err) => {
        if (err?.status === 401 && !hasLoggedOutRef.current) {
          hasLoggedOutRef.current = true;
          logout({ hard: true });
        }
      }
    }),
    [logout]
  );

  return <SWRConfig value={config}>{children}</SWRConfig>;
}

SWRProvider.propTypes = { children: PropTypes.node };
