import PropTypes from 'prop-types';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import CardContent from '@mui/material/CardContent';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import ProfileTab from './ProfileTab';
import SettingTab from './SettingTab';
import Avatar from 'components/@extended/Avatar';
import Transitions from 'components/@extended/Transitions';
import IconButton from 'components/@extended/IconButton';
import useAuth from 'hooks/useAuth';
import { formatRoleLabel } from 'utils/auth';

// assets
import AntIcon from 'components/AntIcon';
import LogoutOutlined from '@ant-design/icons-svg/lib/asn/LogoutOutlined';
import SettingOutlined from '@ant-design/icons-svg/lib/asn/SettingOutlined';
import UserOutlined from '@ant-design/icons-svg/lib/asn/UserOutlined';
import avatar1 from 'assets/images/users/marble_icon.svg';

const projectTooltipSlotProps = {
  tooltip: {
    sx: {
      backgroundColor: 'rgba(0, 20, 61, 0.96)',
      color: 'var(--green)',
      border: '1px solid var(--reflected-light)',
      boxShadow: '0 11px 19px 1px #0000002e',
      fontSize: '0.78rem'
    }
  }
};

// Menu surface — one tonal step darker than the previous #003274/#002a63
// pairing so the dropdown reads as a distinct surface against the brighter
// app shell gradient (#00438f → #00102f) instead of blending into it.
// Same radial anchor (50%/15%) as the drawer keeps the chrome in the same
// visual family; the two stops stay close together so it still reads as a
// soft tonal shift rather than a visible spotlight.
const profileMenuPaperSx = {
  backgroundColor: '#002a63',
  backgroundImage: 'radial-gradient(circle at 50% 15%, #002a63, #001f53)',
  // 1.5px solid #054085 — the opaque equivalent of var(--box-outline-blue)
  // (#054085 at 69% alpha), which is the standard app-chrome border used on
  // the Drawer (right edge) and MainCard. Using the SOLID hex (not the alpha
  // CSS var) avoids the bg-dependent rendering issue documented in the
  // alpha-border project memory — see project_phenode_alpha_border_gotcha.md.
  // The 1.5px width also matches the Drawer/MainCard border weight.
  border: '1.5px solid #054085',
  boxShadow: '0 11px 19px 1px #0000002e'
};

// Themed Tabs treatment for the avatar dropdown — labels and icons sit
// in var(--blue) at rest and transition to var(--green) on hover/select,
// matching the project's standard interactive-control pattern.
//
// `backgroundColor: transparent` on hover/focus is intentional: MUI's
// MuiTab default adds a faint white/grey hover background that washes
// the menu surface — explicitly killing it keeps the hover effect to
// just the color/glow change.
const profileTabsSx = {
  minHeight: 40,
  '& .MuiTab-root': {
    minHeight: 40,
    color: 'var(--blue)',
    transition: 'color 0.18s ease',
    backgroundColor: 'transparent',
    // Tab icon inherits color from the Tab via currentColor on the SVG.
    '& .MuiSvgIcon-root, & svg': { color: 'inherit' },
    '&:hover': {
      color: 'var(--green)',
      backgroundColor: 'transparent'
    },
    '&.Mui-focusVisible': {
      backgroundColor: 'transparent'
    }
  },
  '& .MuiTab-root.Mui-selected': {
    color: 'var(--green)',
    backgroundColor: 'transparent'
  },
  '& .MuiTabs-indicator': {
    backgroundColor: 'var(--green)'
  }
};

// Logout icon-button — matches the fleet-overview filter buttons
// (controlBaseSx + sortToggleSx in FleetOverviewView.jsx:37-79):
// reflected-light border, var(--blue) icon, glass surface, project shadow,
// transitioning to var(--green) on hover.
const logoutIconButtonSx = {
  width: 40,
  height: 40,
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  color: 'var(--blue)',
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  boxShadow: '0 11px 19px 1px #0000002e',
  transition: 'color 0.18s ease, border-color 0.18s ease',
  '&:hover': {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    backgroundColor: 'rgba(0, 17, 48, 0.03)',
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
  },
  '&:focus-visible': {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    outline: 'none'
  }
};

// tab panel wrapper
function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`profile-tabpanel-${index}`} aria-labelledby={`profile-tab-${index}`} {...other}>
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

