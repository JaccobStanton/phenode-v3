// assets
import { PictureOutlined } from '@ant-design/icons';

// icons
const icons = {
  PictureOutlined
};

// ==============================|| MENU ITEMS - IMAGING ||============================== //

const imagingTab = {
  id: 'group-imaging',
  // title: 'Imaging',
  type: 'group',
  children: [
    {
      id: 'imaging',
      title: 'Imaging',
      type: 'item',
      url: '/dashboard/imaging',
      icon: icons.PictureOutlined,
      breadcrumbs: true
    }
  ]
};

export default imagingTab;
