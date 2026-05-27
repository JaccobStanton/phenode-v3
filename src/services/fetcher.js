// =============================================================================
// fetcher — central HTTP client with automatic token refresh on 401.
// =============================================================================
//
// Public surface:
//
//   fetcher(url)            Main SWR fetcher. Sends Authorization: Bearer
//                           when called with the [url, token] tuple form.
//                           On 401, transparently refreshes the access
//                           token and retries the request once. If refresh
//                           or retry fails, throws ApiError(401) — which
//                           SWRProvider.onError catches and hard-logs out.
//
//   refreshTokens(rt)       Pure helper for callers that need to refresh
//                           proactively (e.g., AuthApprovalPending after
//                           the backend reports approval — the existing
//                           JWT still carries is_approved=false until
//                           we mint a fresh one).
//
//   ApiError                Error class with `.status` / `.detail`. Used
//                           by SWRProvider.onError to branch on 401.
//
//   buildUrl(path)          Prefix VITE_API_URL onto a relative path.
//
//   TOKENS_UPDATED_EVENT    Custom event fired after a same-tab refresh
//                           writes new tokens. AuthContext listens for it
//                           so its in-memory state stays in sync — the
//                           browser's native `storage` event only fires
//                           cross-tab, not for same-tab setItem calls.
//
// Refresh contract (POST /api/auth/refresh):
//   request:  { refresh_token: string }
//   response: { access_token, refresh_token, token_type }
// per phenodeX/docs/frontend-backend-api.md:300-319 and
// phenodeX/phenode_backend/api/auth/routes.py.
//
// Concurrency:
//   The auto-refresh path holds a single in-flight refresh promise so a
//   burst of simultaneous 401s only triggers one /auth/refresh call.
//   All awaiters share the result.

import API from './endpoints';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Custom event name fired after the fetcher writes a freshly-refreshed
 * token pair to localStorage. AuthContext listens for it; component
 * code never has to.
 *
 * Why a custom event instead of relying on the native `storage` event:
 * `storage` only fires cross-tab. The fetcher's auto-refresh runs in
 * the same tab as the AuthContext, so without our own bus the context's
 * in-memory state would lag behind localStorage until the next route
 * change.
 */
export const TOKENS_UPDATED_EVENT = 'auth:tokens-updated';

const getApiBaseUrl = () => import.meta.env.VITE_API_URL;

/**
 * Error type thrown by `fetcher` for non-2xx responses. Carries
 * `.status` so callers (notably SWRProvider's global onError handler)
 * can branch on the HTTP status without parsing the message text.
 */
