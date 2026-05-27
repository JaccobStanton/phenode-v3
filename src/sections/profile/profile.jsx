// material-ui
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import useAuth from 'hooks/useAuth';
import { formatRoleLabel } from 'utils/auth';

import { glassSurfaceSx, reflectedCardChromeSx } from 'themes/sx-tokens';

// assets
import AntIcon from 'components/AntIcon';
import MailOutlined from '@ant-design/icons-svg/lib/asn/MailOutlined';
import SafetyCertificateOutlined from '@ant-design/icons-svg/lib/asn/SafetyCertificateOutlined';
import BankOutlined from '@ant-design/icons-svg/lib/asn/BankOutlined';
import ClockCircleOutlined from '@ant-design/icons-svg/lib/asn/ClockCircleOutlined';
import CrownOutlined from '@ant-design/icons-svg/lib/asn/CrownOutlined';
import avatar1 from 'assets/images/users/marble_icon.svg';

// =============================================================================
// Profile — read-only user profile page.
// =============================================================================
//
// What this page shows:
//   Everything we can learn about the signed-in user from the JWT access
//   token (decoded into AuthContext.user). The shape is:
//     - email        (JWT `sub` claim)
//     - role         (USER | ADMIN | SUPER_ADMIN)
//     - isApproved   (boolean)
//     - orgId        (integer or null)
//     - exp          (token expiry — epoch seconds)
//   Verified against phenodeX/docs/frontend-backend-api.md:33-39 and
//   phenodeX/phenode_backend/api/auth/routes.py:36-53.
//
// What's intentionally NOT shown:
//   The backend's User model has additional fields (full_name, is_active,
//   created_at, updated_at, google_sub) but the JWT doesn't carry them
//   and there is currently no /api/user/me endpoint to fetch them
//   client-side. When that endpoint lands, swap the AuthContext-only
//   data path here for an SWR hook that calls /api/user/me — the layout
//   already has slots reserved for "Full name" and "Member since"
//   below.
//
// Theme:
//   Outer MainCard uses the project's glassSurfaceSx + reflected-card
//   chrome — same recipe as the system-diagnostics shell. The hero row
//   re-uses the menu paper gradient (radial #002a63 → #001f53) for a
//   gentle tonal lift against the surrounding card.

// Themed tooltip — same slotProps recipe used across the header
// Profile menu and MobileSection triggers so the hover help here reads
// as part of the same chrome family.
const projectTooltipSlotProps = {
  tooltip: {
    sx: {
      backgroundColor: 'rgba(0, 20, 61, 0.96)',
      color: 'var(--green)',
      border: '1px solid var(--reflected-light)',
      boxShadow: '0 11px 19px 1px #0000002e',
      fontSize: '0.78rem',
      maxWidth: 260,
      lineHeight: 1.4
    }
  }
};

// Map JWT role → chip color so the role chip carries some signal at a
// glance (SUPER_ADMIN gets the brightest treatment). All three colors
// are project palette variables.
function roleChipPalette(role) {
  switch ((role || '').toUpperCase()) {
    case 'SUPER_ADMIN':
      return { color: 'var(--green)', borderColor: 'var(--green)', icon: CrownOutlined };
    case 'ADMIN':
      return { color: 'var(--orange)', borderColor: 'var(--orange)', icon: SafetyCertificateOutlined };
    case 'USER':
    default:
      return { color: 'var(--blue)', borderColor: 'var(--blue)', icon: SafetyCertificateOutlined };
  }
}

// Convert the JWT `exp` epoch-second number to a friendly local-time
// string. We keep this inline (rather than reusing a date util) because
// the format is single-purpose: small caption shown next to the session
// expiry row.
function formatTokenExpiry(exp) {
  if (typeof exp !== 'number') return '—';
  try {
    return new Date(exp * 1000).toLocaleString();
  } catch {
    return '—';
  }
}

