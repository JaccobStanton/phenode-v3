import { lazy } from 'react';

// project imports
import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';

// render- Dashboard
const FleetOverviewPage = Loadable(lazy(() => import('pages/fleet-overview/fleet-overview')));
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
    {
      path: '/',
      element: <FleetOverviewPage />
    },
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
