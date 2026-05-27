import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

import { TOKENS_UPDATED_EVENT } from 'services/fetcher';
import { decodeJwtPayload } from 'utils/auth';

// =============================================================================
// AuthContext — single source of truth for the signed-in user.
// =============================================================================
//
// Why this file exists:
//   Before this, `utils/auth.js` exposed `getCurrentUser()` which re-read and
//   re-decoded the JWT from `localStorage` on every call (one-shot helper,
//   no change-propagation). That's fine when only one or two screens need
//   the user, but the dashboard now has many consumers (Profile menu, route
//   guards, fetch hooks, the approval-pending poller, etc.) and we need a
//   single state source that re-renders consumers when the token changes.
//
// What this provider owns:
//   - accessToken, refreshToken (raw strings, used by the fetcher)
//   - user (decoded claims, camelCased at this boundary)
//   - isAuthenticated (token present AND not past its `exp`)
//   - login(tokenPair) / logout()
//
// Persistence:
//   - Hydrates from localStorage at first render (useState initializer) so
//     the very first paint already reflects the persisted session — no
//     "auth-loading" flicker on a hard refresh.
//   - Writes to localStorage from login() and clears from logout(). Components
//     never read localStorage directly anymore.
//   - Listens for `storage` events so a logout in tab A is mirrored in tab B
//     without a refresh.
//
// Backend contract verified against:
//   phenodeX/docs/frontend-backend-api.md:33-39        (JWT claim list)
//   phenodeX/phenode_backend/api/auth/routes.py:36-53  (_create_token_pair
//                                                       populates sub=email,
//                                                       role, org_id,
//                                                       is_approved, exp)

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
// Frontend-only marker recording HOW the current session was authenticated.
// Persisted alongside the tokens so it survives refresh / new tab.
//
// Why this exists (and why it's a localStorage shim, not a JWT claim):
//   The access token doesn't carry an `auth_method` or `has_password`
//   claim today, so the frontend has no way to know whether a session
//   was minted via /auth/login (password) or /auth/token (Google).
//   Some UI surfaces — notably ChangePasswordTab — need to branch on
//   that signal to avoid showing a Change-Password form to a user
//   who doesn't have a password.
//
// TODO(backend has_password): when the backend adds a `has_password`
//   claim to the access token (see comment in change-password-tab.jsx),
//   delete this key + the SIGN_IN_METHOD_* plumbing and read
//   `payload.has_password` directly in userFromToken. The claim is
//   signed so it can't be spoofed; this localStorage marker can.
//   Acceptable for UX gating, NOT acceptable for authorization.
const SIGN_IN_METHOD_KEY = 'sign_in_method';

/**
 * Custom event fired immediately before logout clears tokens. Other
 * subsystems (notably SWRProvider's localStorage cache) listen for it
 * to wipe user-scoped state before the navigation away. Keeping the
 * dispatch inside AuthContext means there's a single point that
 * "owns" the logout signal — without it, every cache holder would
 * have to open-code the same localStorage / event listening dance.
 */
export const LOGOUT_EVENT = 'auth:logout';

/**
 * Decode the access token's claims into the camelCase shape the rest of
 * the app uses. Returns null when there is no token or it is unparseable.
 *
 * Why we rename at this boundary: the backend ships snake_case (`is_approved`,
 * `org_id`); the rest of the JS codebase is camelCase. Renaming here, once,
 * means component code never has to know about the backend's casing.
 */
function userFromToken(accessToken, signInMethod) {
  if (!accessToken) return null;
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  return {
    email: payload.sub || '',
    role: payload.role || 'USER',
    isApproved: payload.is_approved !== false,
    orgId: payload.org_id ?? null,
    exp: payload.exp ?? null,
    // 'password' | 'google' | null. Sourced from localStorage at this
    // boundary so consumers don't have to read it directly. See the
    // SIGN_IN_METHOD_KEY comment for the eventual JWT-claim path
    // that replaces this.
    signInMethod: signInMethod ?? null
  };
}

/**
 * "Fresh" means: the token exists, decodes, and is not past its `exp`.
 *
 * Why a missing/non-numeric `exp` counts as fresh: a malformed-but-readable
 * token shouldn't lock the UI out before the backend has even been asked.
 * We'd rather surface a real 401 from the next API call (which the fetcher's
 * refresh flow can then handle) than guess at expiry from the client.
 *
 * Why we multiply by 1000: per RFC 7519 the `exp` claim is in epoch SECONDS;
 * Date.now() is in milliseconds.
 */
function isTokenFresh(accessToken) {
  if (!accessToken) return false;
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return false;
  if (typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 > Date.now();
}

/**
 * Read both tokens out of localStorage. Wrapped in try/catch because Safari
 * private mode and some embedded webviews throw on storage access — falling
 * back to "no session" is preferable to a render crash.
 */
function readStoredTokens() {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null, signInMethod: null };
  }
  try {
    return {
      accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY),
      refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY),
      // Read the sign-in method alongside the tokens so a refresh /
      // new tab can still tell whether the current session came from
      // password or Google. Null when no value was ever written
      // (older sessions before this field existed).
      signInMethod: window.localStorage.getItem(SIGN_IN_METHOD_KEY)
    };
  } catch {
    return { accessToken: null, refreshToken: null, signInMethod: null };
  }
}

// Default value used when something tries to read auth outside a provider
// (tests, Storybook stories that don't mount AuthProvider). Returning a
// useful default — rather than `null` — avoids "Cannot read property
// 'isAuthenticated' of null" stacks on a misconfigured tree.
const defaultContextValue = {
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {}
};

