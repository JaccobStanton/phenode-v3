// assets
import { DashboardOutlined } from '@ant-design/icons';

// icons
const icons = {
  DashboardOutlined
};

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
      icon: icons.DashboardOutlined,
      breadcrumbs: true
    }
  ]
};

export default fleetOverviewTab;
