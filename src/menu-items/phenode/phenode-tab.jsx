import Box from '@mui/material/Box';

// assets
import { DashboardOutlined, LineChartOutlined, PictureOutlined, ToolOutlined } from '@ant-design/icons';
import pheNodeToggleIcon from 'assets/drawer-icons/PheNode_Fleet.svg';

// icons
const icons = {
  DashboardOutlined,
  LineChartOutlined,
  PictureOutlined,
  ToolOutlined
};

function PheNodeMenuIcon(props) {
  return <Box component="img" src={pheNodeToggleIcon} alt="PheNode" sx={{ width: 18, height: 18 }} {...props} />;
}

// ==============================|| MENU ITEMS - PHENODE ||============================== //

const pheNodeTab = {
  id: 'group-phenode',
  title: 'PheNode',
  type: 'group',
  children: [
    {
      id: 'fleet-overview',
      title: 'Fleet Overview',
      type: 'item',
      url: '/dashboard/fleet-overview',
      icon: PheNodeMenuIcon,
      breadcrumbs: true
    },
    {
      id: 'sensor-measurements',
      title: 'Sensor Measurements',
      type: 'item',
      url: '/dashboard/sensor-measurements',
      icon: icons.LineChartOutlined,
      breadcrumbs: true
    },
    {
      id: 'imaging',
      title: 'Imaging',
      type: 'item',
      url: '/dashboard/imaging',
      icon: icons.PictureOutlined,
      breadcrumbs: true
    },
    {
      id: 'system-diagnostics',
      title: 'System Diagnostics',
      type: 'item',
      url: '/dashboard/system-diagnostics',
      icon: icons.ToolOutlined,
      breadcrumbs: true
    }
  ]
};

export default pheNodeTab;
