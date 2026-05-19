import PropTypes from 'prop-types';

// material-ui
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

// assets
import AntIcon from 'components/AntIcon';
import EditOutlined from '@ant-design/icons-svg/lib/asn/EditOutlined';
import LogoutOutlined from '@ant-design/icons-svg/lib/asn/LogoutOutlined';
import ProfileOutlined from '@ant-design/icons-svg/lib/asn/ProfileOutlined';
import UserOutlined from '@ant-design/icons-svg/lib/asn/UserOutlined';
import WalletOutlined from '@ant-design/icons-svg/lib/asn/WalletOutlined';

// ==============================|| HEADER PROFILE - PROFILE TAB ||============================== //
//
// All items here are template-stub navigation entries except Logout
// (which is wired through the onLogout prop passed from the parent
// Profile/index.jsx). Wire individual onClicks as the corresponding
// pages get built.

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

export default function ProfileTab({ onLogout }) {
  return (
    <List component="nav" sx={{ p: 0.75 }}>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <AntIcon icon={EditOutlined} />
        </ListItemIcon>
        <ListItemText primary="Edit Profile" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <AntIcon icon={UserOutlined} />
        </ListItemIcon>
        <ListItemText primary="View Profile" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <AntIcon icon={ProfileOutlined} />
        </ListItemIcon>
        <ListItemText primary="Social Profile" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <AntIcon icon={WalletOutlined} />
        </ListItemIcon>
        <ListItemText primary="Billing" />
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

ProfileTab.propTypes = { onLogout: PropTypes.func };
