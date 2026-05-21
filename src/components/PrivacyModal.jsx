// =============================================================================
// PrivacyModal — themed scrollable dialog presenting Agrela's privacy
// statement to authenticated users.
// =============================================================================
//
// Pattern:
//
//   <PrivacyModal
//     open={privacyOpen}
//     onClose={() => setPrivacyOpen(false)}
//   />
//
// Content is static (copy provided by the team — last updated April
// 2023). The dialog is wider than SupportModal because the policy
// runs long, and the DialogContent is `dividers`-styled so the
// scrollable region is visually bounded between the title and the
// close button. Section headers use var(--green), body text uses
// var(--blue), and mailto / external links use var(--green) with a
// soft hover glow so they read as the same interactive family as
// the rest of the app's text affordances.
//
// Theme: mirrors SupportModal / ConfirmRenameModal — same
// rgba(0, 20, 61, 0.96) surface, blurred backdrop, solid #054085
// border. Scrollbar styling mirrors the date-picker calendars
// (sensor-measurements.jsx:289-296) so the scroll affordance feels
// native to the surface.

import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

const PRIVACY_CONTACT_EMAIL = 'info@phenode.com';
const TERMS_URL = 'https://www.agrelaeco.com/terms-of-service';

const dialogPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.96)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1.5px solid #054085',
  boxShadow: '0 11px 19px 1px #0000002e',
  borderRadius: 1,
  color: 'var(--blue)',
  // Wider than SupportModal because the policy is multi-paragraph and a
  // narrow column makes the reading line measure uncomfortable. Capped
  // below 100vh so the dialog never blows past the viewport on small
  // displays; the inner DialogContent scrolls instead.
  width: '100%',
  minWidth: { xs: 320, sm: 520 },
  maxWidth: 720,
  maxHeight: '85vh'
};

const dialogBackdropSx = {
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(6px)'
};

// Scrollable content region. The `dividers` prop on DialogContent paints
// 1px borders top/bottom — we override the colors to var(--reflected-light)
// so the dividers blend with the rest of the menu chrome instead of
// MUI's default mid-grey.
const dialogContentSx = {
  borderColor: 'var(--reflected-light)',
  // Custom scrollbar — matches the date-picker calendar scroll affordance
  // in sensor-measurements.jsx so it reads as the same chrome family.
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
  '&::-webkit-scrollbar': { width: '6px' },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(0, 68, 143, 0.6)',
    borderRadius: 3
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: 'rgba(72, 247, 245, 0.4)'
  }
};

const sectionHeadingSx = {
  color: 'var(--green)',
  fontWeight: 600,
  fontSize: '0.95rem',
  mt: 2.5,
  mb: 1
};

const bodyTextSx = {
  color: 'var(--blue)',
  fontSize: '0.85rem',
  lineHeight: 1.65,
  mb: 1.5
};

const lastUpdatedSx = {
  ...bodyTextSx,
  fontStyle: 'italic',
  opacity: 0.7,
  mb: 2
};

const linkSx = {
  color: 'var(--green)',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(72, 247, 245, 0.4)',
  textUnderlineOffset: '2px',
  transition: 'color 0.18s ease, text-shadow 0.18s ease',
  '&:hover': {
    color: 'var(--green)',
    textShadow: '0 1px 5px #007bff',
    textDecorationColor: 'var(--green)'
  }
};

const buttonBaseSx = {
  textTransform: 'none',
  border: '1px solid var(--reflected-light)',
  borderRadius: 1,
  color: 'var(--blue)',
  backgroundColor: 'rgba(0, 17, 48, 0.03)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  boxShadow: '0 11px 19px 1px #0000002e',
  px: 2.5,
  py: 0.75,
  fontWeight: 500,
  letterSpacing: '0.04em',
  fontSize: '0.78rem',
  transition: 'color 0.18s ease, border-color 0.18s ease',
  '&.Mui-disabled': {
    color: 'var(--med-grey)',
    borderColor: 'var(--med-grey)',
    backgroundColor: '#01113d'
  },
  '&.Mui-disabled:hover': {
    backgroundColor: '#01113d'
  }
};

const closeButtonSx = {
  ...buttonBaseSx,
  '&:hover:not(.Mui-disabled)': {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.08)'
  }
};

