// assets
import { LineChartOutlined } from '@ant-design/icons';

// icons
const icons = {
  LineChartOutlined
};

// ==============================|| MENU ITEMS - SENSOR MEASUREMENTS ||============================== //

const sensorMeasurementsTab = {
  id: 'group-sensor-measurements',
  // title: 'Sensor Measurements',
  type: 'group',
  children: [
    {
      id: 'sensor-measurements',
      title: 'Sensor Measurements',
      type: 'item',
      url: '/dashboard/sensor-measurements',
      icon: icons.LineChartOutlined,
      breadcrumbs: true
    }
  ]
};

export default sensorMeasurementsTab;
