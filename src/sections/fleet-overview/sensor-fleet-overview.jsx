import { useCallback, useMemo } from 'react';

import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';
import useAuth from 'hooks/useAuth';
import useMyWirelessSensors from 'hooks/data/useMyWirelessSensors';
import { renameSensor } from 'services/mutations';
import { wirelessSensorToFleetRow } from 'utils/transforms/wirelessSensor';

// Container for the wireless-sensor fleet overview page.
//
// Data flow (mirrors the PheNode container in fleet-overview.jsx):
//
//   useMyWirelessSensors() → WirelessSensorListItem[] from
//                            GET /api/wireless-sensors/my-sensors
//                            (validated against services/schemas/
//                             wirelessSensor.js, SWR-cached by URL+token,
//                             deduped via SWRConfig)
//        ↓
//   wirelessSensorToFleetRow → row shape { siteName, lastMeasurements,
//                              metrics[] }
//        ↓
//   FleetOverviewView renders the cards (or a state-appropriate
//   loading / empty / error card if rows aren't ready).
//
// Why the transformation lives here, not in the hook:
//   The hook returns the API's actual shape so other consumers (a future
//   map view, an admin table, a CSV exporter) don't first have to
//   un-transform. The "view vocabulary" (siteName, metrics[].label)
//   belongs in the container that renders the view.

export default function SensorFleetOverview() {
  const { sensors, isLoading, error, mutate } = useMyWirelessSensors();
  const { accessToken } = useAuth();

  // useMemo so the transformed array reference is stable across renders
  // when `sensors` hasn't changed — that keeps FleetOverviewView's
  // useMemo (filter + sort) from re-running on every parent render.
  const rows = useMemo(() => (sensors ?? []).map(wirelessSensorToFleetRow), [sensors]);

  // Mirror of fleet-overview.jsx's handleRename — see the matching
  // comment there for the rationale (PUT then mutate to revalidate;
  // errors propagate to the view for the toast). Different mutation
  // function (renameSensor) targeting a different endpoint, but the
  // surface is identical so FleetOverviewView's onRename contract
  // works for both fleets unchanged.
  const handleRename = useCallback(
    async (externalId, newLabel) => {
      await renameSensor(externalId, newLabel, accessToken);
      mutate();
    },
    [accessToken, mutate]
  );

  return (
    <FleetOverviewView
      title="Your Fleet"
      // entityLabel drives the header line: "Sensors Active|Live|Offline: N".
      // The view derives both the word and the count from its own
      // statusFilter state — see headerStatus useMemo in
      // FleetOverviewView. The container just supplies the noun.
      // 'Live' / 'Offline' values come from the backend's _health_status()
      // (phenode_backend/api/wireless_sensors/routes.py:161-167), passed
      // through unchanged by the wirelessSensor transformer.
      entityLabel="Sensors"
      searchPlaceholder="Search Wireless Sensors..."
      rows={rows}
      isLoading={isLoading}
      error={error}
      onRetry={mutate}
      onRename={handleRename}
      emptyMessage="No wireless sensors assigned to your account yet."
    />
  );
}
