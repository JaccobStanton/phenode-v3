import { createBrowserRouter } from 'react-router-dom';

// project imports
import MainRoutes from './MainRoutes';
import LoginRoutes from './LoginRoutes';

// ==============================|| ROUTING RENDER ||============================== //
//
// LoginRoutes is listed first so the index ('/') redirect to /login wins
// over MainRoutes' DashboardLayout. Once an AuthContext is wired up the
// order can be adjusted (or a guard added) to send authenticated users
// straight to the dashboard.

const router = createBrowserRouter([LoginRoutes, MainRoutes], { basename: import.meta.env.VITE_APP_BASE_NAME });

export default router;