// Exporting the raw context lets tests / one-off cases pass an explicit
// context object via <AuthContext.Provider value={...}>. App code should
// import the `useAuth` hook from `hooks/useAuth.js` instead.
export const AuthContext = createContext(defaultContextValue);

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  // useState's initializer runs synchronously on first render, so the very
  // first paint already reflects the persisted session.
  const [tokens, setTokens] = useState(readStoredTokens);

  /**
   * Persist a token pair and mark the user signed in.
   *
   * Accepts the backend response shape directly:
   *   { access_token, refresh_token, token_type }
   * (per phenodeX/phenode_backend/api/auth/routes.py:_create_token_pair).
   *
   * Second arg — `signInMethod` — records HOW the user authenticated
   * ('password' | 'google'). It's a frontend-only marker stored in
   * localStorage so consumers (notably ChangePasswordTab) can branch
   * their UI on it. Optional: callers that don't supply it leave the
   * existing value in place — useful for proactive refreshes
   * (AuthApprovalPending) that aren't re-authenticating, just
   * minting a fresher token.
   *
   * We don't navigate from inside login(): the caller knows where the user
   * should land (e.g., dashboard vs /approval-pending depending on the 403
   * detail), and the context shouldn't second-guess that.
   */
  const login = useCallback(({ access_token: accessToken, refresh_token: refreshToken }, signInMethod) => {
    if (typeof window !== 'undefined') {
      try {
        if (accessToken) window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        // Only write the method when the caller actually supplied one —
        // a refresh-style re-login that omits the arg leaves the
        // previously-recorded method intact.
        if (signInMethod) window.localStorage.setItem(SIGN_IN_METHOD_KEY, signInMethod);
      } catch {
        // Storage may be blocked. State below is still correct for this
        // tab — the user just won't survive a reload.
      }
    }
    setTokens((prev) => ({
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      // Same rule for in-memory state: preserve prior method when the
      // caller didn't pass one, otherwise adopt the new value.
      signInMethod: signInMethod ?? prev?.signInMethod ?? null
    }));
  }, []);

  /**
   * Clear both tokens, drop state, and route to /login.
   *
   * Default is a soft React-Router redirect. Callers that need a hard reload
   * (e.g., a fetch interceptor that wants to wipe SWR cache + in-flight
   * requests in one shot when the refresh flow gives up) can pass
   * `{ hard: true }`.
   */
  const logout = useCallback(
    ({ hard = false } = {}) => {
      if (typeof window !== 'undefined') {
        // Fire BEFORE clearing tokens so listeners (SWRProvider's cache
        // wipe) can act while the session is still notionally valid.
        // Any synchronous handlers — like the persistence cache clear —
        // get to mutate their state before the unload races.
        window.dispatchEvent(new CustomEvent(LOGOUT_EVENT));
        try {
          window.localStorage.removeItem(ACCESS_TOKEN_KEY);
          window.localStorage.removeItem(REFRESH_TOKEN_KEY);
          // Clear the sign-in method too — the next login should
          // re-record it explicitly, otherwise a Google user signing
          // out then back in as a password user would carry over the
          // stale 'google' marker.
          window.localStorage.removeItem(SIGN_IN_METHOD_KEY);
        } catch {
          // ignore — the in-memory state below is still cleared
        }
      }
      setTokens({ accessToken: null, refreshToken: null, signInMethod: null });
      if (hard && typeof window !== 'undefined') {
        window.location.assign('/login');
        return;
      }
      navigate('/login', { replace: true });
    },
    [navigate]
  );

  /**
   * Token-change listeners — two channels feeding the same handler:
   *
   *   1. `storage` event fires when localStorage is mutated in *another*
   *      tab (the spec doesn't fire `storage` for same-tab writes,
   *      which is exactly what we want — same-tab login/logout calls
   *      already update state via setTokens directly). Without this,
   *      signing out in tab A would leave tab B rendering /dashboard
   *      with stale context state until the next route change.
   *
   *   2. `auth:tokens-updated` (TOKENS_UPDATED_EVENT) is our own bus,
   *      dispatched by services/fetcher.js after a successful
   *      auto-refresh on 401. The fetcher writes new tokens to
   *      localStorage in this same tab, so `storage` doesn't fire here
   *      — we need our own signal to keep AuthContext's in-memory
   *      state in sync. Without this, every subsequent SWR hook would
   *      re-trigger refresh because its key still carries the old
   *      token from the stale context value.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refreshFromStorage = () => setTokens(readStoredTokens());

    const handleStorageEvent = (event) => {
      // event.key === null means storage was cleared entirely — re-read.
      if (
        event.key !== null &&
        event.key !== ACCESS_TOKEN_KEY &&
        event.key !== REFRESH_TOKEN_KEY &&
        event.key !== SIGN_IN_METHOD_KEY
      ) {
        return;
      }
      refreshFromStorage();
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener(TOKENS_UPDATED_EVENT, refreshFromStorage);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener(TOKENS_UPDATED_EVENT, refreshFromStorage);
    };
  }, []);

  // Memoize the value object so consumers that depend on the whole value
  // don't re-render on every parent render. login/logout are themselves
  // stable (useCallback with empty / [navigate] deps), so the only thing
  // that should churn here is the tokens object itself.
  const value = useMemo(
    () => ({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      // signInMethod is threaded into the user object so consumers
      // only have to destructure `user` to get every per-session
      // attribute. See userFromToken comment for the future
      // has_password JWT-claim migration path.
      user: userFromToken(tokens.accessToken, tokens.signInMethod),
      isAuthenticated: isTokenFresh(tokens.accessToken),
      login,
      logout
    }),
    [tokens.accessToken, tokens.refreshToken, tokens.signInMethod, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };
