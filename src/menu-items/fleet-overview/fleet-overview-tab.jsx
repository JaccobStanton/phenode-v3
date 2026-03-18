import Box from '@mui/material/Box';
import pheNodeToggleIcon from 'assets/toggle_buttons/PheNode.svg';

function PheNodeMenuIcon(props) {
  return <Box component="img" src={pheNodeToggleIcon} alt="PheNode" sx={{ width: 18, height: 18 }} {...props} />;
}

// ==============================|| MENU ITEMS - FLEET OVERVIEW ||============================== //

const fleetOverviewTab = {
  id: 'group-fleet-overview',
  // title: 'Fleet Overview',
  type: 'group',
  children: [
    {
      id: 'fleet-overview',
      title: 'Fleet Overview',
      type: 'item',
      url: '/dashboard/fleet-overview',
      icon: PheNodeMenuIcon,
      breadcrumbs: true
    }
  ]
};

export default fleetOverviewTab;
