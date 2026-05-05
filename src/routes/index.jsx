import { createBrowserRouter, Outlet } from 'react-router-dom';

// project imports
import { AuthProvider } from 'contexts/AuthContext';
import SWRProvider from 'providers/SWRProvider';
import LoginRoutes from './LoginRoutes';
import MainRoutes from './MainRoutes';

// ==============================|| ROUTING RENDER ||============================== //
//
// Provider stacking lives inside the router because each provider depends
// on a router-only hook upstream of it:
//
//   <AuthProvider>      uses useNavigate() in logout()
//     <SWRProvider>     uses useAuth() to read logout for the 401 handler
//       <Outlet/>       LoginRoutes + MainRoutes render here
//     </SWRProvider>
//   </AuthProvider>
//
// A pathless layout route (this `RootProviders` component) is the standard
// React Router pattern for sharing providers across sibling subtrees
// without forcing a shared URL prefix. LoginRoutes still owns the
// `index: true` redirect at `/` → `/login`; MainRoutes' children are
// gated by RequireAuth.

const RootProviders = () => (
  <AuthProvider>
    <SWRProvider>
      <Outlet />
    </SWRProvider>
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
