import { Navigate, Outlet } from 'react-router-dom';

import useAuth from 'hooks/useAuth';

// =============================================================================
// RequireSuperAdmin — nested route guard for the admin panel.
// =============================================================================
//
// Sits BELOW RequireAuth (which already guarantees an authenticated session)
// and gates the /dashboard/admin subtree to SUPER_ADMIN only.
//
// Why SUPER_ADMIN-only on the frontend even though the backend admin routes
// accept ADMIN too:
//   The product decision is that the admin panel is a "super user" surface.
//   The menu entries (header ProfileTab + DrawerUserMenu) are gated the same
//   way, so a non-super-admin never sees the entry. This guard is the
//   belt-and-suspenders for a hand-typed /dashboard/admin URL — it bounces
//   anyone who isn't SUPER_ADMIN back to the dashboard default rather than
//   rendering a panel whose write actions the backend might still 403.
//
//   Note: this is a UX gate, not a security boundary. The real authorization
//   lives server-side (require_role on every /admin route). A determined
//   ADMIN could still call those APIs directly; that's the backend's call to
//   allow, and out of scope for this frontend gate.
//
// The role claim is read from the JWT-backed auth user (role is signed into
// the token at issue time — see contexts/AuthContext.jsx userFromToken).

export default function RequireSuperAdmin() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN';

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard/default" replace />;
  }

  return <Outlet />;
}
