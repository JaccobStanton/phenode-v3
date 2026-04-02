import pheNodeToggleIcon from 'assets/drawer-icons/PheNode_Fleet.svg';
import pheNodeToggleIconActive from 'assets/drawer-icons/PheNode_Fleet_Active.svg';
import realTimeIconActive from 'assets/drawer-icons/Real_Time_Icon_Active.svg';
import realTimeIconInactive from 'assets/drawer-icons/Real_Time_Icon_Inactive.svg';
import imagingIconActive from 'assets/drawer-icons/Imaging_Icon_Active.svg';
import imagingIconInactive from 'assets/drawer-icons/Imaging_Icon_Inactive.svg';
import diagnosticsIconActive from 'assets/drawer-icons/Diagnostics_Icon_Active.svg';
import diagnosticsIconInactive from 'assets/drawer-icons/Diagnostics-Icon_Inactive.svg';

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
      iconInactive: pheNodeToggleIcon,
      iconActive: pheNodeToggleIconActive,
      breadcrumbs: true
    },
    {
      id: 'sensor-measurements',
      title: 'Sensor Measurements',
      type: 'item',
      url: '/dashboard/sensor-measurements',
      iconInactive: realTimeIconInactive,
      iconActive: realTimeIconActive,
      breadcrumbs: true
    },
    {
      id: 'imaging',
      title: 'Imaging',
      type: 'item',
      url: '/dashboard/imaging',
      iconInactive: imagingIconInactive,
      iconActive: imagingIconActive,
      breadcrumbs: true
    },
    {
      id: 'system-diagnostics',
      title: 'System Diagnostics',
      type: 'item',
      url: '/dashboard/system-diagnostics',
      iconInactive: diagnosticsIconInactive,
      iconActive: diagnosticsIconActive,
      breadcrumbs: true
    }
  ]
};

export default pheNodeTab;
