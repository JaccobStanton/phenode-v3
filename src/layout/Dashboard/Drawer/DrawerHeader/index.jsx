import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

// project imports
import DrawerHeaderStyled from './DrawerHeaderStyled';
import { APP_DEFAULT_PATH } from 'config';
import logoFull from 'assets/logo/Logo.svg';
import logoIcon from 'assets/logo/logo_icon.svg';

const DRAWER_HEADER_HEIGHT = { xs: 56, sm: 64 };
const DRAWER_DIVIDER_NUDGE_PX = 1.4;

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
        borderBottom: '1.5px solid var(--box-outline-blue)'
      }}
    >
      <ButtonBase disableRipple component={Link} to={APP_DEFAULT_PATH} aria-label="Logo">
        <Box
          component="img"
          src={open ? logoFull : logoIcon}
          alt="PheNode logo"
          sx={{ width: open ? { xs: 176, sm: 196, md: 208 } : 35, height: 35, objectFit: 'contain' }}
        />
      </ButtonBase>
    </DrawerHeaderStyled>
  );
}

DrawerHeader.propTypes = { open: PropTypes.bool };