// Small detail-row primitive: [icon] [label]  [value]. Used five times
// in the Account Details card; inlining the JSX five times would
// invite drift, hoisting it as a tiny component keeps the rows
// consistent.
//
// `tooltip` prop: when supplied, ONLY the label cluster (icon + label
// text) becomes a hover target that surfaces a short explanation of the
// field — the value itself stays uncovered so users can read/select it
// normally. Cursor switches to `help` over the label to cue the
// affordance (same convention as <abbr title="...">). Themed tooltip
// chrome matches the rest of the app (navy bg / green text /
// reflected-light border).
function DetailRow({ icon, label, value, valueColor = 'var(--green)', tooltip }) {
  // The label cluster: icon + label text. Extracted so we can either
  // render it raw OR wrap just this piece in a Tooltip when `tooltip`
  // is provided. `cursor: help` only applies when there's a tooltip
  // attached — otherwise the label reads as plain inert text.
  const labelCluster = (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        gap: 1,
        minWidth: { sm: 200 },
        color: 'var(--blue)',
        cursor: tooltip ? 'help' : 'default',
        // Constrain the hover target to the label's own width so the
        // tooltip only fires when the user is actually over the key,
        // not the empty space between key and value.
        width: 'fit-content'
      }}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.95rem',
          color: 'inherit'
        }}
      >
        <AntIcon icon={icon} />
      </Box>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'inherit' }}>{label}</Typography>
    </Stack>
  );

  // Tooltip wraps ONLY the label cluster. Box is the ref-holder so the
  // Tooltip can attach event handlers — same pattern used elsewhere in
  // the codebase (drawer NavItem mini-tooltip, header Profile tooltip).
  const labelWithTooltip = tooltip ? (
    <Tooltip
      title={tooltip}
      placement="top-start"
      arrow={false}
      enterDelay={250}
      slotProps={projectTooltipSlotProps}
    >
      <Box sx={{ display: 'inline-flex' }}>{labelCluster}</Box>
    </Tooltip>
  ) : (
    labelCluster
  );

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      sx={{
        gap: { xs: 0.5, sm: 2 },
        alignItems: { xs: 'flex-start', sm: 'center' },
        py: 1.25,
        '&:not(:last-of-type)': {
          borderBottom: '1px solid var(--reflected-light)'
        }
      }}
    >
      {labelWithTooltip}
      <Typography
        sx={{
          fontSize: '0.92rem',
          color: valueColor,
          wordBreak: 'break-word',
          flex: 1,
          // Force the default arrow cursor over the value. Without this,
          // the browser shows the I-beam (text) cursor on Typography by
          // default because the text is selectable — which reads as
          // "editable" to users. Keeping `userSelect` at its default
          // (auto) means the value is still selectable for copy/paste;
          // we only change the cursor shape, not the selection ability.
          cursor: 'default'
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export default function Profile() {
  const { user } = useAuth();

  // Signed-out fallback. RequireAuth should prevent this route from
  // ever rendering without a user, but we don't want a 50ms flash of
  // "Cannot read property 'email' of null" if a token expires while
  // the page is mounted. Tail-rendering a friendly card here keeps
  // the error contained.
  if (!user) {
    return (
      <MainCard sx={{ overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }} content={false}>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 }, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
            You're not signed in.
          </Typography>
          <Typography sx={{ color: 'var(--blue)', fontSize: '0.9rem', mt: 1, opacity: 0.85 }}>
            Sign in to view your profile information.
          </Typography>
        </Box>
      </MainCard>
    );
  }

  const displayName = user.email || 'Signed out';
  const displayRole = formatRoleLabel(user.role);
  const rolePalette = roleChipPalette(user.role);
  const approvalLabel = user.isApproved ? 'Approved' : 'Pending Approval';
  const approvalColor = user.isApproved ? 'var(--green)' : 'var(--orange)';
  const orgLabel = user.orgId == null ? 'Not assigned' : `#${user.orgId}`;
  const sessionExpiry = formatTokenExpiry(user.exp);

  return (
    // `width: 100%, flex: 1, minWidth: 0` is the recipe other pages use
    // (e.g. FleetOverviewView.jsx:676) to fill the dashboard outlet's
    // flex container — without these the Card shrinks to its content's
    // natural width and the page reads as "compressed" instead of
    // spanning the available area between the drawer and the right edge.
    <MainCard
      content={false}
      sx={{ width: '100%', flex: 1, minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}
    >
      {/* ----- Page header banner -----
          Same chrome the SystemDiagnostics page uses (var(--orange) bottom
          rule + var(--blue) heading) so the page reads as a sibling of
          the other dashboard routes. */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: '1px solid',
            borderBottomColor: 'var(--orange)',
            pb: 1.25
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            Profile
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              textAlign: { xs: 'left', md: 'right' },
              width: { xs: '100%', md: 'auto' }
            }}
          >
            <Box component="span" sx={{ color: 'var(--blue)' }}>
              Account ID:
            </Box>
            <Box component="span" sx={{ color: 'var(--green)', ml: 1.5 }}>
              {/* No numeric user id in the JWT — we use the email as the
                  stable user identifier in the rest of the app (it's the
                  `sub` claim) so we surface it here too. */}
              {displayName}
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
          {/* ----- Hero / identity card ----- */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box
              sx={{
                p: { xs: 2.5, sm: 3 },
                borderRadius: 1.5,
                border: '1.5px solid #054085',
                backgroundColor: '#002a63',
                backgroundImage: 'radial-gradient(circle at 50% 15%, #002a63, #001f53)',
                boxShadow: '0 11px 19px 1px #0000002e',
                height: '100%'
              }}
            >
              <Stack alignItems="center" sx={{ gap: 1.5 }}>
                <Avatar
                  alt="profile user"
                  src={avatar1}
                  size="xl"
                  sx={{
                    bgcolor: 'transparent',
                    color: 'inherit',
                    width: 96,
                    height: 96,
                    border: '1.5px solid var(--reflected-light)',
                    boxShadow: 'none',
                    '& img': { display: 'block' }
                  }}
                />
                <Typography
                  noWrap
                  title={displayName}
                  sx={{
                    color: 'var(--green)',
                    fontWeight: 600,
                    fontSize: '1.05rem',
                    maxWidth: '100%',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}
                >
                  {displayName}
                </Typography>
                {/* Role chip — color is driven by `roleChipPalette` so
                    SUPER_ADMIN reads bright green, ADMIN orange, USER
                    blue. Outlined variant matches the project's other
                    badge treatments (fleet status chips, etc.). */}
                <Chip
                  icon={<AntIcon icon={rolePalette.icon} style={{ fontSize: '0.85rem' }} />}
                  label={displayRole}
                  variant="outlined"
                  size="small"
                  sx={{
                    color: rolePalette.color,
                    borderColor: rolePalette.borderColor,
                    backgroundColor: 'rgba(0, 17, 48, 0.35)',
                    '& .MuiChip-icon': { color: 'inherit', ml: 1 },
                    '& .MuiChip-label': { fontWeight: 600, letterSpacing: '0.02em' }
                  }}
                />
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    color: approvalColor,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  {approvalLabel}
                </Typography>
              </Stack>
            </Box>
          </Grid>

          {/* ----- Account Details card ----- */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 1.5,
                border: '1px solid var(--reflected-light)',
                backgroundColor: 'rgba(0, 17, 48, 0.35)',
                backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02))',
                boxShadow: '0 11px 19px 1px #0000002e',
                height: '100%'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: 'var(--green)',
                  fontWeight: 600,
                  mb: 0.5,
                  letterSpacing: '0.02em'
                }}
              >
                Account Details
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--blue)', opacity: 0.85, mb: 1.5 }}>
                Your account information.
              </Typography>
              <Divider sx={{ borderColor: 'var(--reflected-light)', mb: 1 }} />

              <DetailRow
                icon={MailOutlined}
                label="Email"
                value={displayName}
                tooltip="The email address associated with your PheNode account. Used to sign in and to deliver account notifications."
              />
              <DetailRow
                icon={SafetyCertificateOutlined}
                label="Role"
                value={displayRole}
                tooltip="Your access level on PheNode. Determines which features, devices, and administrative tools you can use."
              />
              <DetailRow
                icon={BankOutlined}
                label="Organization"
                value={orgLabel}
                valueColor={user.orgId == null ? 'var(--blue)' : 'var(--green)'}
                tooltip="The organization this account is assigned to. Devices and data are grouped by organization."
              />
              <DetailRow
                icon={SafetyCertificateOutlined}
                label="Approval"
                value={approvalLabel}
                valueColor={approvalColor}
                tooltip="Whether an administrator has approved your account. Pending accounts have limited access until approved."
              />
              <DetailRow
                icon={ClockCircleOutlined}
                label="Session expires"
                value={sessionExpiry}
                valueColor="var(--blue)"
                tooltip="When your sign-in is automatically refreshed in the background. You'll stay signed in — the app just renews your security credentials behind the scenes."
              />
            </Box>
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
