import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// project imports
import Avatar from 'components/@extended/Avatar';
import Transitions from 'components/@extended/Transitions';
import useAuth from 'hooks/useAuth';
import { formatRoleLabel } from 'utils/auth';
import { useGetMenuMaster } from 'api/menu';

// assets
import AntIcon from 'components/AntIcon';
import LogoutOutlined from '@ant-design/icons-svg/lib/asn/LogoutOutlined';
import UserOutlined from '@ant-design/icons-svg/lib/asn/UserOutlined';
import SettingOutlined from '@ant-design/icons-svg/lib/asn/SettingOutlined';
import UpOutlined from '@ant-design/icons-svg/lib/asn/UpOutlined';
import avatar1 from 'assets/images/users/marble_icon.svg';

// =============================================================================
// DrawerUserMenu — bottom-anchored user identity + action menu for the drawer.
// =============================================================================
//
// Why this lives at the bottom of the drawer:
//   The header already exposes a marble-avatar trigger for the same profile
//   actions, but Jake asked for a Mantis-style row at the bottom of the
//   side drawer too (see the reference screenshot). Both entry points
//   coexist — this component does NOT replace the header trigger.
//
// Visual contract:
//   - Drawer open  → full row: [avatar] [name + role] [chevron]
//   - Drawer mini  → avatar-only square trigger, centered in the rail
//   - Click anywhere on the trigger pops up a 3-item menu ABOVE the row
//     (placement: top-{start|end}) so it doesn't get hidden under the
//     viewport bottom.
//
// Menu items:
//   - Logout    → wired to useAuth().logout()
//   - Profile   → placeholder (no destination yet — TODO)
//   - My account → placeholder (no destination yet — TODO)
//
// Theme:
//   Chrome (Paper, border, shadow) mirrors the header Profile popper —
//   #002a63 with the radial gradient anchor and a solid 1.5px #054085
//   border, deliberately using the SOLID hex (not var(--box-outline-blue))
//   per the alpha-border project memory.
//   List item recipe mirrors ProfileTab.themedListItemSx (var(--blue) at
//   rest, var(--green) with a soft blue text-shadow on hover).

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

// Same gradient + border treatment as the header Profile popper.
const menuPaperSx = {
  backgroundColor: '#002a63',
  backgroundImage: 'radial-gradient(circle at 50% 15%, #002a63, #001f53)',
  border: '1.5px solid #054085',
  boxShadow: '0 11px 19px 1px #0000002e'
};

// Project list-item recipe (identical to header ProfileTab.jsx:28-49).
// Pulled inline rather than imported because ProfileTab.jsx isn't a
// public module and the existing duplication pattern (tooltip slot
// props, popper paper sx) already lives in three call sites.
const themedListItemSx = {
  borderRadius: 1,
  color: 'var(--blue)',
  transition: 'all 0.18s ease',
  '& .MuiListItemIcon-root': {
    minWidth: 32,
    color: 'var(--blue)',
    transition: 'color 0.18s ease'
  },
  '& .MuiListItemText-primary': {
    fontSize: '0.85rem',
    color: 'inherit'
  },
  '&:hover': {
    backgroundColor: 'rgba(72, 247, 245, 0.08)',
    color: 'var(--green)',
    textShadow: '0 1px 5px #007bff',
    '& .MuiListItemIcon-root': {
      color: 'var(--green)'
    }
  }
};

