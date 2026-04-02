import downloadIconInactive from 'assets/toggle_buttons/Download_Icon_Inactive.svg';
import downloadDataIconActive from 'assets/toggle_buttons/Download_Icon_Active.svg';

// ==============================|| MENU ITEMS - DATA DOWNLOAD ||============================== //

const dataDownloadTab = {
  id: 'group-data-download',
  title: 'Data',
  type: 'group',
  children: [
    {
      id: 'data-download',
      title: 'Data Downloads',
      type: 'item',
      url: '/dashboard/data-download',
      iconInactive: downloadIconInactive,
      iconActive: downloadDataIconActive,
      breadcrumbs: true
    }
  ]
};

export default dataDownloadTab;
