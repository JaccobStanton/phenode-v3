import PropTypes from 'prop-types';

// material-ui
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';

// Original glow colors with UX-tuned middle stops (26% / 65%) for a more gradual
// blend, applied over the WHOLE div — NO background-size cutoff box. That full-div
// coverage is what kills the band: the band only ever came from the old 900px
// cutoff box slicing the gradient mid-fade; with the gradient covering the whole
// card there is no slice line — it just fades smoothly toward the corners. Its
// final stop is transparent over MAIN_CARD_BASE_COLOR (#00102f), so it ends in
// the base color.
// Trade-off vs the old fixed-height glow: the wash now scales with card size (its
// centre sits 15% down the card), so taller pages get a proportionally taller glow.
const MAIN_CARD_BASE_COLOR = '#00102f';
const MAIN_CARD_GRADIENT =
  'radial-gradient(circle at 50% 15%, #00438F 0%, #003679 15%, #001F53 55%, rgba(0, 16, 47, 0.72) 80%, rgba(0, 16, 47, 0) 100%)';

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
        // Single full-card wash; no cutoff box (see note above the constants).
        backgroundImage: MAIN_CARD_GRADIENT,
        backgroundRepeat: 'no-repeat',
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
