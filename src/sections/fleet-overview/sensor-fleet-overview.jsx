import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';
import useFleet from 'hooks/data/useFleet';

export default function SensorFleetOverview() {
  const { data: rows, isLoading } = useFleet('sensor');

  return (
    <FleetOverviewView
      title="Your Fleet"
      activeLabel="Sensors Active:"
      activeCount={12}
      searchPlaceholder="Search Wireless Sensors..."
      rows={rows ?? []}
      isLoading={isLoading}
    />
  );
}
