import { useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'components/MainCard';
import { glassSurfaceSx, reflectedCardChromeSx } from 'themes/sx-tokens';

import DisplayTab from './tabs/display-tab';
import ApiAccessTab from './tabs/api-access-tab';
import DeviceSettingsTab from './tabs/device-settings-tab';

// assets
import AntIcon from 'components/AntIcon';
import LayoutOutlined from '@ant-design/icons-svg/lib/asn/LayoutOutlined';
import phenodeFleetIcon from 'assets/drawer-icons/PheNode_Fleet.svg';
import phenodeFleetActiveIcon from 'assets/drawer-icons/PheNode_Fleet_Active.svg';
import apiInactiveIcon from 'assets/settings/API_Inactive.svg';
import apiActiveIcon from 'assets/settings/API_Active.svg';

// =============================================================================
// AccountSettings — tabbed settings shell.
// =============================================================================
//
// One destination, three scopes:
//
//   - Display (user-scoped)   — timezone + display units. Persists to
//                                /user-preferences. See tabs/display-tab.jsx.
//   - API Access (user-scoped)— surface + copy the user's access token.
//                                See tabs/api-access-tab.jsx.
//   - Devices (device-scoped) — picker → rename + WiFi credentials per
//                                device. See tabs/device-settings-tab.jsx.
//
// Why tabs and not separate pages:
//   The header Profile dropdown already uses MUI Tabs (Profile / Settings),
//   so reusing the pattern reads native. One mental "settings" destination,
//   independent per-tab dirty state, no chunk-load flash between sections.
//
// Each tab manages its own data loading, mutation, and save UX — this
// shell just renders the header banner, the tab strip, and the active
// tab's content.

// Themed Tabs sx — matches the project's interactive-control language
// from the header Profile menu (var(--blue) at rest, var(--green) on
// hover/selected, green indicator bar). Inherits theme.typography
// fontFamily ('Inter') from the Tab's MuiButtonBase root — we don't
// override it here.
//
// The .tab-svg-* rules drive the PheNode_Fleet icon swap on the
// Devices tab: both inactive and active PNG/SVG variants are stacked
// in the same slot, and CSS opacity toggles them based on the tab's
// hover / Mui-selected state. Same pattern as the drawer NavItem
// icons (NavItem.jsx:65-75) — just expressed through CSS instead of
// React state because Tab doesn't expose hover.
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
    // Default state for the SVG-swap icon: show inactive, hide active.
    '& .tab-svg-active': { opacity: 0, transition: 'opacity 0.18s ease' },
    '& .tab-svg-inactive': { opacity: 1, transition: 'opacity 0.18s ease' },
    '&:hover': {
      color: 'var(--green)',
      textShadow: '0 1px 5px #007bff',
      backgroundColor: 'transparent',
      // Swap to the active SVG variant on hover.
      '& .tab-svg-active': { opacity: 1 },
      '& .tab-svg-inactive': { opacity: 0 }
    },
    '&.Mui-focusVisible': { backgroundColor: 'transparent' }
  },
  '& .MuiTab-root.Mui-selected': {
    color: 'var(--green)',
    backgroundColor: 'transparent',
    // Keep the active SVG visible while selected.
    '& .tab-svg-active': { opacity: 1 },
    '& .tab-svg-inactive': { opacity: 0 }
  },
  '& .MuiTabs-indicator': {
    backgroundColor: 'var(--green)',
    height: 2
  }
};

// Small helper — renders both the inactive and active SVG variants
// stacked in a fixed-size box so the parent Tab's CSS rules can toggle
// their visibility via opacity. We use opacity (rather than display)
// so the swap is smooth and the icon slot doesn't reflow.
function TabSvgIcon({ inactiveSrc, activeSrc, alt, size = 18 }) {
  const imgSx = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block'
  };
  return (
    <Box sx={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
      <Box component="img" src={inactiveSrc} alt={alt} className="tab-svg-inactive" sx={imgSx} />
      <Box component="img" src={activeSrc} alt="" aria-hidden="true" className="tab-svg-active" sx={imgSx} />
    </Box>
  );
}

function TabPanel({ children, value, index }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`account-settings-tabpanel-${index}`}
      aria-labelledby={`account-settings-tab-${index}`}
    >
      {value === index && children}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `account-settings-tab-${index}`,
    'aria-controls': `account-settings-tabpanel-${index}`
  };
}

export default function AccountSettings() {
  // 0 = Display, 1 = API Access, 2 = Devices. We default to Display
  // because that's the most-likely-to-be-edited tab for new users.
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
            Account Settings
          </Typography>
        </Box>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', opacity: 0.85, mt: 1.25 }}>
          Customize how timestamps and units are displayed across the app and embedded dashboards, view your API
          access token, and configure your PheNode devices.
        </Typography>
      </Box>

      {/* ----- Tab strip ----- */}
      <Box sx={{ px: { xs: 2, sm: 3 } }}>
        <Tabs
          value={tab}
          onChange={(_e, next) => setTab(next)}
          aria-label="account settings sections"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={tabsSx}
        >
          <Tab
            icon={<AntIcon icon={LayoutOutlined} />}
            iconPosition="start"
            label="Display"
            {...a11yProps(0)}
          />
          <Tab
            icon={<TabSvgIcon inactiveSrc={apiInactiveIcon} activeSrc={apiActiveIcon} alt="" size={22} />}
            iconPosition="start"
            label="API Access"
            {...a11yProps(1)}
          />
          <Tab
            icon={<TabSvgIcon inactiveSrc={phenodeFleetIcon} activeSrc={phenodeFleetActiveIcon} alt="" size={22} />}
            iconPosition="start"
            label="Devices"
            {...a11yProps(2)}
          />
        </Tabs>
      </Box>

      {/* ----- Tab content ----- */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <TabPanel value={tab} index={0}>
          <DisplayTab />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <ApiAccessTab />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <DeviceSettingsTab />
        </TabPanel>
      </Box>
    </MainCard>
  );
}