export default function PrivacyModal({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="privacy-modal-title"
      scroll="paper"
      slotProps={{
        paper: { sx: dialogPaperSx },
        backdrop: { sx: dialogBackdropSx }
      }}
    >
      <DialogTitle
        id="privacy-modal-title"
        sx={{
          color: 'var(--green)',
          fontSize: '1.1rem',
          fontWeight: 600,
          pb: 1
        }}
      >
        Privacy Policy
      </DialogTitle>
      <DialogContent dividers sx={dialogContentSx}>
        <Typography sx={lastUpdatedSx}>Last updated April, 2023</Typography>

        <Typography sx={bodyTextSx}>
          Agrela Ecosystems, Inc. (&ldquo;Agrela&rdquo;) has created this
          privacy statement in order to demonstrate our firm commitment to
          privacy. Due to the potentially sensitive nature of the information
          we collect from our users, we believe it is important to satisfy
          strict privacy requirements. The following discloses our information
          gathering and dissemination practices for this Web site:
        </Typography>

        <Typography sx={sectionHeadingSx}>Collected Information</Typography>
        <Typography sx={bodyTextSx}>
          The following section describes the information we collect from you
          and indicates the primary purposes why we collect each type of
          information from you. As described below in more detail, we use your
          IP address to help diagnose problems with our server, and to
          administer our Web site. Your IP address is or may be used to help
          identify you, to track activity within our site and to gather broad
          demographic information. Our Web server will collect IP information.
          Our site uses cookies to keep track of your session ID. We may use
          cookies to deliver content specific to your interests.
        </Typography>

        <Typography sx={bodyTextSx}>
          Agrela may also use the information we collect from you to:
        </Typography>
        {/* Themed bulleted list — `component="ul"` on Box so the bullets
            render natively, with each item as a Typography <li> so it
            inherits the body color/size styling. */}
        <Box component="ul" sx={{ pl: 3, mt: 0, mb: 1.5, '& li': { mb: 0.75 } }}>
          <Typography component="li" sx={{ ...bodyTextSx, mb: 0 }}>
            optimize our Web site so that it is more beneficial to users like
            yourself and to us;
          </Typography>
          <Typography component="li" sx={{ ...bodyTextSx, mb: 0 }}>
            perform services on behalf of the business, including maintaining
            or servicing accounts, providing customer service, processing or
            fulfilling orders and transactions, verifying customer information,
            processing payments, providing financing, providing analytic
            services, providing storage, or providing similar services on
            behalf of the business or service provider; and/or
          </Typography>
          <Typography component="li" sx={{ ...bodyTextSx, mb: 0 }}>
            comply with our legal and regulatory obligations.
          </Typography>
        </Box>

        <Typography sx={bodyTextSx}>
          This site may contain links to other sites. Agrela is not responsible
          for the privacy practices or the content of such websites.
        </Typography>

        <Typography sx={sectionHeadingSx}>Security</Typography>
        <Typography sx={bodyTextSx}>
          This Web site has security measures in place to protect the loss,
          misuse and alteration of the information under our control. All user
          data is stored on our servers.
        </Typography>
        <Typography sx={bodyTextSx}>
          The user may request, via email or telephone, additional information
          about Agrela&apos;s security practices. The requested security
          information will be made available to the user via email, fax or
          postal mail, in our discretion.
        </Typography>

        <Typography sx={sectionHeadingSx}>Amendments</Typography>
        <Typography sx={bodyTextSx}>
          From time-to-time, we may amend our information practices as
          described in this privacy statement.
        </Typography>

        <Typography sx={sectionHeadingSx}>Contacting the Web Site</Typography>
        <Typography sx={bodyTextSx}>
          If you have any questions about this privacy statement, the practices
          of this site, or your dealings with this Web site, you can contact:{' '}
          <Link href={`mailto:${PRIVACY_CONTACT_EMAIL}`} sx={linkSx}>
            {PRIVACY_CONTACT_EMAIL}
          </Link>
          , or call (314) 485-9850.
        </Typography>
        <Typography sx={bodyTextSx}>
          For information regarding user data and privacy related to the use of
          the PheNode or Agrela&apos;s Services, see Agrela&apos;s{' '}
          <Link href={TERMS_URL} target="_blank" rel="noopener noreferrer" sx={linkSx}>
            Terms of Service
          </Link>
          , which are adopted and incorporated herein. Any capitalized terms
          used in this Privacy Policy not otherwise defined herein shall have
          their meaning set forth in the Terms of Service.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={closeButtonSx}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

PrivacyModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
