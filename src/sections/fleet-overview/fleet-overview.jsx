import FleetOverviewView from 'sections/fleet-overview/FleetOverviewView';
import useFleet from 'hooks/data/useFleet';

export default function FleetOverview() {
  const { data: rows, isLoading } = useFleet('phenode');

  return (
    <FleetOverviewView
      title="Your Fleet"
      activeLabel="PheNodes Active:"
      activeCount={12}
      searchPlaceholder="Search PheNodes..."
      rows={rows ?? []}
      isLoading={isLoading}
    />
  );
}
