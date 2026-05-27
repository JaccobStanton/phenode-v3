import { useMemo, useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// project imports
import useAuth from 'hooks/useAuth';
import { formatRoleLabel } from 'utils/auth';
import {
  fieldLabelSx,
  innerCardSx,
  sectionTitleSx,
  sectionSubtitleSx,
  themedSwitchSx,
  themedTextFieldSx
} from '../shared';

// assets
import AntIcon from 'components/AntIcon';
import DesktopOutlined from '@ant-design/icons-svg/lib/asn/DesktopOutlined';
import LogoutOutlined from '@ant-design/icons-svg/lib/asn/LogoutOutlined';

// =============================================================================
// MyAccountTab — general identity + session info.
// =============================================================================
//
// Mirrors the Mantis "My Account" template (Username / Account Email,
// security toggles, recognized devices, active sessions) but adapted
// for what PheNode actually has today:
//
//   - Username and Account Email: read-only because we only get the
//     email from the JWT and no /api/user/me endpoint exists. Both
//     render as themed disabled-style TextFields so the user sees
//     them as "we know these, but you can't edit here yet."
//   - Advance Settings: three Switch toggles that match the template
//     visually. State is local — none of the toggled behaviors
//     ("secure browsing", "login notifications", "login approvals")
//     are actually implemented on the backend yet, but the UI is
//     here so when they ship, we only have to wire the onChange
//     handlers, not rebuild the row.
//   - Recognized Devices: empty-state card. The backend doesn't track
//     this; when it does, render the device list here.
//   - Active Sessions: shows the current browser session (everything
//     we can detect on the client) + a Logout button that uses the
//     existing auth flow.

// Derive a short label from the user's email — anything before the @,
// fallback to the full email when there's no @ (e.g. password user
// without a canonical username). Matches the same logic the drawer's
// user menu would use if we ever need it again.
function deriveUsername(email) {
  if (!email) return '';
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

// Best-effort current-device label from the User-Agent string. Hugely
// imperfect — UA strings are notoriously unreliable — but enough to
// say "you're signed in on a Mac in Chrome" without pinging an
// external geolocation/UA service. If the page lands in an iframe or
// the navigator is locked down (privacy mode), falls back to
// "This browser".
function describeCurrentSession() {
  if (typeof navigator === 'undefined') return 'This browser';
  const ua = navigator.userAgent || '';
  let os = 'Unknown OS';
  if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';

  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  return `${browser} on ${os}`;
}

export default function MyAccountTab() {
  const { user, logout } = useAuth();

  // Form values — seeded from the JWT user. Both fields are read-only
  // until a /api/user/me endpoint exists to mutate them; the local
  // useState here is forward-compatible so the inputs already behave
  // like controlled fields.
  const initialUsername = useMemo(() => deriveUsername(user?.email), [user?.email]);
  const [username, setUsername] = useState(initialUsername);
  const [accountEmail, setAccountEmail] = useState(user?.email || '');

  // Advance Settings toggles — local state only; no backend yet.
  // Defaults reflect the Mantis screenshot ("on, on, on") for visual
  // parity; the user can flip them but nothing persists.
  const [secureBrowsing, setSecureBrowsing] = useState(true);
  const [loginNotifications, setLoginNotifications] = useState(true);
  const [loginApprovals, setLoginApprovals] = useState(true);

  const sessionLabel = useMemo(() => describeCurrentSession(), []);
  const roleLabel = user ? formatRoleLabel(user.role) : '—';

  return (
    <Stack sx={{ gap: 2.5 }}>
      {/* =================== General Settings =================== */}
      <Box sx={innerCardSx}>
        <Typography variant="h6" sx={sectionTitleSx}>
          General Settings
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Your account identity. These come from your sign-in token; ask an administrator to update them if anything's
          out of date.
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography component="label" htmlFor="account-username" sx={fieldLabelSx}>
              Username
            </Typography>
            <TextField
              id="account-username"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={themedTextFieldSx}
              placeholder="—"
              // Read-only via disabled prop because there's no backend
              // mutation for this yet. Once /api/user/me lands, drop
              // `disabled` and wire the onChange to a save handler.
              disabled
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography component="label" htmlFor="account-email" sx={fieldLabelSx}>
              Account Email
            </Typography>
            <TextField
              id="account-email"
              fullWidth
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              sx={themedTextFieldSx}
              placeholder="—"
              disabled
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography component="label" htmlFor="account-role" sx={fieldLabelSx}>
              Role
            </Typography>
            <TextField id="account-role" fullWidth value={roleLabel} sx={themedTextFieldSx} disabled />
          </Grid>
        </Grid>
      </Box>

      {/* ─────────────────────────────────────────────────────────────
          TEMPORARILY HIDDEN — Advance Settings / Recognized Devices /
          Active Sessions cards.
          The `{false && (...)}` guard keeps the JSX (and its
          state hooks / imports) intact while React skips rendering.
          To re-enable, flip the `false` to `true` (or remove the
          guard entirely). Backend support is still needed before
          these surfaces do anything useful.
          ───────────────────────────────────────────────────────── */}
      {false && (
        <>
          {/* =================== Advance Settings =================== */}
          <Box sx={innerCardSx}>
            <Typography variant="h6" sx={sectionTitleSx}>
              Advance Settings
            </Typography>
            <Typography sx={sectionSubtitleSx}>
              Security and sign-in behavior. Toggle changes are saved per account.
            </Typography>

            {[
              {
                id: 'secure-browsing',
                label: 'Secure Browsing',
                caption: 'Browsing Securely ( https ) when it’s necessary',
                value: secureBrowsing,
                setValue: setSecureBrowsing
              },
              {
                id: 'login-notifications',
                label: 'Login Notifications',
                caption: 'Notify when login attempted from other place',
                value: loginNotifications,
                setValue: setLoginNotifications
              },
              {
                id: 'login-approvals',
                label: 'Login Approvals',
                caption: 'Approvals is not required when login from unrecognized devices.',
                value: loginApprovals,
                setValue: setLoginApprovals
              }
            ].map((row, idx) => (
              <Stack
                key={row.id}
                direction="row"
                sx={{
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.5,
                  gap: 2,
                  borderTop: idx === 0 ? 'none' : '1px solid var(--reflected-light)'
                }}
              >
                <Box>
                  <Typography sx={{ color: 'var(--green)', fontSize: '0.92rem', fontWeight: 500 }}>
                    {row.label}
                  </Typography>
                  <Typography sx={{ color: 'var(--blue)', fontSize: '0.78rem', opacity: 0.85 }}>
                    {row.caption}
                  </Typography>
                </Box>
                <Switch
                  checked={row.value}
                  onChange={(_e, next) => row.setValue(next)}
                  sx={themedSwitchSx}
                  inputProps={{ 'aria-labelledby': row.id }}
                />
              </Stack>
            ))}
          </Box>

          {/* =================== Recognized Devices =================== */}
          <Box sx={innerCardSx}>
            <Typography variant="h6" sx={sectionTitleSx}>
              Recognized Devices
            </Typography>
            <Typography sx={sectionSubtitleSx}>
              Devices you've previously used to sign in. Approve or revoke from here once device tracking is enabled.
            </Typography>

            {/* Empty state — the backend doesn't track recognized devices
                yet. When it does, swap this for a list of device cards
                (Cent Desktop / Imho Tablet / Albs Mobile pattern). */}
            <Stack
              alignItems="center"
              sx={{
                py: 4,
                gap: 1,
                border: '1px dashed var(--reflected-light)',
                borderRadius: 1,
                backgroundColor: 'rgba(0, 17, 48, 0.45)'
              }}
            >
              <Box sx={{ color: 'var(--blue)', fontSize: '1.6rem', opacity: 0.7 }}>
                <AntIcon icon={DesktopOutlined} />
              </Box>
              <Typography sx={{ color: 'var(--blue)', fontSize: '0.9rem', fontWeight: 500 }}>
                No additional devices recognized yet
              </Typography>
              <Typography sx={{ color: 'var(--blue)', fontSize: '0.78rem', opacity: 0.7 }}>
                Devices that successfully sign in to this account will appear here.
              </Typography>
            </Stack>
          </Box>

          {/* =================== Active Sessions =================== */}
          <Box sx={innerCardSx}>
            <Typography variant="h6" sx={sectionTitleSx}>
              Active Sessions
            </Typography>
            <Typography sx={sectionSubtitleSx}>
              Sign out of the current session if you're done. (Multi-session listing will appear here once the backend
              tracks per-device sessions.)
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              sx={{
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 1.5
              }}
            >
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--green)',
                    backgroundColor: 'rgba(72, 247, 245, 0.08)',
                    border: '1px solid var(--reflected-light)'
                  }}
                >
                  <AntIcon icon={DesktopOutlined} />
                </Box>
                <Box>
                  <Typography sx={{ color: 'var(--green)', fontSize: '0.92rem', fontWeight: 600 }}>
                    {sessionLabel}
                  </Typography>
                  <Typography sx={{ color: 'var(--blue)', fontSize: '0.78rem', opacity: 0.85 }}>
                    This is the session you're currently signed in from.
                  </Typography>
                </Box>
              </Stack>
              {/* Logout — wires to useAuth().logout() so the click follows the
                  same path as the drawer + header Logout buttons. */}
              <Box
                component="button"
                type="button"
                onClick={() => logout()}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  border: '1px solid var(--reflected-light)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  color: 'var(--orange)',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'none',
                  '&:hover': {
                    color: 'var(--red)',
                    borderColor: 'var(--red)',
                    backgroundColor: 'rgba(255, 72, 75, 0.08)'
                  }
                }}
              >
                <AntIcon icon={LogoutOutlined} style={{ fontSize: '0.95rem' }} />
                Logout
              </Box>
            </Stack>
          </Box>
        </>
      )}

      <Divider sx={{ borderColor: 'var(--reflected-light)' }} />

      <Typography sx={{ color: 'var(--blue)', fontSize: '0.75rem', opacity: 0.7, textAlign: 'right', fontStyle: 'italic' }}>
        Some account fields are read-only until the user-profile API lands. See file header for details.
      </Typography>
    </Stack>
  );
}
