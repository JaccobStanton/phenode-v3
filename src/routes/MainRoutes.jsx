import { lazy } from 'react';

// project imports
import Loadable from 'components/Loadable';
import RequireAuth from './RequireAuth';

// DashboardLayout is lazy too. Previously this was a static import and
// it became part of the eager entry chunk on every route — including
// /login, where its header/drawer/navigation chrome and all the MUI
// components those depend on were loaded but never used. Verified by a
// Lighthouse audit that flagged ~105KB of unused JS in the entry on
// /login, most of which traced back to the dashboard layout tree.
//
// With this lazy(), DashboardLayout (and everything reachable from it)
// stays in its own chunk and only loads when /dashboard/* is hit —
// AND only after RequireAuth has confirmed there's an authenticated
// session. An unauthenticated visitor pasting /dashboard/fleet-overview
// into the URL bar pays zero bytes for the dashboard tree.
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

// Dev-only showcase pages. Lazy + gated so the chunks aren't shipped
// to production builds — Vite dead-code-eliminates the conditional
// route children when import.meta.env.DEV resolves to false at build
// time, and tree-shaking drops the lazy import along with them.
const FleetStatesDevPage = Loadable(lazy(() => import('pages/dev/fleet-states')));

// ==============================|| MAIN ROUTING ||============================== //
//
// Route tree shape:
//
//   /                  → RequireAuth (gates everything below; redirects
//                         unauthenticated visitors to /login)
//     dashboard        → DashboardLayout (drawer + header + main outlet)
//       default        → FleetOverviewPage
//       fleet-overview → FleetOverviewPage
//       …              → other pages
//
// Why RequireAuth wraps DashboardLayout (and not the other way around):
//   - DashboardLayout is the heavy chunk. Putting RequireAuth above it
//     means an unauthenticated URL paste never even loads the dashboard
//     bundle — RequireAuth renders a <Navigate/> and we're done.
//   - It's structurally honest: "everything under here requires auth."
//     New pages added under `dashboard` inherit the gate for free.
//
// NOTE: bare '/' is intentionally NOT mapped here. LoginRoutes' index
// child handles `/` with a redirect to /login, and is listed first in
// routes/index.jsx so it wins the match for the bare path.

const MainRoutes = {
  path: '/',
  element: <RequireAuth />,
  children: [
    {
      path: 'dashboard',
      element: <DashboardLayout />,
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
        },
        // Dev-only routes — appended conditionally so production builds
        // contain neither the route entries nor (after tree-shaking) the
        // dev-page chunks they reference. Spread an empty array in prod
        // so the literal stays a valid `children:` entry.
        ...(import.meta.env.DEV
          ? [
              {
                path: 'dev/fleet-states',
                element: <FleetStatesDevPage />
              }
            ]
          : [])
      ]
    }
  ]
};

export default MainRoutes;
