// JWT primitives that don't depend on React.
//
// History: this file used to also expose `getCurrentUser`, `clearTokens`,
// and `logout` — three helpers that read/wrote `localStorage` directly.
// Those moved into `contexts/AuthContext.jsx` so the running app has a
// single change-propagating source of truth. What remains here is:
//
//   - decodeJwtPayload — pure base64url + JSON decode of the middle JWT
//                        segment. Used by AuthContext to derive `user`
//                        and `isAuthenticated` from the access token.
//   - formatRoleLabel  — pure string formatter for the avatar dropdown
//                        ("USER" → "User Account", etc.).
//
// Verified against:
//   phenodeX/docs/frontend-backend-api.md:33-39             (JWT claim list)
//   phenodeX/phenode_backend/api/auth/routes.py:36-53       (_create_token_pair
//                                                             populates sub=email,
//                                                             role, org_id,
//                                                             is_approved, exp)

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
