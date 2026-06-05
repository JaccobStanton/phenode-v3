import PropTypes from 'prop-types';

// material-ui
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';

const MAIN_CARD_BASE_COLOR = '#00102f';
// Same glow as the original design — same colors, same brightness, same position —
// but defined as an ELLIPSE that fades fully to transparent BEFORE the cutoff,
// instead of the original `circle ... farthest-corner`. A farthest-corner circle
// clipped by a rectangle always has its corner past the box's bottom-centre, so
// the centre was always cut while still bright; that hard cut to the base color
// was the horizontal "seam"/band. The ellipse's vertical reach is tied to the
// cutoff HEIGHT (not the screen width), so its fade completes (~1090px) before the
// cutoff at every width and never bands. Size + position are fit to the original
// glow by an objective full-area pixel match: a fairly NARROW, COMPACT ellipse
// (horizontal radius ~55% of card width, vertical tied to the 1000px cutoff) so
// it reads as the original's concentrated top-centre glow with dark edges — not a
// wide wash across short, wide cards (e.g. the diagnostics top card).
const MAIN_CARD_GRADIENT =
  'radial-gradient(ellipse 55% 94% at 50% 14%, #00438f 0%, #003f88 20%, #003b82 33%, #003579 45%, #002b6b 60%, #001e52 74%, rgba(0, 16, 47, 0) 84%)';
const MAIN_CARD_GRADIENT_CUTOFF_HEIGHT = '1000px';

export default function MainCard({
  border = true,
  boxShadow,
  children,
  subheader,
  content = true,
  contentSX = {},
  darkTitle,
  divider = true,
  elevation,
  secondary,
  shadow,
  sx = {},
  title,
  codeHighlight = false,
  codeString,
  modal = false,
  ref,
  ...others
}) {
  return (
    <Card
      elevation={elevation || 0}
      sx={(theme) => ({
        ...(typeof sx === 'function' ? sx(theme) : sx || {}),
        position: 'relative',
        ...(border && { border: '1.5px solid var(--box-outline-blue)' }),
        backgroundColor: MAIN_CARD_BASE_COLOR,
        // Keep the top glow fixed while smoothly fading into the shared base color below the cutoff.
        backgroundImage: `${MAIN_CARD_GRADIENT}, linear-gradient(${MAIN_CARD_BASE_COLOR}, ${MAIN_CARD_BASE_COLOR})`,
        backgroundRepeat: 'no-repeat, no-repeat',
        backgroundPosition: 'top center, top left',
        backgroundSize: `100% ${MAIN_CARD_GRADIENT_CUTOFF_HEIGHT}, 100% 100%`,
        borderRadius: 1,
        boxShadow: boxShadow && !border ? shadow || theme.vars.customShadows.z1 : 'inherit',
        ...(boxShadow &&
          !border && {
            ':hover': { boxShadow: shadow || theme.vars.customShadows.z1 }
          }),
        ...(codeHighlight && {
          '& pre': { margin: 0, padding: '12px !important', fontFamily: theme.typography.fontFamily, fontSize: '0.75rem' }
        }),
        ...(modal && {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: `calc(100% - 50px)`, sm: 'auto' },
          maxWidth: 768
        })
      })}
      ref={ref}
      {...others}
    >
      {/* card header and action */}
      {!darkTitle && title && (
        <CardHeader
          sx={{ p: 2.5, backgroundColor: 'transparent' }}
          slotProps={{
            title: { variant: darkTitle ? 'h4' : 'subtitle1' },
            action: { sx: { m: '0px auto', alignSelf: 'center' } }
          }}
          title={title}
          action={secondary}
          subheader={subheader}
        />
      )}

      {/* content & header divider */}
      {title && divider && <Divider />}

      {/* card content */}
      {content && <CardContent sx={{ backgroundColor: 'transparent', ...contentSX }}>{children}</CardContent>}
      {!content && children}
    </Card>
  );
}

MainCard.propTypes = {
  border: PropTypes.bool,
  boxShadow: PropTypes.bool,
  children: PropTypes.node,
  subheader: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  content: PropTypes.bool,
  contentSX: PropTypes.object,
  darkTitle: PropTypes.bool,
  divider: PropTypes.bool,
  elevation: PropTypes.number,
  secondary: PropTypes.any,
  shadow: PropTypes.string,
  sx: PropTypes.object,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  codeHighlight: PropTypes.bool,
  codeString: PropTypes.string,
  modal: PropTypes.bool,
  ref: PropTypes.object,
  others: PropTypes.any
};