// ==============================|| HEADER CONTENT - PROFILE ||============================== //

export default function Profile({ embedded = false, onOpenSupport, onOpenPrivacy }) {
  const theme = useTheme();

  // Pull user info from AuthContext. The JWT carries:
  //   sub          → email          (per phenodeX/docs/frontend-backend-api.md:33-39
  //                                   and phenode_backend/api/auth/routes.py:36-53)
  //   role         → USER | ADMIN | SUPER_ADMIN
  //   is_approved  → boolean
  // No /api/user/me endpoint exists yet, so full_name is not available
  // from the token or any user-scoped read. We display the email as the
  // primary identifier and the formatted role as the secondary line.
  //
  // Reading from the context (instead of decoding the JWT here) means this
  // component re-renders on login/logout without us having to wire it up.
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.email || 'Signed out';
  const displayRole = user ? formatRoleLabel(user.role) : '';
  // Gate the Admin Panel entry to SUPER_ADMIN. The /dashboard/admin route is
  // independently guarded by RequireSuperAdmin — this just hides the menu
  // item from anyone who can't use it.
  const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  // Profile → /dashboard/profile. Closes the popper first so it isn't
  // sitting open over the destination page after the route change —
  // same close-then-act pattern used by handleLogout above and by
  // SettingTab's onOpenSupport / onOpenPrivacy wrappers below.
  const handleOpenProfile = () => {
    setOpen(false);
    navigate('/dashboard/profile');
  };

  // Account Settings → /dashboard/account-settings. Same close-then-act
  // pattern. This is the destination wired into the SettingTab row AND
  // into DrawerUserMenu's handleAccountSettings — both entry points
  // land on the same page.
  // Admin Panel → /dashboard/admin. Same close-then-act pattern. Only
  // reachable for SUPER_ADMIN (the entry is hidden otherwise and the route
  // is guarded), but the handler is harmless for anyone else.
  const handleOpenAdmin = () => {
    setOpen(false);
    navigate('/dashboard/admin');
  };

  const handleOpenAccountSettings = () => {
    setOpen(false);
    navigate('/dashboard/account-settings');
  };

  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  // Shared menu content (header row, tabs, panels). Rendered both inside the
  // standalone Profile Popper (desktop) and embedded inside the MobileSection
  // Popper (mobile / down-LG). When `embedded` is true we skip the trigger
  // button, Tooltip, ClickAwayListener, and Popper — the parent
  // MobileSection already supplies those.
  const menuContent = (
    <>
      <CardContent sx={{ px: 2.5, pt: 3 }}>
        {/* Single flex row — user info shrinks (with email ellipsis) and the
            logout button stays pinned to the right regardless of email length. */}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Avatar
            alt="profile user"
            src={avatar1}
            // `loading="lazy"` is forwarded to the inner <img>. Above-the-
            // fold renders eagerly anyway; offscreen instances (drawer
            // menus, popovers) defer their fetch. Lighthouse flagged the
            // marble icon at 180 KiB on /dashboard/download-preferences.
            imgProps={{ loading: 'lazy' }}
            sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: 'transparent', color: 'inherit' }}
          />
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h6"
              noWrap
              title={displayName}
              sx={{
                color: 'var(--green)',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {displayName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--blue)', fontSize: '0.78rem' }}>
              {displayRole}
            </Typography>
          </Stack>
          <Tooltip title="Logout" arrow={false} slotProps={projectTooltipSlotProps}>
            <IconButton onClick={handleLogout} aria-label="Log out" sx={{ flexShrink: 0, ...logoutIconButtonSx }}>
              <AntIcon icon={LogoutOutlined} />
            </IconButton>
          </Tooltip>
        </Stack>
      </CardContent>

      <Box sx={{ borderBottom: '1px solid var(--reflected-light)' }}>
        <Tabs variant="fullWidth" value={value} onChange={handleChange} aria-label="profile tabs" sx={profileTabsSx}>
          <Tab
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              textTransform: 'capitalize',
              gap: 1.25,
              '& .MuiTab-icon': {
                marginBottom: 0
              }
            }}
            icon={<AntIcon icon={UserOutlined} />}
            label="Profile"
            {...a11yProps(0)}
          />
          <Tab
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              textTransform: 'capitalize',
              gap: 1.25,
              '& .MuiTab-icon': {
                marginBottom: 0
              }
            }}
            icon={<AntIcon icon={SettingOutlined} />}
            label="Settings"
            {...a11yProps(1)}
          />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0} dir={theme.direction}>
        <ProfileTab onLogout={handleLogout} onOpenProfile={handleOpenProfile} onOpenAdmin={handleOpenAdmin} isSuperAdmin={isSuperAdmin} />
      </TabPanel>
      <TabPanel value={value} index={1} dir={theme.direction}>
        {/* Both modal callbacks flow from HeaderContent. We also close the
            Profile popper alongside opening either modal so the modal
            isn't visually competing with the menu underneath. */}
        <SettingTab
          onOpenSupport={() => {
            setOpen(false);
            if (onOpenSupport) onOpenSupport();
          }}
          onOpenPrivacy={() => {
            setOpen(false);
            if (onOpenPrivacy) onOpenPrivacy();
          }}
          onOpenAccountSettings={handleOpenAccountSettings}
        />
      </TabPanel>
    </>
  );

  // Embedded mode: render only the menu content. The parent (MobileSection)
  // owns the Popper, ClickAwayListener, and Paper surface — duplicating any
  // of those here would either nest two poppers or fight the parent for the
  // click-away target.
  if (embedded) {
    return <Box sx={{ width: '100%' }}>{menuContent}</Box>;
  }

  return (
    <Box sx={{ flexShrink: 0, ml: 'auto' }}>
      <Tooltip title="Profile Menu" arrow={false} slotProps={projectTooltipSlotProps}>
        <IconButton
          color="secondary"
          variant="light"
          sx={{
            // Avatar trigger uses the same chrome recipe as the fleet-overview
            // filter buttons (FleetOverviewView.jsx:37-79) for hover/active —
            // green border + soft glass tint on hover; full Mui-selected look
            // when the popper is open. Rest state keeps a transparent
            // placeholder border so layout doesn't shift between states.
            p: 0.25,
            color: 'inherit',
            border: '1px solid transparent',
            borderRadius: 1,
            backgroundColor: 'transparent',
            boxShadow: 'none',
            transition: 'all 0.18s ease',
            '&:hover': {
              borderColor: 'var(--green)',
              backgroundColor: 'rgba(0, 17, 48, 0.03)',
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
              boxShadow: 'none'
            },
            ...(open && {
              borderColor: 'var(--green)',
              backgroundColor: 'rgba(72, 247, 245, 0.12)',
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
              boxShadow: '0 11px 19px 1px #0000002e'
            })
          }}
          aria-label="open profile"
          ref={anchorRef}
          aria-controls={open ? 'profile-grow' : undefined}
          aria-haspopup="true"
          onClick={handleToggle}
        >
          <Avatar
            alt="profile user"
            src={avatar1}
            size="sm"
            imgProps={{ loading: 'lazy' }}
            sx={{
              bgcolor: 'transparent',
              color: 'inherit',
              '& img': { display: 'block' },
              '&:hover': { outline: 'none' }
            }}
          />
        </IconButton>
      </Tooltip>
      <Popper
        placement="bottom-end"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        sx={(theme) => ({ zIndex: theme.zIndex.modal + 1 })}
        popperOptions={{
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 9]
              }
            }
          ]
        }}
      >
        {({ TransitionProps }) => (
          <Transitions type="grow" position="top-right" in={open} {...TransitionProps}>
            <Paper sx={{ ...profileMenuPaperSx, width: 290, minWidth: 240, maxWidth: { xs: 250, md: 290 } }}>
              <ClickAwayListener onClickAway={handleClose}>
                {/* Wrapping Box gives ClickAwayListener its single-child
                    target. We deliberately don't use MainCard here —
                    MainCard.jsx:37-46 paints its own multi-stop gradient
                    that overrides whatever sx the consumer passes,
                    which would mask the drawer gradient on the Paper. */}
                <Box>{menuContent}</Box>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </Box>
  );
}

TabPanel.propTypes = { children: PropTypes.node, value: PropTypes.number, index: PropTypes.number, other: PropTypes.any };

Profile.propTypes = {
  embedded: PropTypes.bool,
  onOpenSupport: PropTypes.func,
  onOpenPrivacy: PropTypes.func
};
