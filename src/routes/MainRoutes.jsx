import { lazy } from 'react';

// project imports
import Loadable from 'components/Loadable';

// DashboardLayout is lazy too. Previously this was a static import and
// it became part of the eager entry chunk on every route — including
// /login, where its header/drawer/navigation chrome and all the MUI
// components those depend on were loaded but never used. Verified by a
// Lighthouse audit that flagged ~105KB of unused JS in the entry on
// /login, most of which traced back to the dashboard layout tree.
//
// With this lazy(), DashboardLayout (and everything reachable from it)
// stays in its own chunk and only loads when /dashboard/* is hit.
const DashboardLayout = Loadable(lazy(() => import('layout/Dashboard')));

// render- Dashboard
const FleetOverviewPage = Loadable(lazy(() => import('pages/fleet-overview/fleet-overview')));
const SensorFleetOverviewPage = Loadable(lazy(() => import('pages/fleet-overview/sensor-fleet-overview')));
const SensorMeasurementsDefault = Loadable(lazy(() => import('pages/sensor-measurements/default')));
const SensorNetworkPage = Loadable(lazy(() => import('pages/wireless-sensors/sensor-network')));
const MultiSensorGraphingPage = Loadable(lazy(() => import('pages/wireless-sensors/multi-sensor-graphing')));
const ImagingDefault = Loadable(lazy(() => import('pages/imaging/default')));
const SystemDiagnosticsPage = Loadable(lazy(() => import('pages/system-diagnostics/system-diagnostics')));
const DataDownloadsPage = Loadable(lazy(() => import('pages/data-download/data-downloads')));
const DownloadPreferencesPage = Loadable(lazy(() => import('pages/data-download/download-preferences')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/',
  element: <DashboardLayout />,
  children: [
    // NOTE: bare '/' is intentionally NOT mapped here. LoginRoutes owns the
    // index route and redirects unauthenticated users to /login. The
    // dashboard is reachable via /dashboard/* paths below.
    {
      path: 'dashboard',
      children: [
        {
          path: 'default',
          element: <FleetOverviewPage />
        },
        {
          path: 'fleet-overview',
          element: <FleetOverviewPage />
        },
        {
          path: 'sensor-fleet-overview',
          element: <SensorFleetOverviewPage />
        },
        {
          path: 'sensor-measurements',
          element: <SensorMeasurementsDefault />
        },
        {
          path: 'wireless-sensors',
          element: <SensorNetworkPage />
        },
        {
          path: 'multi-sensor-graphing',
          element: <MultiSensorGraphingPage />
        },
        {
          path: 'imaging',
          element: <ImagingDefault />
        },
        {
          path: 'system-diagnostics',
          element: <SystemDiagnosticsPage />
        },
        {
          path: 'data-download',
          element: <DataDownloadsPage />
        },
        {
          path: 'download-preferences',
          element: <DownloadPreferencesPage />
        }
      ]
    }
  ]
};

export default MainRoutes;
