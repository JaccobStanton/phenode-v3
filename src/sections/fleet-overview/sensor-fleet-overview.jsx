import { useCallback, useEffect, useMemo, useState } from 'react';

import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';
import PhenodeSelector from 'components/PhenodeSelector';
import useAuth from 'hooks/useAuth';
import useMyDevices from 'hooks/data/useMyDevices';
import useMyWirelessSensors from 'hooks/data/useMyWirelessSensors';
import { renameSensor } from 'services/mutations';
import { wirelessSensorToFleetRow } from 'utils/transforms/wirelessSensor';

// Container for the wireless-sensor fleet overview page.
//
// Wireless sensors are sub-devices of PheNodes — every sensor pairs
// with one (or more) PheNode and pushes data through it. Showing the
// entire account-wide sensor list at once is slow on accounts with
// many PheNodes and almost never what the user actually wants. This
// container scopes the visible sensors to ONE PheNode at a time, with
// the PhenodeSelector dropdown letting the user switch between them.
//
// Data flow:
//
//   useMyDevices()             → DeviceRead[] (the PheNode list — populates
//                                the PhenodeSelector AND tells us which
//                                sensors belong to which PheNode via
//                                each device's `wireless_sensors[]` field).
//
//   useMyWirelessSensors()     → WirelessSensorListItem[] (the full sensor
//                                fleet — we filter this down to the
//                                selected PheNode's cohort below).
//
//   selectedPhenodeId          → external_device_id of the currently
//                                scoped PheNode. Defaults to the
//                                most-recently-reporting PheNode on
//                                first mount; user can change.
//
//   filteredSensors            → sensors whose externalSensorId appears
//                                in selectedDevice.wireless_sensors[].
//                                external_sensor_id.
//
//   wirelessSensorToFleetRow → row shape for FleetOverviewView.
//
// Loading / error consolidation:
//   Either hook still loading or in error → view shows the existing
//   loading / error cascade. The user can retry either failure via the
//   Try Again button (we wire onRetry to revalidate both hooks).

export default function SensorFleetOverview() {
  const { sensors, isLoading: sensorsLoading, error: sensorsError, mutate: mutateSensors } = useMyWirelessSensors();
  const { devices, isLoading: devicesLoading, error: devicesError, mutate: mutateDevices } = useMyDevices();
  const { accessToken } = useAuth();

  // The user's selected PheNode (external_device_id). `undefined` is
  // the "uninitialized" sentinel — distinct from `null` (no PheNode
  // available) so the auto-default useEffect can tell whether to fire.
  const [selectedPhenodeId, setSelectedPhenodeId] = useState(undefined);

  // Most-recently-reporting PheNode — the auto-default selection. If
  // no devices have measurements yet, falls back to the first device
  // alphabetically. If no devices at all, null.
  //
  // Sorted at the same -Infinity-fallback used in FleetOverviewView's
  // recency comparator so devices that have never reported sink to
  // the bottom rather than accidentally winning the "most recent"
  // race against a confirmed-recent peer.
  const defaultPhenodeId = useMemo(() => {
    if (!devices?.length) return null;
    const byRecency = [...devices].sort((a, b) => {
      const aTime = a.last_measurement_at ? new Date(a.last_measurement_at).getTime() : -Infinity;
      const bTime = b.last_measurement_at ? new Date(b.last_measurement_at).getTime() : -Infinity;
      return bTime - aTime;
    });
    return byRecency[0]?.external_device_id ?? null;
  }, [devices]);

  // Apply the auto-default once on mount (and again if the previously-
  // selected device disappears from the fleet — handles the case where
  // an SWR revalidation drops a device the user had selected).
  useEffect(() => {
    if (selectedPhenodeId === undefined) {
      // First render with data — pick the default.
      if (defaultPhenodeId) setSelectedPhenodeId(defaultPhenodeId);
      return;
    }
    // Subsequent renders — clamp to a valid selection if the user's
    // current pick has been removed from the fleet.
    const stillExists = devices?.some((d) => d.external_device_id === selectedPhenodeId);
    if (!stillExists && defaultPhenodeId) {
      setSelectedPhenodeId(defaultPhenodeId);
    }
  }, [defaultPhenodeId, devices, selectedPhenodeId]);

  // The sensors connected to the selected PheNode, identified by their
  // external_sensor_id. We use a Set for O(1) membership checks since
  // a PheNode could in principle have many sensors.
  const connectedSensorIds = useMemo(() => {
    if (!selectedPhenodeId || !devices) return new Set();
    const selected = devices.find((d) => d.external_device_id === selectedPhenodeId);
    if (!selected?.wireless_sensors?.length) return new Set();
    return new Set(selected.wireless_sensors.map((s) => s.external_sensor_id));
  }, [devices, selectedPhenodeId]);

  // Filter the full sensor list down to just the selected PheNode's
  // cohort. Returns undefined while sensors haven't loaded yet (so the
  // view's loading cascade still triggers); returns [] when sensors
  // exist but none are connected to the selected PheNode (so the
  // "empty fleet" branch fires with the scoped empty message).
  const filteredSensors = useMemo(() => {
    if (!sensors) return undefined;
    if (!selectedPhenodeId) return [];
    return sensors.filter((s) => connectedSensorIds.has(s.externalSensorId));
  }, [sensors, selectedPhenodeId, connectedSensorIds]);

  const rows = useMemo(
    () => (filteredSensors ?? []).map(wirelessSensorToFleetRow),
    [filteredSensors]
  );

  // Mirror of fleet-overview.jsx's handleRename. PUT then mutate the
  // sensor list to revalidate. Errors propagate to the view (which
  // surfaces them in the error toast).
  const handleRename = useCallback(
    async (externalId, newLabel) => {
      await renameSensor(externalId, newLabel, accessToken);
      mutateSensors();
    },
    [accessToken, mutateSensors]
  );

  // Combined retry — refresh both hooks. If either had errored, hitting
  // Try Again kicks off a fresh fetch on whichever one needs it.
  const handleRetry = useCallback(() => {
    mutateSensors();
    mutateDevices();
  }, [mutateSensors, mutateDevices]);

  // Selection-aware empty message: when a PheNode IS selected but it
  // has zero connected sensors, tell the user that explicitly rather
  // than the generic "no sensors assigned to your account" copy.
  const emptyMessage = selectedPhenodeId
    ? 'No wireless sensors connected to this PheNode yet.'
    : 'No wireless sensors assigned to your account yet.';

  return (
    <FleetOverviewView
      title="Your Fleet"
      // entityLabel drives the header line: "Sensors Active|Live|Offline: N".
      entityLabel="Sensors"
      searchPlaceholder="Search Wireless Sensors..."
      rows={rows}
      // Loading is true while EITHER hook is loading first-time data —
      // we need both before we can show anything meaningful (devices
      // for the dropdown, sensors for the cards).
      isLoading={sensorsLoading || devicesLoading}
      // Either-or for error too. Surfacing whichever errored — the
      // toast/error card text is generic enough either way.
      error={sensorsError || devicesError}
      onRetry={handleRetry}
      onRename={handleRename}
      // Render the PheNode selector via the new scopeSelector slot.
      // The selector is disabled while devices are loading; once the
      // list arrives the auto-default kicks in and the selector
      // populates with the most recently reporting PheNode.
      scopeSelector={
        <PhenodeSelector
          devices={devices}
          selectedDeviceId={selectedPhenodeId}
          onChange={setSelectedPhenodeId}
          isLoading={devicesLoading}
        />
      }
      emptyMessage={emptyMessage}
    />
  );
}
