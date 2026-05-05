import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// project imports
import Loadable from 'components/Loadable';

// auth pages
const LoginPage = Loadable(lazy(() => import('pages/auth/Login')));
const RegisterPage = Loadable(lazy(() => import('pages/auth/Register')));
const ApprovalPendingPage = Loadable(lazy(() => import('pages/auth/ApprovalPending')));

// ==============================|| AUTH ROUTING ||============================== //
//
// `/` redirects to `/login` until an AuthContext is wired up that can route
// authenticated users to the dashboard. After Google sign-up, unapproved
// users will be sent to `/approval-pending`.

const LoginRoutes = {
  path: '/',
  children: [
    {
      index: true,
      element: <Navigate to="/login" replace />
    },
    {
      path: 'login',
      element: <LoginPage />
    },
    {
      path: 'register',
      element: <RegisterPage />
    },
    {
      path: 'approval-pending',
      element: <ApprovalPendingPage />
    }
  ]
};

export default LoginRoutes;
