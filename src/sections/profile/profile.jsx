import { useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'components/MainCard';
import { glassSurfaceSx, reflectedCardChromeSx } from 'themes/sx-tokens';

import MyAccountTab from './tabs/my-account-tab';
import ChangePasswordTab from './tabs/change-password-tab';
import RoleTab from './tabs/role-tab';
import SettingsTab from './tabs/settings-tab';

// assets
import AntIcon from 'components/AntIcon';
import IdcardOutlined from '@ant-design/icons-svg/lib/asn/IdcardOutlined';
import LockOutlined from '@ant-design/icons-svg/lib/asn/LockOutlined';
import TeamOutlined from '@ant-design/icons-svg/lib/asn/TeamOutlined';
import BellOutlined from '@ant-design/icons-svg/lib/asn/BellOutlined';

// =============================================================================
// Profile — tabbed account-management shell.
// =============================================================================
//
// Four tabs, modeled after the Mantis admin template's Account Profile
// page, reskinned in PheNode chrome:
//
//   - My Account     — username + email, security toggles, recognized
//                      devices, active sessions.
//   - Change Password — old/new/confirm with live requirements check.
//   - Role           — invite team members, member list with status.
//   - Settings       — email notification preferences.
//
// Why tabs in this shell match Account Settings' shell:
//   Account Settings already established the tabbed pattern with a
//   matching banner + Tabs strip + tab panel layout. Reusing the
//   structure here keeps both pages reading as one visual family —
//   the user mentally models "tabbed settings page" once and uses
//   it the same way everywhere.
//
// Backend honesty:
//   At time of writing, very little of what this page renders is
//   actually persisted. The JWT carries email/role/is_approved/org_id
//   and that's the entire user-state surface — there are no endpoints
//   for password change, team invites, notification preferences, or
//   recognized-device tracking. The tabs all build the UI scaffolding
//   so when those endpoints land, only the per-tab submit handlers
//   need to flip from "show toast: not yet wired" to real calls.

// Themed Tabs sx — copied from Account Settings so both tabbed pages
// read identically. Inter font is inherited from the theme — we don't
// override fontFamily here.
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
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
    >
      {value === index && children}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `profile-tab-${index}`,
    'aria-controls': `profile-tabpanel-${index}`
  };
}

export default function Profile() {
  // Default to My Account — the most-likely-edited tab and a natural
  // landing point for "I clicked Profile from the drawer/header."
  const [tab, setTab] = useState(0);

  return (
    <MainCard
      content={false}
      sx={{ width: '100%', flex: 1, minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}
    >
      {/* ----- Page header banner ----- */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Box
          sx={{
            width: '100%',
            borderBottom: '1px solid',
            borderBottomColor: 'var(--orange)',
            pb: 1.25
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            Profile
          </Typography>
        </Box>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', opacity: 0.85, mt: 1.25 }}>
          Manage your account information, password, team roles, and notification preferences.
        </Typography>
      </Box>

      {/* ----- Tab strip ----- */}
      <Box sx={{ px: { xs: 2, sm: 3 } }}>
        <Tabs
          value={tab}
          onChange={(_e, next) => setTab(next)}
          aria-label="profile sections"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={tabsSx}
        >
          <Tab icon={<AntIcon icon={IdcardOutlined} />} iconPosition="start" label="My Account" {...a11yProps(0)} />
          <Tab icon={<AntIcon icon={LockOutlined} />} iconPosition="start" label="Change Password" {...a11yProps(1)} />
          {/* ─── Temporarily hidden — flip the guard to `true` to bring
              the Role and Settings tabs back. The corresponding
              TabPanels below are also guarded, so the indices stay
              consistent: even while hidden, Role lives at index 2
              and Settings at index 3 in code. ─── */}
          {false && (
            <Tab icon={<AntIcon icon={TeamOutlined} />} iconPosition="start" label="Role" {...a11yProps(2)} />
          )}
          {false && (
            <Tab icon={<AntIcon icon={BellOutlined} />} iconPosition="start" label="Settings" {...a11yProps(3)} />
          )}
        </Tabs>
      </Box>

      {/* ----- Tab content ----- */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <TabPanel value={tab} index={0}>
          <MyAccountTab />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <ChangePasswordTab />
        </TabPanel>
        {/* ─── Temporarily hidden — guarded panels for the hidden Role
            and Settings tabs above. Imports stay so flipping the
            guard re-enables both tabs without any other change. ─── */}
        {false && (
          <TabPanel value={tab} index={2}>
            <RoleTab />
          </TabPanel>
        )}
        {false && (
          <TabPanel value={tab} index={3}>
            <SettingsTab />
          </TabPanel>
        )}
      </Box>
    </MainCard>
  );
}
