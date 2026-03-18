import Box from '@mui/material/Box';

// assets
import { WifiOutlined } from '@ant-design/icons';
import wirelessSensorToggleIcon from 'assets/toggle_buttons/WS.svg';

// icons
const icons = {
  WifiOutlined
};

function WirelessSensorMenuIcon(props) {
  return <Box component="img" src={wirelessSensorToggleIcon} alt="Wireless Sensor" sx={{ width: 18, height: 18 }} {...props} />;
}

// ==============================|| MENU ITEMS - WIRELESS SENSORS ||============================== //

const wirelessSensorsTab = {
  id: 'group-wireless-sensors',
  title: 'Wireless Sensors',
  type: 'group',
  children: [
    {
      id: 'sensor-fleet-overview',
      title: 'Fleet Overview',
      type: 'item',
      url: '/dashboard/sensor-fleet-overview',
      icon: WirelessSensorMenuIcon,
      breadcrumbs: true
    },
    {
      id: 'wireless-sensors',
      title: 'Sensor Network',
      type: 'item',
      url: '/dashboard/wireless-sensors',
      icon: icons.WifiOutlined,
      breadcrumbs: true
    },
    {
      id: 'multi-sensor-graphing',
      title: 'Multi Sensor Graphing',
      type: 'item',
      url: '/dashboard/multi-sensor-graphing',
      icon: icons.WifiOutlined,
      breadcrumbs: true
    }
  ]
};

export default wirelessSensorsTab;
