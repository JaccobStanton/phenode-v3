import { Navigate, Outlet, useLocation } from 'react-router-dom';

import useAuth from 'hooks/useAuth';

// =============================================================================
// RequireAuth — route guard for everything beneath MainRoutes.
// =============================================================================
//
// Behavior:
//
//   - isAuthenticated === false → redirect to /login. The attempted URL is
//     preserved in `state.from` so a future tweak to AuthLogin can route
//     the user back to where they tried to go after a successful sign-in
//     (one-line change there: `navigate(location.state?.from?.pathname || …)`).
//
//   - isAuthenticated === true  → render <Outlet/>. The dashboard tree
//     mounts beneath this guard.
//
// Why this is a route element, not a HOC or per-page check:
//
//   - One declarative source of truth — a glance at MainRoutes.jsx makes
//     it obvious that everything under MainRoutes requires auth.
//   - New pages are protected by default (add a child route, get gating
//     for free).
//   - DashboardLayout doesn't mount for unauthenticated users — its lazy
//     chunk (drawer + header + nav + all the MUI surface area those drag
//     in) doesn't even load.
//
// Why no "checking auth…" spinner:
//
//   AuthContext hydrates synchronously in its useState initializer (see
//   contexts/AuthContext.jsx — `useState(readStoredTokens)`), so the first
//   render already knows whether a session exists. There's no async settle
//   step to wait for, and a flicker-spinner here would be cosmetic noise.
//
// Why we DON'T check `user.isApproved` here:
//
//   The `is_approved` claim is baked into the JWT at issue time. If a user
//   logs in while pending, then gets approved while sitting on
//   /approval-pending, their existing JWT still carries `is_approved=false`.
//   If RequireAuth gated on approval, that user would loop:
//     /approval-pending → (poll detects approval, navigates to /dashboard)
//                       → RequireAuth sees stale claim → /approval-pending
//                       → … forever.
//
//   The proper fix is to refresh the token (POST /api/auth/refresh) the
//   moment AuthApprovalPending detects approval, so the new JWT carries
//   the updated claim. That's part of the upcoming refresh-flow change.
//
//   Until then, approval gating lives in AuthLogin.jsx — the backend's
//   403 "pending" response on POST /api/auth/login already kicks fresh
//   sign-ins to /approval-pending. A pending user manually typing
//   /dashboard into the address bar would just see 403'd cards, which
//   is a degraded UX but not a broken one.

export default function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
