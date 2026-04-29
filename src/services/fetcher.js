// Lightweight fetcher mirroring phenodeX's pattern. Today the dashboard runs on
// mock data — this module exists so that data hooks can swap to a real backend
// later without touching component code.
//
// Once the V3 frontend is merged with the production backend, we can copy the
// full token-refresh logic from phenodeX/phenode_frontend/src/services/fetcher.js.

const getApiBaseUrl = () => import.meta.env.VITE_API_URL;

const buildErrorMessage = async (response) => {
  let detail = `HTTP error! status: ${response.status}`;
  try {
    const text = await response.text();
    if (!text) return detail;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail || parsed?.message || text || detail;
    } catch {
      detail = text;
    }
  } catch {
    // keep default message
  }
  return detail;
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
    throw new Error(await buildErrorMessage(response));
  }
  if (response.status === 204) return null;
  return response.json();
};

export const buildUrl = (path) => {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
};
