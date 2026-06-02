import { useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'components/MainCard';
import { glassSurfaceSx, reflectedCardChromeSx } from 'themes/sx-tokens';

import UserManagementTab from './tabs/user-management-tab';
import DeviceManagementTab from './tabs/device-management-tab';

// assets
import AntIcon from 'components/AntIcon';
import TeamOutlined from '@ant-design/icons-svg/lib/asn/TeamOutlined';
import DesktopOutlined from '@ant-design/icons-svg/lib/asn/DesktopOutlined';

// =============================================================================
// AdminPanel — SUPER_ADMIN control surface.
// =============================================================================
//
// Two tabs, mirroring the v2 AdminPage the team already knows:
//
//   - User Management   — create users, approve/reject pending signups,
//                          browse all users.            (tabs/user-management-tab.jsx)
//   - Device Management — register PheNodes + wireless sensors, map virtual
//                          sensors, assign devices to users.
//                                                        (tabs/device-management-tab.jsx)
//
// The shell here just renders the header banner + tab strip; each tab owns its
// own data loading (useAdminData hooks), mutations (services/mutations.js), and
// toast feedback (providers/ToastProvider). This is the same shape as
// sections/account-settings/account-settings.jsx, so the two destinations read
// as native siblings.
//
// Access is gated upstream by routes/RequireSuperAdmin.jsx and the
// SUPER_ADMIN-only profile-menu entries — this component assumes the viewer
// is already a super admin and does no gating of its own.

// Themed Tabs sx — lifted from account-settings.jsx so the tab strip matches:
// var(--blue) at rest, var(--green) on hover/selected, green indicator bar.
const tabsSx = {
  minHeight: 44,
  borderBottom: '1px solid var(--reflected-light)',
  '& .MuiTab-root': {
    minHeight: 44,
    textTransform: 'none',
    color: 'var(--blue)',
    fontSize: '0.92rem',
    fontWeight: 500,
    letterSpacing: '0.01em',
    gap: 0.75,
    transition: 'color 0.18s ease, text-shadow 0.18s ease',
    backgroundColor: 'transparent',
    '& .MuiTab-icon': { marginBottom: 0, fontSize: '1rem', color: 'inherit' },
    '&:hover': {
      color: 'var(--green)',
      textShadow: '0 1px 5px #007bff',
      backgroundColor: 'transparent'
    },
    '&.Mui-focusVisible': { backgroundColor: 'transparent' }
  },
  '& .MuiTab-root.Mui-selected': {
    color: 'var(--green)',
    backgroundColor: 'transparent'
  },
  '& .MuiTabs-indicator': {
    backgroundColor: 'var(--green)',
    height: 2
  }
};

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`admin-tabpanel-${index}`} aria-labelledby={`admin-tab-${index}`}>
      {value === index && children}
    </div>
  );
}

function a11yProps(index) {
  return { id: `admin-tab-${index}`, 'aria-controls': `admin-tabpanel-${index}` };
}

export default function AdminPanel() {
  // 0 = User Management, 1 = Device Management.
  const [tab, setTab] = useState(0);

  return (
    <MainCard content={false} sx={{ width: '100%', flex: 1, minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
      {/* ----- Page header banner ----- */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ width: '100%', borderBottom: '1px solid', borderBottomColor: 'var(--orange)', pb: 1.25 }}>
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            Admin Panel
          </Typography>
        </Box>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', opacity: 0.85, mt: 1.25 }}>
          Super-admin controls for managing users and devices across the PheNode fleet. Create and approve user accounts, register PheNodes
          and wireless sensors, and assign devices to users.
        </Typography>
      </Box>

      {/* ----- Tab strip ----- */}
      <Box sx={{ px: { xs: 2, sm: 3 } }}>
        <Tabs
          value={tab}
          onChange={(_e, next) => setTab(next)}
          aria-label="admin panel sections"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={tabsSx}
        >
          <Tab icon={<AntIcon icon={TeamOutlined} />} iconPosition="start" label="User Management" {...a11yProps(0)} />
          <Tab icon={<AntIcon icon={DesktopOutlined} />} iconPosition="start" label="Device Management" {...a11yProps(1)} />
        </Tabs>
      </Box>

      {/* ----- Tab content ----- */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <TabPanel value={tab} index={0}>
          <UserManagementTab />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <DeviceManagementTab />
        </TabPanel>
      </Box>
    </MainCard>
  );
}
