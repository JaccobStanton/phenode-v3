// project import
import fleetOverviewTab from './fleet-overview/fleet-overview-tab';
import sensorMeasurementsTab from './sensor-measurements/sensor-measurements-tab';
import wirelessSensorsTab from './wireless-sensors/wireless-sensors-tab';
import imagingTab from './imaging/imaging-tab';
import systemDiagnosticsTab from './system-diagnostics/system-diagnostics-tab';
import dataDownloadTab from './data-download/data-download-tab';


// ==============================|| MENU ITEMS ||============================== //


const menuItems = {
  items: [
    fleetOverviewTab,
    sensorMeasurementsTab,
    wirelessSensorsTab,
    imagingTab,
    systemDiagnosticsTab,
    dataDownloadTab
  ]
};

export default menuItems;
