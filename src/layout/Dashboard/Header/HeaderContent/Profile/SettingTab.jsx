import PropTypes from 'prop-types';

// material-ui
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

// assets
import AntIcon from 'components/AntIcon';
import LockOutlined from '@ant-design/icons-svg/lib/asn/LockOutlined';
import QuestionCircleOutlined from '@ant-design/icons-svg/lib/asn/QuestionCircleOutlined';
import UserOutlined from '@ant-design/icons-svg/lib/asn/UserOutlined';

// ==============================|| HEADER PROFILE - SETTING TAB ||============================== //
//
// Items here are template-stub navigation entries — none currently route
// anywhere. Wire onClicks as the corresponding pages are built. Earlier
// versions of this file shipped with two external template-default links
// (one on Support, one on a Feedback entry) — both were removed because
// the URLs weren't relevant to PheNode. Re-add them — pointing at
// PheNode's actual support / feedback destinations — when those exist.

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

export default function SettingTab({ onOpenSupport, onOpenPrivacy }) {
  return (
    <List component="nav" sx={{ p: 0.75 }}>
      <ListItemButton sx={themedListItemSx} onClick={onOpenSupport}>
        <ListItemIcon>
          <AntIcon icon={QuestionCircleOutlined} />
        </ListItemIcon>
        <ListItemText primary="Support" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <AntIcon icon={UserOutlined} />
        </ListItemIcon>
        <ListItemText primary="Account Settings" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx} onClick={onOpenPrivacy}>
        <ListItemIcon>
          <AntIcon icon={LockOutlined} />
        </ListItemIcon>
        <ListItemText primary="Privacy Center" />
      </ListItemButton>
    </List>
  );
}

SettingTab.propTypes = { onOpenSupport: PropTypes.func, onOpenPrivacy: PropTypes.func };
