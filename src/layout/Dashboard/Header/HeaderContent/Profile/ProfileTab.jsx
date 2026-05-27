import PropTypes from 'prop-types';

// material-ui
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

// assets
import AntIcon from 'components/AntIcon';
import LogoutOutlined from '@ant-design/icons-svg/lib/asn/LogoutOutlined';
import UserOutlined from '@ant-design/icons-svg/lib/asn/UserOutlined';

// ==============================|| HEADER PROFILE - PROFILE TAB ||============================== //
//
// Two items: Profile (navigates to /dashboard/profile) and Logout. Both
// are wired through callbacks passed from the parent Profile/index.jsx
// so the popper can close BEFORE the action fires — same pattern the
// SettingTab uses for Support / Privacy. Earlier versions of this file
// also rendered Edit Profile / Social Profile / Billing stub entries;
// they were removed once the dedicated Profile page landed, because
// the destination they would have linked to doesn't exist (and
// shouldn't be invented here).

// Project-themed list-item recipe — text + icon both var(--blue) at rest,
// transitioning to var(--green) with the standard neon hover treatment.
// Matches the controlBaseSx + sortToggleSx hover pattern used by the
// fleet-overview filter buttons.
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

export default function ProfileTab({ onLogout, onOpenProfile }) {
  return (
    <List component="nav" sx={{ p: 0.75 }}>
      <ListItemButton sx={themedListItemSx} onClick={onOpenProfile}>
        <ListItemIcon>
          <AntIcon icon={UserOutlined} />
        </ListItemIcon>
        <ListItemText primary="View Profile" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx} onClick={onLogout}>
        <ListItemIcon>
          <AntIcon icon={LogoutOutlined} />
        </ListItemIcon>
        <ListItemText primary="Logout" />
      </ListItemButton>
    </List>
  );
}

ProfileTab.propTypes = { onLogout: PropTypes.func, onOpenProfile: PropTypes.func };