export default function DrawerUserMenu() {
  const { user, logout } = useAuth();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  // Identity strings derived from the JWT-backed auth user. We show the
  // email as the name line and the formatted role as the secondary line —
  // same approach as the header Profile menu, so the two stay consistent.
  // Falls back to readable placeholders if the auth context hasn't
  // populated yet (e.g., the moment between mount and first context value).
  const displayName = user?.email || 'Signed out';
  const displayRole = user ? formatRoleLabel(user.role) : '';

  const handleToggle = () => setOpen((prev) => !prev);
  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) return;
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  // Profile → /dashboard/profile (built; see src/sections/profile/profile.jsx).
  // Close the menu first so the popper isn't sitting open over the
  // destination page after the route change completes.
  const handleProfile = () => {
    setOpen(false);
    navigate('/dashboard/profile');
  };
  // Account Settings → /dashboard/account-settings (built; see
  // src/sections/account-settings/account-settings.jsx). Same
  // close-then-navigate pattern as handleProfile / handleLogout so the
  // popper doesn't sit open over the destination page.
  const handleAccountSettings = () => {
    setOpen(false);
    navigate('/dashboard/account-settings');
  };

  // Shared dropdown content — three list items styled with the same
  // hover treatment as the header Profile menu's list.
  const menuList = (
    <List component="nav" sx={{ p: 0.75, minWidth: 200 }}>
      <ListItemButton sx={themedListItemSx} onClick={handleAccountSettings}>
        <ListItemIcon>
          <AntIcon icon={SettingOutlined} />
        </ListItemIcon>
        <ListItemText primary="Account Settings" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx} onClick={handleProfile}>
        <ListItemIcon>
          <AntIcon icon={UserOutlined} />
        </ListItemIcon>
        <ListItemText primary="Profile" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx} onClick={handleLogout}>
        <ListItemIcon>
          <AntIcon icon={LogoutOutlined} />
        </ListItemIcon>
        <ListItemText primary="Logout" />
      </ListItemButton>
    </List>
  );

  // ---------------------------------------------------------------------------
  // Trigger surface.
  //
  // Two shapes depending on drawer state:
  //   - Expanded: full row, avatar + (name/role stack) + chevron, wrapped
  //     in a ButtonBase so the entire row is one clickable target.
  //   - Mini: avatar-only square trigger, centered in the rail. A
  //     project-themed "Profile Menu" tooltip (matching the header
  //     marble-icon trigger) gives it discoverability since the
  //     name/role text is hidden in mini mode.
  // ---------------------------------------------------------------------------

  // Shared sx so hover/open glow stays in sync across both shapes.
  const triggerBaseSx = {
    width: '100%',
    color: 'var(--blue)',
    border: '1px solid transparent',
    borderRadius: 1,
    transition: 'all 0.18s ease',
    '&:hover': {
      backgroundColor: 'rgba(72, 247, 245, 0.08)',
      borderColor: 'var(--green)',
      color: 'var(--green)',
      '& .drawer-user-menu-name': {
        color: 'var(--green)',
        textShadow: '0 1px 5px #007bff'
      },
      '& .drawer-user-menu-chevron': {
        color: 'var(--green)'
      }
    },
    ...(open && {
      backgroundColor: 'rgba(72, 247, 245, 0.12)',
      borderColor: 'var(--green)',
      color: 'var(--green)',
      '& .drawer-user-menu-name': {
        color: 'var(--green)',
        textShadow: '0 1px 7px rgba(72, 247, 245, 0.55)'
      },
      '& .drawer-user-menu-chevron': {
        color: 'var(--green)'
      }
    })
  };

  const expandedTrigger = (
    <ButtonBase
      ref={anchorRef}
      onClick={handleToggle}
      aria-haspopup="true"
      aria-expanded={open}
      aria-label="Open user menu"
      sx={{
        ...triggerBaseSx,
        // Roomy row matching the example mockup's bottom-of-drawer cluster.
        px: 1.25,
        py: 1,
        justifyContent: 'flex-start'
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ width: '100%', gap: 1.25, minWidth: 0 }}>
        <Avatar
          alt="profile user"
          src={avatar1}
          size="sm"
          // Forwards loading="lazy" to the inner <img>. Defers the offscreen
          // fetch in the popper instance; the drawer-bottom trigger renders
          // eagerly anyway because it's in the initial viewport.
          imgProps={{ loading: 'lazy' }}
          sx={{
            bgcolor: 'transparent',
            color: 'inherit',
            flexShrink: 0,
            '& img': { display: 'block' }
          }}
        />
        {/* `minWidth: 0` + Typography `noWrap` lets the email ellipsis-
            truncate inside the 260px drawer instead of overflowing.
            `gap: 0.25` (2px) gives a subtle breathing room between the
            username and the role line so they don't read as one stacked
            block, without pushing the cluster too tall. */}
        <Stack sx={{ minWidth: 0, flex: 1, textAlign: 'left', gap: 0.25 }}>
          <Typography
            className="drawer-user-menu-name"
            noWrap
            title={displayName}
            sx={{
              color: 'var(--green)',
              fontWeight: 600,
              fontSize: '0.9rem',
              lineHeight: 1.2,
              transition: 'color 0.18s ease, text-shadow 0.18s ease'
            }}
          >
            {displayName}
          </Typography>
          {displayRole && (
            <Typography
              noWrap
              sx={{
                color: 'var(--blue)',
                fontSize: '0.72rem',
                lineHeight: 1.2,
                opacity: 0.85
              }}
            >
              {displayRole}
            </Typography>
          )}
        </Stack>
        {/* Chevron rotates 180° when the menu is open so the affordance
            mirrors the menu's visual state (closed: ^ points up,
            suggesting the menu will appear above; open: ∨ points down,
            suggesting click-to-close). */}
        <Box
          className="drawer-user-menu-chevron"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--blue)',
            transition: 'transform 0.18s ease, color 0.18s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
            fontSize: '0.85rem'
          }}
        >
          <AntIcon icon={UpOutlined} />
        </Box>
      </Stack>
    </ButtonBase>
  );

  const miniTrigger = (
    <Tooltip title="Profile Menu" placement="right" arrow={false} slotProps={projectTooltipSlotProps}>
      <ButtonBase
        ref={anchorRef}
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Open user menu"
        sx={{
          ...triggerBaseSx,
          // Override the shared `width: 100%` from triggerBaseSx so the
          // mini trigger is a tight 40px square; the parent wrapper's
          // `justifyContent: center` handles horizontal centering.
          width: 40,
          height: 40,
          justifyContent: 'center'
        }}
      >
        <Avatar
          alt="profile user"
          src={avatar1}
          size="sm"
          imgProps={{ loading: 'lazy' }}
          sx={{
            bgcolor: 'transparent',
            color: 'inherit',
            '& img': { display: 'block' }
          }}
        />
      </ButtonBase>
    </Tooltip>
  );

  return (
    // The wrapping Box paints the divider line above the user cluster
    // (same border treatment as the DrawerHeader's bottom edge) and gives
    // the cluster a bit of vertical breathing room so it doesn't crowd
    // the last nav item.
    //
    // `flexShrink: 0` keeps the cluster anchored at the bottom — when the
    // nav list above grows tall enough to need scrolling, the SimpleBar
    // takes the overflow and this cluster doesn't get squeezed.
    //
    // Centering: in mini-drawer mode the rail is only ~60px wide and the
    // trigger is a 40px square. We need to center it horizontally — but
    // ButtonBase's default `display: inline-flex` means `mx: 'auto'` on
    // the button does nothing, so we make THIS wrapper a flex row with
    // `justifyContent: center` instead. The expanded trigger has
    // `width: 100%` and fills the row regardless, so this is safe in
    // both states.
    <Box
      sx={{
        flexShrink: 0,
        px: drawerOpen ? 1.25 : 0.5,
        py: 1,
        borderTop: '1.5px solid #054085',
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      {drawerOpen ? expandedTrigger : miniTrigger}

      <Popper
        placement={drawerOpen ? 'top-start' : 'right-end'}
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
                // 9px gap between popper and anchor along the placement
                // axis (vertical for top-start, horizontal for right-end).
                // Matches the offset used by the header Profile popper.
                offset: [0, 9]
              }
            }
          ]
        }}
      >
        {({ TransitionProps }) => (
          <Transitions type="grow" position="bottom-left" in={open} {...TransitionProps}>
            <Paper sx={{ ...menuPaperSx, minWidth: 200 }}>
              <ClickAwayListener onClickAway={handleClose}>
                {/* Plain Box (not MainCard) for the same reason as the
                    header Profile popper — MainCard would paint its own
                    gradient and mask the menu chrome. */}
                <Box>{menuList}</Box>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </Box>
  );
}
