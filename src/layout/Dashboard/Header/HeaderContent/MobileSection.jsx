import { useEffect, useRef, useState } from 'react';

// material-ui
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Box from '@mui/material/Box';

// project imports
import Profile from './Profile';
import IconButton from 'components/@extended/IconButton';
import Transitions from 'components/@extended/Transitions';

// assets
import MoreOutlined from '@ant-design/icons/MoreOutlined';

const SHELL_SURFACE_GRADIENT = 'radial-gradient(circle at 50% 15%, #00438f, #00102f)';

// ==============================|| HEADER CONTENT - MOBILE ||============================== //

export default function MobileSection() {
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
          aria-label="open more menu"
          ref={anchorRef}
          aria-controls={open ? 'menu-list-grow' : undefined}
          aria-haspopup="true"
          onClick={handleToggle}
          color="secondary"
          variant="light"
        >
          <MoreOutlined />
        </IconButton>
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
                backgroundColor: '#00102f',
                backgroundImage: SHELL_SURFACE_GRADIENT,
                backgroundSize: '100vw 100vh',
                backgroundPosition: 'center top',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed',
                border: '1px solid var(--reflected-light)',
                boxShadow: '0 11px 19px 1px #0000002e',
                backdropFilter: 'blur(6px)',
                width: '100%',
                overflow: 'hidden'
              }}
            >
              <ClickAwayListener onClickAway={handleClose}>
                <Box sx={{ width: '100%' }}>
                  <Profile embedded />
                </Box>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </>
  );
}
