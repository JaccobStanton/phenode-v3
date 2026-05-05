import PropTypes from 'prop-types';
import { useMemo, useRef } from 'react';
import { SWRConfig } from 'swr';

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
//   - dedupingInterval: 15000 (ms) — SWR coalesces identical-key requests
//     within this window. With cache-key-by-URL, two pages that both ask
//     for /api/devices/my-devices in quick succession share a single
//     network request. (Per-hook overrides exist for things that genuinely
//     need to bypass dedup.)
//
//   - revalidateOnFocus: false — heavy lists shouldn't re-fetch every time
//     the tab regains focus. Per-hook overrides exist for things that
//     should — e.g., a real-time-ish status page can pass
//     `revalidateOnFocus: true` on its useSWR call.
//
//   - shouldRetryOnError — SWR's default exponential-backoff retry is
//     useful for transient network errors, pointless for 401s (the token
//     won't fix itself by being asked again). Skipping retry on 401 also
//     prevents a queue of doomed retries running while the onError
//     handler is mid-logout.
//
//   - onError — global hook for unrecoverable errors. The interesting
//     case is 401: when the access token is rejected, hard-logout the
//     user (clears tokens AND does window.location.assign('/login') in
//     one shot, which wipes SWR cache + cancels in-flight requests).
//     Other statuses (403, 5xx, network) are left for the calling page
//     to surface — they're not "the session is broken" errors.
//
// Why this lives below AuthProvider, inside the router:
//
//   - SWRProvider needs useAuth() to read `logout` for the 401 handler.
//     useAuth requires an AuthProvider ancestor.
//
//   - AuthProvider's logout uses useNavigate(), which requires a router
//     context. So both providers live inside RouterProvider — see
//     routes/index.jsx where the stacking happens.
//
// Why not put this in App.jsx:
//
//   - It can't be — the dependency on useAuth() forces it below
//     AuthProvider, and AuthProvider has to be inside the router.
//   - Side benefit: keeps App.jsx declarative (just <ThemeCustomization>
//     + <RouterProvider>). Provider stacking lives next to the route
//     definitions where it belongs.

export default function SWRProvider({ children }) {
  const { logout } = useAuth();

  // Once we've kicked off a hard logout, don't fire it again. Multiple
  // in-flight 401s would otherwise each call logout({ hard: true }) → a
  // pile of redundant window.location.assign calls. Browsers tolerate
  // that, but the ref keeps the intent (and the logs) clean.
  const hasLoggedOutRef = useRef(false);

  // Memoize the SWRConfig value object so SWR's context doesn't churn on
  // every render — that would cascade re-renders through every useSWR
  // consumer in the tree. `logout` from useAuth is itself useCallback-
  // stable (deps: [navigate]), so this memo's deps stay stable too.
  const config = useMemo(
    () => ({
      fetcher,
      dedupingInterval: 15000,
      revalidateOnFocus: false,
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
