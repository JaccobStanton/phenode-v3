import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';

// material-ui
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

// project imports
import Profile from './Profile';
import IconButton from 'components/@extended/IconButton';
import Transitions from 'components/@extended/Transitions';

// assets
import AntIcon from 'components/AntIcon';
import MoreOutlined from '@ant-design/icons-svg/lib/asn/MoreOutlined';

// Project-themed tooltip — matches the slotProps used by the desktop
// Profile/Logout tooltips (Profile/index.jsx:33-43) so the styling is
// consistent across mobile and desktop header triggers.
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

// ==============================|| HEADER CONTENT - MOBILE ||============================== //

export default function MobileSection({ onOpenSupport, onOpenPrivacy }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }

    setOpen(false);
  };

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current.focus();
    }

    prevOpen.current = open;
  }, [open]);

  return (
    <>
      <Box sx={{ flexShrink: 0, ml: 0.75 }}>
        <Tooltip title="Profile Menu" arrow={false} slotProps={projectTooltipSlotProps}>
          <IconButton
            sx={{
              border: '1px solid var(--reflected-light)',
              color: open ? 'var(--green)' : 'var(--blue)',
              backgroundColor: open ? 'rgba(72, 247, 245, 0.08)' : 'rgba(0, 20, 61, 0.72)',
              boxShadow: open ? '0 0 7px -5px var(--green)' : '0 11px 19px 1px #0000002e',
              '&:hover': {
                borderColor: 'var(--green)',
                boxShadow: '0 0 7px -5px var(--green)',
                color: 'var(--green)',
                textShadow: '0 1px 5px #007bff',
                backgroundColor: 'rgba(72, 247, 245, 0.08)'
              }
            }}
            aria-label="open profile menu"
            ref={anchorRef}
            aria-controls={open ? 'menu-list-grow' : undefined}
            aria-haspopup="true"
            onClick={handleToggle}
            color="secondary"
            variant="light"
          >
            <AntIcon icon={MoreOutlined} />
          </IconButton>
        </Tooltip>
      </Box>
      <Popper
        placement="bottom-end"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        sx={(theme) => ({ zIndex: theme.zIndex.modal + 1, minWidth: { xs: 280, sm: 290 }, maxWidth: 'calc(100vw - 24px)' })}
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
          <Transitions type="fade" in={open} {...TransitionProps}>
            <Paper
              sx={{
                // Mobile menu now uses the same self-contained, slightly darker
                // gradient as the desktop Profile menu (Profile/index.jsx
                // profileMenuPaperSx). Previously it inherited the shell's
                // viewport-fixed gradient (`backgroundAttachment: fixed`,
                // `backgroundSize: 100vw 100vh`), which made the menu look like
                // a window onto the app shell rather than a distinct surface.
                // Keeping the chrome aligned between mobile + desktop makes the
                // menu read consistently regardless of breakpoint.
                backgroundColor: '#002a63',
                backgroundImage: 'radial-gradient(circle at 50% 15%, #002a63, #001f53)',
                // 1.5px solid #054085 — see comment on profileMenuPaperSx in
                // Profile/index.jsx for the rationale. Opaque equivalent of
                // var(--box-outline-blue); matches Drawer/MainCard chrome.
                border: '1.5px solid #054085',
                boxShadow: '0 11px 19px 1px #0000002e',
                backdropFilter: 'blur(6px)',
                width: '100%',
                overflow: 'hidden'
              }}
            >
              <ClickAwayListener onClickAway={handleClose}>
                <Box sx={{ width: '100%' }}>
                  {/* Also close the mobile popper when Support or Privacy
                      Center is clicked so the modal isn't fighting the
                      menu visually. */}
                  <Profile
                    embedded
                    onOpenSupport={() => {
                      setOpen(false);
                      if (onOpenSupport) onOpenSupport();
                    }}
                    onOpenPrivacy={() => {
                      setOpen(false);
                      if (onOpenPrivacy) onOpenPrivacy();
                    }}
                  />
                </Box>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </>
  );
}

MobileSection.propTypes = { onOpenSupport: PropTypes.func, onOpenPrivacy: PropTypes.func };
