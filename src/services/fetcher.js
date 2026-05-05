// Lightweight fetcher mirroring phenodeX's pattern. Today the dashboard runs on
// mock data — this module exists so that data hooks can swap to a real backend
// later without touching component code.
//
// Once the V3 frontend is merged with the production backend, we can copy the
// full token-refresh logic from phenodeX/phenode_frontend/src/services/fetcher.js.

const getApiBaseUrl = () => import.meta.env.VITE_API_URL;

/**
 * Error type thrown by `fetcher` for non-2xx responses.
 *
 * Why this exists: SWR's global `onError` handler (see providers/SWRProvider.jsx)
 * needs to branch on the HTTP status — specifically, a 401 means "log the user
 * out." Throwing a plain `Error(message)` would force the handler to parse the
 * message text, which is brittle. Surfacing `.status` directly on the error
 * keeps the contract clean and lets every caller (current and future) make
 * status-based decisions cheaply.
 */
export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `HTTP error! status: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail ?? null;
  }
}

/**
 * Best-effort extraction of a human-readable message from a non-2xx response.
 * Tries JSON `detail` / `message`, falls back to raw text, returns null if
 * the body can't be read at all. Wrapped in nested try/catches because both
 * `response.text()` and `JSON.parse` can throw.
 */
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

/**
 * Generic JSON fetcher used by SWR.
 * @param {string|[string, string]} url - URL string or [url, token] tuple for SWR keys
 */
export const fetcher = async (url) => {
  const isTuple = Array.isArray(url);
  const target = isTuple ? url[0] : url;
  const token = isTuple ? url[1] : null;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(target, { headers, credentials: 'include' });
  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return null;
  return response.json();
};

export const buildUrl = (path) => {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
};
