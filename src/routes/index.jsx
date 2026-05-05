import { createBrowserRouter, Outlet } from 'react-router-dom';

// project imports
import { AuthProvider } from 'contexts/AuthContext';
import LoginRoutes from './LoginRoutes';
import MainRoutes from './MainRoutes';

// ==============================|| ROUTING RENDER ||============================== //
//
// `AuthProvider` lives *inside* the router as a pathless layout route. It
// has to sit below `<RouterProvider>` because its `logout()` calls
// `useNavigate()`, which only resolves inside a router context. A pathless
// parent route is the standard React Router pattern for sharing a provider
// across sibling subtrees without giving them a shared URL prefix.
//
// LoginRoutes still owns the `index: true` redirect at `/` → `/login`. Once
// `<RequireAuth>` lands (Phase 1 step 3 in the architecture sketch),
// MainRoutes' children will be wrapped in it so unauthenticated users hit
// `/dashboard/*` and bounce back to `/login`.

const RootProviders = () => (
  <AuthProvider>
    <Outlet />
  </AuthProvider>
);

const router = createBrowserRouter(
  [
    {
      element: <RootProviders />,
      children: [LoginRoutes, MainRoutes]
    }
  ],
  { basename: import.meta.env.VITE_APP_BASE_NAME }
);

export default router;
