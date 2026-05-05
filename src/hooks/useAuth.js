import { useContext } from 'react';

import { AuthContext } from 'contexts/AuthContext';

/**
 * Read auth state and actions from AuthContext.
 *
 * Returns:
 *   {
 *     accessToken:    string | null,
 *     refreshToken:   string | null,
 *     user:           { email, role, isApproved, orgId, exp } | null,
 *     isAuthenticated: boolean,
 *     login:          ({ access_token, refresh_token }) => void,
 *     logout:         ({ hard? }) => void,
 *   }
 *
 * Components should always go through this hook rather than reading
 * `localStorage` directly — it's what makes the context's change-
 * propagation work.
 *
 * Outside an <AuthProvider> (tests, Storybook), this returns the context's
 * default value: isAuthenticated=false, user=null, login/logout no-ops.
 * That keeps unprovided trees from crashing on first render.
 */
export default function useAuth() {
  return useContext(AuthContext);
}
