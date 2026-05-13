import { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

// project imports
import Loadable from 'components/Loadable';

// AuthWrapper is the heavy auth-surface chrome (three large blurred
// gradient orbs in AuthBackground + a backdrop-filter pill). Lazy-load
// it for the SAME reason DashboardLayout in MainRoutes is lazy: a
// static `import AuthWrapper from ...` here makes it transitively
// reachable from the entry's route table, which puts AuthWrapper (and
// AuthBackground via its static import) into the main entry chunk on
// EVERY route — including /dashboard/*, where the auth surface never
// renders. Auditing /dashboard/fleet-overview confirmed those bytes
// were sitting in the unused-javascript pile. Making AuthWrapper
// lazy means its chunk only loads when /login, /register, or
// /approval-pending is hit. Visiting /login still mounts AuthWrapper
// in parallel with the inner-card lazy chunks (Suspense fallback
// covers the brief gap), so first-paint on the auth surface is
// effectively unchanged.
const AuthWrapper = Loadable(lazy(() => import('sections/auth/AuthWrapper')));

// auth section bodies — only the inner card swaps between routes; the
// outer AuthWrapper (heavy gradients + backdrop-filter) stays mounted.
const AuthLogin = Loadable(lazy(() => import('sections/auth/AuthLogin')));
const AuthRegister = Loadable(lazy(() => import('sections/auth/AuthRegister')));
const AuthApprovalPending = Loadable(lazy(() => import('sections/auth/AuthApprovalPending')));
const AuthOAuthCallback = Loadable(lazy(() => import('sections/auth/AuthOAuthCallback')));

// ==============================|| AUTH ROUTING ||============================== //
//
// Layout-route pattern: AuthWrapper is the parent route's element. It mounts
// once on first navigation into the auth surface and stays mounted across
// /login → /register → /approval-pending. Only the child <Outlet />
// content (the inner card body) swaps. This eliminates the seconds-long
// repaint that occurred when AuthWrapper's three large `filter: blur(120-140px)`
// orbs and the pill's `backdrop-filter: blur(14px)` were re-established on
// every navigation.
//
// `/` redirects to `/login` until an AuthContext is wired up that can
// route authenticated users straight to the dashboard.

const LoginRoutes = {
  path: '/',
  element: (
    <AuthWrapper>
      <Outlet />
    </AuthWrapper>
  ),
  children: [
    {
      index: true,
      element: <Navigate to="/login" replace />
    },
    {
      path: 'login',
      element: <AuthLogin />
    },
    {
      path: 'register',
      element: <AuthRegister />
    },
    {
      path: 'approval-pending',
      element: <AuthApprovalPending />
    },
    {
      // Google OAuth round-trip target. The backend's
      // GET /api/auth/google/callback handler 302s the browser here
      // with ?token=<google_id_token>, where AuthOAuthCallback finishes
      // the exchange via POST /api/auth/token. The path string must
      // match the redirect target hardcoded in
      // phenodeX/phenode_backend/api/auth/routes.py:119 — keep them
      // in sync when either side moves.
      path: 'oauth/callback',
      element: <AuthOAuthCallback />
    }
  ]
};

export default LoginRoutes;
