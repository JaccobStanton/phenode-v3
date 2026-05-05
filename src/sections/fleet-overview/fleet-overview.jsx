import { useMemo } from 'react';

import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';
import useMyDevices from 'hooks/data/useMyDevices';
import { deviceReadToFleetRow } from 'utils/transforms/device';

// Container for the PheNode fleet overview page.
//
// Data flow:
//   useMyDevices() → DeviceRead[] from GET /api/devices/my-devices
//                    (SWR caches by URL+token, deduped via SWRConfig)
//        ↓
//   deviceReadToFleetRow → row shape { siteName, lastMeasurements, metrics[] }
//        ↓
//   FleetOverviewView renders the cards.
//
// Why the transformation lives here, not in the hook:
//   The hook returns the API's actual shape so other consumers (a future
//   map view, an admin table, a CSV exporter) don't first have to
//   un-transform. The "view vocabulary" (siteName, metrics[].label)
//   belongs in the container that renders the view.
//
// The active count on screen is currently a placeholder — once the
// backend exposes a fleet-wide active count (or once we count
// `health_status === 'Live'` here), wire it in.

export default function FleetOverview() {
  const { devices, isLoading } = useMyDevices();

  // useMemo so the transformed array reference is stable across renders
  // when `devices` hasn't changed — that keeps FleetOverviewView's
  // useMemo (filter + sort) from re-running on every parent render.
  const rows = useMemo(() => (devices ?? []).map(deviceReadToFleetRow), [devices]);

  const activeCount = rows.filter((row) => row.metrics.find((m) => m.label === 'Health Status:')?.value === 'Live').length;

  return (
    <FleetOverviewView
      title="Your Fleet"
      activeLabel="PheNodes Active:"
      activeCount={activeCount}
      searchPlaceholder="Search PheNodes..."
      rows={rows}
      isLoading={isLoading}
    />
  );
}
