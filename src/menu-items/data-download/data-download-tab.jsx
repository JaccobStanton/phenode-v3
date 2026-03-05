// assets
import { DownloadOutlined } from '@ant-design/icons';

// icons
const icons = {
  DownloadOutlined
};

// ==============================|| MENU ITEMS - DATA DOWNLOAD ||============================== //

const dataDownloadTab = {
  id: 'group-data-download',
  // title: 'Data Download',
  type: 'group',
  children: [
    {
      id: 'data-download',
      title: 'Data Download',
      type: 'item',
      url: '/dashboard/data-download',
      icon: icons.DownloadOutlined,
      breadcrumbs: true
    }
  ]
};

export default dataDownloadTab;
