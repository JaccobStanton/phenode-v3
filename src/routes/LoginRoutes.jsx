import { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

// project imports
import Loadable from 'components/Loadable';
import AuthWrapper from 'sections/auth/AuthWrapper';

// auth section bodies — only the inner card swaps between routes; the
// outer AuthWrapper (heavy gradients + backdrop-filter) stays mounted.
const AuthLogin = Loadable(lazy(() => import('sections/auth/AuthLogin')));
const AuthRegister = Loadable(lazy(() => import('sections/auth/AuthRegister')));
const AuthApprovalPending = Loadable(lazy(() => import('sections/auth/AuthApprovalPending')));

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
    }
  ]
};

export default LoginRoutes;