export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `HTTP error! status: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail ?? null;
  }
}

const parseErrorDetail = async (response) => {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed?.detail || parsed?.message || text;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
};

export const buildUrl = (path) => {
  // Fall back to a relative `/api` prefix when VITE_API_URL is unset
  // (e.g. on a Netlify deploy that relies on a /api/* proxy rule
  // instead of a baked-in absolute URL). Without this fallback every
  // call would hit the bare path on the deploy origin, the SPA
  // catch-all would serve index.html as text/html, and downstream
  // response.json() would throw a SyntaxError.
  //
  // Mirrors the same `|| '/api'` fallback used in AuthLogin.jsx and
  // AuthRegister.jsx for the OAuth handoff URL.
  const base = getApiBaseUrl() || '/api';
  return `${base}${path}`;
};

/**
 * Pure helper — POST /api/auth/refresh with a refresh token. Returns
 * the new token pair on success; throws ApiError on any failure
 * (network, 4xx, 5xx, malformed body).
 *
 * Why this is a separate exported function instead of being inlined
 * into the auto-refresh path:
 *   AuthApprovalPending also needs to refresh proactively — when the
 *   backend reports the user has been approved, the existing access
 *   token still carries `is_approved=false` until we mint a fresh
 *   one. Sharing this helper means both code paths use exactly the
 *   same request shape.
 *
 * Crucially, this uses raw `fetch` (not the wrapping fetcher) — if it
 * went through fetcher and the refresh endpoint itself returned 401,
 * we'd recurse forever.
 */
export const refreshTokens = async (refreshToken) => {
  if (!refreshToken) {
    throw new ApiError(401, 'No refresh token available');
  }
  const response = await fetch(buildUrl(API.auth.refresh), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    credentials: 'include'
  });
  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new ApiError(response.status, detail);
  }
  const data = await response.json();
  if (!data?.access_token) {
    throw new ApiError(401, 'Refresh response missing access_token');
  }
  return data;
};

/**
 * Internal: write new tokens to localStorage and notify same-tab
 * listeners (AuthContext) via the TOKENS_UPDATED_EVENT bus. Used only
 * by the auto-refresh path; AuthApprovalPending uses login() from
 * useAuth() to persist instead.
 */
const persistRefreshedTokens = ({ access_token: accessToken, refresh_token: refreshToken }) => {
  if (typeof window === 'undefined') return;
  try {
    if (accessToken) window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // Storage may be blocked in private mode / embedded webviews. The
    // new access token is still returned to the in-flight retry; we
    // just won't survive a hard reload.
  }
  window.dispatchEvent(new CustomEvent(TOKENS_UPDATED_EVENT));
};

/**
 * Internal singleton: only one /auth/refresh call in flight at a time.
 * Reset to null after settle so a future 401 burst can refresh again.
 */
let inflightRefresh = null;

const refreshForRetry = async () => {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    let storedRefreshToken = null;
    if (typeof window !== 'undefined') {
      try {
        storedRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
      } catch {
        // ignore — falls through to "no token" branch below
      }
    }

    let newTokens;
    try {
      newTokens = await refreshTokens(storedRefreshToken);
    } catch (err) {
      // Translate any refresh failure into a terminal 401 so the
      // caller (fetcher) throws ApiError(401), which
      // SWRProvider.onError catches → hard logout. Better to
      // occasionally false-logout than leave the user in a half-
      // broken state with stale tokens.
      console.warn('[auth] token refresh failed; session is unrecoverable:', err);
      throw new ApiError(401, 'Session refresh failed');
    }

    persistRefreshedTokens(newTokens);
    return newTokens.access_token;
  })();

  try {
    return await inflightRefresh;
  } finally {
    inflightRefresh = null;
  }
};

/**
 * Generic JSON fetcher used by SWR.
 *
 * @param {string|[string, string]} url - URL string or [url, token]
 *                                        tuple for SWR keys
 *
 * Behavior:
 *   - 2xx           → returns parsed JSON (or null for 204)
 *   - 401           → refreshes the access token via refreshForRetry(),
 *                     retries the request once. If the refresh fails
 *                     or the retry returns another 401, throws
 *                     ApiError(401).
 *   - other non-2xx → throws ApiError(status, detail)
 *
 * Why we don't refresh on 403/5xx: those aren't "session is broken"
 * errors. 403 = correctly authenticated but not authorized; 5xx = the
 * server's having a bad time. Refreshing wouldn't help in either case.
 */
export const fetcher = async (url) => {
  const isTuple = Array.isArray(url);
  const target = isTuple ? url[0] : url;
  const initialToken = isTuple ? url[1] : null;

  const buildHeaders = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  let response = await fetch(target, {
    headers: buildHeaders(initialToken),
    credentials: 'include'
  });

  // 401 → refresh once, retry once. refreshForRetry() throws
  // ApiError(401) on failure; let it propagate.
  if (response.status === 401) {
    const newAccessToken = await refreshForRetry();
    response = await fetch(target, {
      headers: buildHeaders(newAccessToken),
      credentials: 'include'
    });
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return null;
  return response.json();
};

/**
 * Pull the filename out of a Content-Disposition header. Returns
 * `null` if the header is missing or doesn't carry a filename. Used by
 * file-download mutations so the browser's "Save As" dialog gets the
 * name the backend chose (e.g. "phenode_sensor_data.csv" instead of a
 * blob UUID).
 *
 * Supports both the legacy `filename="..."` form and the RFC 5987
 * `filename*=UTF-8''...` form (which FastAPI emits for non-ASCII
 * names).
 */
const filenameFromContentDisposition = (header) => {
  if (!header || typeof header !== 'string') return null;
  // RFC 5987 form first — preferred when present.
  const star = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // ignore, fall through to legacy
    }
  }
  const legacy = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return legacy ? legacy[1].trim() : null;
};

/**
 * Mutation request — sibling to `fetcher` for non-GET calls (PUT, POST,
 * PATCH, DELETE) that carry a JSON body.
 *
 * Why a parallel function instead of extending `fetcher`:
 *   `fetcher` is what SWRConfig hands every useSWR consumer as the
 *   default fetcher. SWR calls it with `(key)` — a single argument. If
 *   we made `fetcher` accept an options object as a second arg, every
 *   SWR consumer would need to either ignore the new shape or wrap it,
 *   and we'd risk subtle bugs where a default parameter for an SWR
 *   call leaked into a mutation. Keeping the read path single-arg and
 *   the write path explicitly opted-in via this function preserves
 *   that separation.
 *
 * Shares the same auto-401-refresh-and-retry behavior as `fetcher` so
 * a stale access token during a rename mutation transparently gets a
 * fresh one and the request continues. The `parseErrorDetail` is also
 * reused so callers can pull `.detail` off the thrown ApiError to
 * surface backend validation messages in toasts.
 *
 * @param {string} url - Absolute URL (build via buildUrl()).
 * @param {Object} options
 * @param {string} options.method - 'PUT', 'POST', 'PATCH', 'DELETE'.
 * @param {Object} [options.body] - JSON-serializable body. Omit for empty body.
 * @param {string} [options.token] - Access token. Caller passes the
 *                                   current token from useAuth(); the
 *                                   refresh path swaps it transparently
 *                                   on 401.
 * @param {'json'|'blob'} [options.parseAs='json'] - How to read the
 *   response body. 'json' (default) returns parsed JSON (or null on
 *   204). 'blob' returns `{ blob, filename }` for file downloads —
 *   filename comes from the response's Content-Disposition header,
 *   `null` when the server didn't send one.
 *
 * @returns {Promise<*>} See `parseAs` for the return shape.
 * @throws {ApiError} On any non-2xx after the refresh-and-retry attempt.
 */
export const mutationRequest = async (url, { method, body, token, parseAs = 'json' } = {}) => {
  const buildHeaders = (currentToken) => {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
    return headers;
  };

  const init = (currentToken) => ({
    method,
    headers: buildHeaders(currentToken),
    credentials: 'include',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  let response = await fetch(url, init(token));

  if (response.status === 401) {
    const newAccessToken = await refreshForRetry();
    response = await fetch(url, init(newAccessToken));
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return null;

  if (parseAs === 'blob') {
    const blob = await response.blob();
    const filename = filenameFromContentDisposition(response.headers.get('Content-Disposition'));
    return { blob, filename };
  }
  return response.json();
};
