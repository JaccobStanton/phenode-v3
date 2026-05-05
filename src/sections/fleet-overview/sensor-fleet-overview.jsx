import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';
import useMyWirelessSensors from 'hooks/data/useMyWirelessSensors';

// Container for the wireless-sensor fleet overview page.
//
// Currently mock-backed (see hooks/data/useMyWirelessSensors.js for the
// reasoning). The hook returns rows already in view shape, so this
// container has no transformation to do — it's a straight pass-through.
//
// When the backend ships the parallel-to-DeviceRead list response, the
// hook will return raw `WirelessSensorListItem[]` and a transformer
// (similar to deviceReadToFleetRow in utils/transforms/device.js) will
// land here. The view contract stays identical — only this container
// and the hook change.

export default function SensorFleetOverview() {
  const { rows, isLoading, error, mutate } = useMyWirelessSensors();

  return (
    <FleetOverviewView
      title="Your Fleet"
      activeLabel="Sensors Active:"
      activeCount={12}
      searchPlaceholder="Search Wireless Sensors..."
      rows={rows ?? []}
      isLoading={isLoading}
      error={error}
      onRetry={mutate}
      emptyMessage="No wireless sensors assigned to your account yet."
    />
  );
}
