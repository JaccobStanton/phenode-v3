// assets
import wirelessSensorIconActive from 'assets/drawer-icons/WS_Fleet_Active.svg';
import wirelessSensorIconInactive from 'assets/drawer-icons/WS_Fleet.svg';
import multiGraphIconActive from 'assets/drawer-icons/Multi_Graph_Active.svg';
import multiGraphIconInactive from 'assets/drawer-icons/Multi_Graph_Inactive.svg';
import sensorMeasurementsIconActive from 'assets/drawer-icons/Wireless_Sensor_Active_Icon.svg';
import sensorMeasurementsIconInactive from 'assets/drawer-icons/Wireless_Sensor_Inactive_Icon.svg';

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
      iconInactive: wirelessSensorIconInactive,
      iconActive: wirelessSensorIconActive,
      breadcrumbs: true
    },
    {
      id: 'wireless-sensors',
      title: 'Sensor Network',
      type: 'item',
      url: '/dashboard/wireless-sensors',
      iconInactive: sensorMeasurementsIconInactive,
      iconActive: sensorMeasurementsIconActive,
      breadcrumbs: true
    },
    {
      id: 'multi-sensor-graphing',
      title: 'Multi Sensor Graphing',
      type: 'item',
      url: '/dashboard/multi-sensor-graphing',
      iconInactive: multiGraphIconInactive,
      iconActive: multiGraphIconActive,
      breadcrumbs: true
    }
  ]
};

export default wirelessSensorsTab;
