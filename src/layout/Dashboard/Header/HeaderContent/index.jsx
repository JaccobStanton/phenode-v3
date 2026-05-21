import { useState } from 'react';

// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';

// project imports
import Profile from './Profile';
import Notification from './Notification';
import MobileSection from './MobileSection';
import SupportModal from 'components/SupportModal';
import PrivacyModal from 'components/PrivacyModal';

// ==============================|| HEADER - CONTENT ||============================== //

export default function HeaderContent() {
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  // Modal state lives HERE (not in Profile or MobileSection) for two
  // reasons:
  //   1. HeaderContent is always mounted at every breakpoint, while the
  //      Profile component unmounts when the mobile MobileSection popper
  //      closes — keeping state here means the modal won't lose its open
  //      flag if the menu collapses behind it.
  //   2. MUI's Dialog renders via Portal to document.body, so the modal
  //      itself doesn't care where the JSX lives — only its React state
  //      does. Hoisting once here avoids two separate desktop/mobile copies.
  // `onOpenSupport` / `onOpenPrivacy` are threaded down through
  // Profile → SettingTab (and through MobileSection → Profile-embedded →
  // SettingTab on mobile). Same pattern, different target modal.
  const [supportOpen, setSupportOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const openSupport = () => setSupportOpen(true);
  const closeSupport = () => setSupportOpen(false);
  const openPrivacy = () => setPrivacyOpen(true);
  const closePrivacy = () => setPrivacyOpen(false);

  return (
    <>
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ mr: 1.5 }}>
        {/* <Notification /> */}
      </Box>
      {!downLG && <Profile onOpenSupport={openSupport} onOpenPrivacy={openPrivacy} />}
      {downLG && <MobileSection onOpenSupport={openSupport} onOpenPrivacy={openPrivacy} />}
      <SupportModal open={supportOpen} onClose={closeSupport} />
      <PrivacyModal open={privacyOpen} onClose={closePrivacy} />
    </>
  );
}
