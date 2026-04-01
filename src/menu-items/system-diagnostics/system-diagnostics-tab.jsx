// assets
import { ToolOutlined } from '@ant-design/icons';

// icons
const icons = {
  ToolOutlined
};

// ==============================|| MENU ITEMS - SYSTEM DIAGNOSTICS ||============================== //

const systemDiagnosticsTab = {
  id: 'group-system-diagnostics',
  title: 'System Diagnostics',
  type: 'group',
  children: [
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

export default systemDiagnosticsTab;
