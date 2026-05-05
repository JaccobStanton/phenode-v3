// material-ui
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

// assets
import LockOutlined from '@ant-design/icons/LockOutlined';
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import UnorderedListOutlined from '@ant-design/icons/UnorderedListOutlined';

// ==============================|| HEADER PROFILE - SETTING TAB ||============================== //
//
// Items here are template-stub navigation entries — none currently route
// anywhere. Wire onClicks as the corresponding pages are built.
//
// The previous version of this file had two external links pointing at
// `https://codedthemes.support-hub.io/` (Mantis template defaults). They
// were removed because the URLs aren't relevant to PheNode and the
// styling didn't match the rest of the menu. Re-add them — pointing at
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

export default function SettingTab() {
  return (
    <List component="nav" sx={{ p: 0.75 }}>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <QuestionCircleOutlined />
        </ListItemIcon>
        <ListItemText primary="Support" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <UserOutlined />
        </ListItemIcon>
        <ListItemText primary="Account Settings" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <LockOutlined />
        </ListItemIcon>
        <ListItemText primary="Privacy Center" />
      </ListItemButton>
      <ListItemButton sx={themedListItemSx}>
        <ListItemIcon>
          <UnorderedListOutlined />
        </ListItemIcon>
        <ListItemText primary="History" />
      </ListItemButton>
    </List>
  );
}
