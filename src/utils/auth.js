// Lightweight auth helpers — single source of truth for reading user info
// out of the JWT and for logging out.
//
// Verified against:
//   - phenodeX/docs/frontend-backend-api.md:33-39 (JWT claim list)
//   - phenodeX/phenode_backend/api/auth/routes.py:36-53 (_create_token_pair
//     populates sub=email, role, org_id, token_type, is_approved)
//   - phenodeX/phenode_backend/api/user/routes.py (only /devices and
//     /my-devices exist — no /me endpoint, so full_name is not available
//     from the JWT or any user-scoped read endpoint at the time of writing)
//
// JWT access tokens are stored under the localStorage key `access_token`
// and refresh tokens under `refresh_token` — see AuthLogin.jsx:208-209 and
// AuthApprovalPending.jsx:99-100 for the writers/clearers already using
// these keys.

/**
 * Decode a JWT payload (the middle base64url segment) into an object.
 * Returns null on any parse/format error rather than throwing — callers
 * are typically rendering UI and shouldn't crash on a malformed token.
 */
export function decodeJwtPayload(token) {
  try {
    const seg = token?.split?.('.')?.[1];
    if (!seg) return null;
    const base64 = seg.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Read the current user's claims out of the access token in localStorage.
 * Returns:
 *   { email, role, isApproved, orgId, exp }
 * or null if no token / unparseable.
 */
export function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    email: payload.sub || '',
    role: payload.role || 'USER',
    isApproved: payload.is_approved !== false,
    orgId: payload.org_id ?? null,
    exp: payload.exp ?? null
  };
}

/**
 * Map a backend role string to a human-readable label for display.
 * Backend role values are USER | ADMIN | SUPER_ADMIN
 * (per phenodeX/docs/frontend-backend-api.md:36).
 */
export function formatRoleLabel(role) {
  switch ((role || '').toUpperCase()) {
    case 'SUPER_ADMIN':
      return 'Super Admin Account';
    case 'ADMIN':
      return 'Admin Account';
    case 'USER':
      return 'User Account';
    default:
      return 'Account';
  }
}

/**
 * Clear the stored tokens. Use this from any logout affordance — the
 * avatar-menu logout button, the approval-pending page's Log out button,
 * a 401-triggered global handler, etc.
 *
 * Doesn't navigate by itself — callers pass a `navigate` from
 * react-router-dom and we route to /login. Keeping navigation out of
 * this helper makes it usable from non-React contexts (e.g., a fetch
 * interceptor) too.
 */
export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

/**
 * Convenience: clear tokens AND navigate to /login.
 */
export function logout(navigate) {
  clearTokens();
  if (navigate) {
    navigate('/login', { replace: true });
  } else if (typeof window !== 'undefined') {
    window.location.assign('/login');
  }
}
