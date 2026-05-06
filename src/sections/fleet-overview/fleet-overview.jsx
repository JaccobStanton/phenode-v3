import { useMemo } from 'react';

import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';
import useMyDevices from 'hooks/data/useMyDevices';
import { deviceReadToFleetRow } from 'utils/transforms/device';

// Container for the PheNode fleet overview page.
//
// Data flow:
//   useMyDevices() → DeviceRead[] from GET /api/devices/my-devices
//                    (validated against services/schemas/device.js,
//                    SWR-cached by URL+token, deduped via SWRConfig)
//        ↓
//   deviceReadToFleetRow → row shape { siteName, lastMeasurements, metrics[] }
//        ↓
//   FleetOverviewView renders the cards (or a state-appropriate
//   loading / empty / error card if we don't have rows yet).
//
// Why the transformation lives here, not in the hook:
//   The hook returns the API's actual shape so other consumers (a future
//   map view, an admin table, a CSV exporter) don't first have to
//   un-transform. The "view vocabulary" (siteName, metrics[].label)
//   belongs in the container that renders the view.

export default function FleetOverview() {
  const { devices, isLoading, error, mutate } = useMyDevices();

  // useMemo so the transformed array reference is stable across renders
  // when `devices` hasn't changed — that keeps FleetOverviewView's
  // useMemo (filter + sort) from re-running on every parent render.
  const rows = useMemo(() => (devices ?? []).map(deviceReadToFleetRow), [devices]);

  return (
    <FleetOverviewView
      title="Your Fleet"
      // entityLabel drives the header line: "PheNodes Active|Live|Offline: N".
      // The view derives both the word ("Active"/"Live"/"Offline") and the
      // count from its own statusFilter state — see headerStatus useMemo
      // in FleetOverviewView. The container just supplies the noun.
      entityLabel="PheNodes"
      searchPlaceholder="Search PheNodes..."
      rows={rows}
      isLoading={isLoading}
      error={error}
      onRetry={mutate}
      emptyMessage="No PheNodes assigned to your account yet."
    />
  );
}
