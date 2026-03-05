import PropTypes from 'prop-types';

// project imports
import DrawerHeaderStyled from './DrawerHeaderStyled';
import Logo from 'components/logo';

const DRAWER_HEADER_HEIGHT = { xs: 56, sm: 64 };
const DRAWER_DIVIDER_NUDGE_PX = 1;

// ==============================|| DRAWER HEADER ||============================== //

export default function DrawerHeader({ open }) {
  return (
    <DrawerHeaderStyled
      open={open}
      sx={{
        minHeight: {
          xs: DRAWER_HEADER_HEIGHT.xs + DRAWER_DIVIDER_NUDGE_PX,
          sm: DRAWER_HEADER_HEIGHT.sm + DRAWER_DIVIDER_NUDGE_PX
        },
        py: 0,
        width: 'initial',
        borderBottom: '1px solid rgba(255, 255, 255, 0.16)'
      }}
    >
      <Logo isIcon={!open} sx={{ width: open ? 'auto' : 35, height: 35 }} />
    </DrawerHeaderStyled>
  );
}

DrawerHeader.propTypes = { open: PropTypes.bool };
