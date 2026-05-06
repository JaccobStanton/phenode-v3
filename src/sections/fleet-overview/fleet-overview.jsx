import { useCallback, useMemo } from 'react';

import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';
import useAuth from 'hooks/useAuth';
import useMyDevices from 'hooks/data/useMyDevices';
import { renameDevice } from 'services/mutations';
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
  const { accessToken } = useAuth();

  // useMemo so the transformed array reference is stable across renders
  // when `devices` hasn't changed — that keeps FleetOverviewView's
  // useMemo (filter + sort) from re-running on every parent render.
  const rows = useMemo(() => (devices ?? []).map(deviceReadToFleetRow), [devices]);

  // Rename handler — the view fires this from its ConfirmRenameModal's
  // Continue button. We perform the PUT, then call SWR's `mutate` to
  // revalidate the device list so the new label appears on the card
  // without the user waiting for the next refreshInterval tick.
  //
  // Errors propagate to the view (which surfaces them in the error
  // toast); we explicitly DO NOT swallow them — the view needs the
  // ApiError so it can read `.detail` for the backend's error
  // message.
  //
  // useCallback with stable deps so the FleetOverviewView's reference
  // identity check on `onRename` doesn't churn on every parent render.
  const handleRename = useCallback(
    async (externalId, newLabel) => {
      await renameDevice(externalId, newLabel, accessToken);
      // Trigger a fresh fetch — the cached array still has the old
      // label until we revalidate.
      mutate();
    },
    [accessToken, mutate]
  );

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
      onRename={handleRename}
      emptyMessage="No PheNodes assigned to your account yet."
    />
  );
}
