// assets
import { WifiOutlined } from '@ant-design/icons';

// icons
const icons = {
  WifiOutlined
};

// ==============================|| MENU ITEMS - WIRELESS SENSORS ||============================== //

const wirelessSensorsTab = {
  id: 'group-wireless-sensors',
  title: 'Wireless Sensors',
  type: 'group',
  children: [
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
