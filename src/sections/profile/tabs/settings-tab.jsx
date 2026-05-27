import { useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

// project imports
import {
  innerCardSx,
  sectionTitleSx,
  sectionSubtitleSx,
  themedCheckboxSx,
  themedSwitchSx
} from '../shared';

// =============================================================================
// SettingsTab — email notification preferences.
// =============================================================================
//
// Mirrors the Mantis "Settings" template (Email Settings + Activity
// Related Emails). Three categories of controls:
//
//   - Email Settings: notification toggles for general email behavior
//     ("get emails at all", "CC personal address").
//   - Updates from System Notification: opt-in checkboxes for specific
//     newsletter / digest emails.
//   - Activity Related Emails: per-event triggers for transactional
//     email (new connection, direct message).
//   - When to escalate: high-priority triggers that pierce quiet
//     hours / digest batching ("upon new order", "membership
//     approval", "member registration").
//
// Backend honesty:
//   No notification-preferences endpoint exists today. The save
//   surface for /user-preferences only carries display + download
//   preferences. All state on this tab is in-memory only — the user
//   can flip toggles and watch them respond, but a refresh resets
//   everything to defaults. When a notification-preferences endpoint
//   lands, swap these useState hooks for a controlled hook that
//   reads from / writes to /user-preferences (or a dedicated
//   notification-preferences route).

// A consistent row primitive used in the toggle-grouped cards. Label +
// optional caption on the left, control on the right. The control is
// passed in as JSX so the same row works for Switch or anything else.
function SettingsRow({ label, caption, control, topBorder }) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.5,
        gap: 2,
        borderTop: topBorder ? '1px solid var(--reflected-light)' : 'none'
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: 'var(--green)', fontSize: '0.92rem', fontWeight: 500 }}>{label}</Typography>
        {caption && (
          <Typography sx={{ color: 'var(--blue)', fontSize: '0.78rem', opacity: 0.85 }}>{caption}</Typography>
        )}
      </Box>
      <Box sx={{ flexShrink: 0 }}>{control}</Box>
    </Stack>
  );
}

export default function SettingsTab() {
  // ---------- Email Settings ----------
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [sendCopyToPersonal, setSendCopyToPersonal] = useState(false);

  // ---------- Updates from System Notification ----------
  // Checkbox group rather than switches, mirroring the Mantis layout
  // (newsletter-style opt-in toggles read better as checkboxes).
  const [updates, setUpdates] = useState({
    productUpdates: true,
    tips: true,
    missedThings: false,
    productNews: false,
    docBusiness: false
  });

  // ---------- Activity Related Emails ----------
  const [emailWhenNotifications, setEmailWhenNotifications] = useState(true);
  const [emailWhenDirectMessage, setEmailWhenDirectMessage] = useState(false);
  const [emailWhenConnection, setEmailWhenConnection] = useState(true);

  // ---------- When to escalate ----------
  // The first two are intentionally disabled because they reference
  // commerce/membership concepts that don't apply to PheNode today.
  // Member registration is enabled-and-on to mirror the Mantis
  // template's default state.
  const escalateUponNewOrder = false;
  const escalateMembershipApproval = false;
  const [escalateMemberRegistration, setEscalateMemberRegistration] = useState(true);

  // Convenience setter for the checkbox group so each <Checkbox> stays
  // a 1-line JSX entry.
  const toggleUpdate = (key) => (_e, checked) => {
    setUpdates((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <Grid container spacing={2.5}>
      {/* ============== LEFT COLUMN: Email Settings + Updates ============== */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Stack sx={{ gap: 2.5 }}>
          {/* ----- Email Settings ----- */}
          <Box sx={innerCardSx}>
            <Typography variant="h6" sx={sectionTitleSx}>
              Email Settings
            </Typography>
            <Typography sx={sectionSubtitleSx}>Control whether and where notifications are emailed.</Typography>

            <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', fontWeight: 600, mt: 1, mb: 0.5 }}>
              Setup Email Notification
            </Typography>
            <SettingsRow
              label="Email Notification"
              control={
                <Switch
                  checked={emailNotifications}
                  onChange={(_e, next) => setEmailNotifications(next)}
                  sx={themedSwitchSx}
                  inputProps={{ 'aria-label': 'Email notifications' }}
                />
              }
            />
            <SettingsRow
              label="Send Copy To Personal Email"
              control={
                <Switch
                  checked={sendCopyToPersonal}
                  onChange={(_e, next) => setSendCopyToPersonal(next)}
                  sx={themedSwitchSx}
                  inputProps={{ 'aria-label': 'Send copy to personal email' }}
                />
              }
              topBorder
            />
          </Box>

          {/* ----- Updates from System Notification ----- */}
          <Box sx={innerCardSx}>
            <Typography variant="h6" sx={sectionTitleSx}>
              Updates from System Notification
            </Typography>
            <Typography sx={sectionSubtitleSx}>Pick which product update emails you want to receive.</Typography>

            <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', fontWeight: 600, mt: 1, mb: 0.5 }}>
              Email you with?
            </Typography>
            <Stack sx={{ gap: 0.25 }}>
              {[
                {
                  key: 'productUpdates',
                  label: 'News about PheNode products and feature updates'
                },
                { key: 'tips', label: 'Tips on getting more out of PheNode' },
                { key: 'missedThings', label: "Things you missed since you last logged into PheNode" },
                { key: 'productNews', label: 'News about products and other services' },
                { key: 'docBusiness', label: 'Tips and Document business products' }
              ].map((opt) => (
                <FormControlLabel
                  key={opt.key}
                  control={
                    <Checkbox
                      checked={updates[opt.key]}
                      onChange={toggleUpdate(opt.key)}
                      sx={themedCheckboxSx}
                    />
                  }
                  label={
                    <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem' }}>{opt.label}</Typography>
                  }
                  sx={{ ml: 0, gap: 0.5 }}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Grid>

      {/* ============== RIGHT COLUMN: Activity Related Emails ============== */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Box sx={innerCardSx}>
          <Typography variant="h6" sx={sectionTitleSx}>
            Activity Related Emails
          </Typography>
          <Typography sx={sectionSubtitleSx}>Choose which activity events trigger an email.</Typography>

          <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', fontWeight: 600, mt: 1, mb: 0.5 }}>
            When to email?
          </Typography>
          <SettingsRow
            label="Have new notifications"
            control={
              <Switch
                checked={emailWhenNotifications}
                onChange={(_e, next) => setEmailWhenNotifications(next)}
                sx={themedSwitchSx}
                inputProps={{ 'aria-label': 'Email on new notifications' }}
              />
            }
          />
          <SettingsRow
            label="You're sent a direct message"
            control={
              <Switch
                checked={emailWhenDirectMessage}
                onChange={(_e, next) => setEmailWhenDirectMessage(next)}
                sx={themedSwitchSx}
                inputProps={{ 'aria-label': 'Email on direct message' }}
              />
            }
            topBorder
          />
          <SettingsRow
            label="Someone adds you as a connection"
            control={
              <Switch
                checked={emailWhenConnection}
                onChange={(_e, next) => setEmailWhenConnection(next)}
                sx={themedSwitchSx}
                inputProps={{ 'aria-label': 'Email when added as a connection' }}
              />
            }
            topBorder
          />

          <Divider sx={{ borderColor: 'var(--reflected-light)', my: 2 }} />

          <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', fontWeight: 600, mt: 1, mb: 0.5 }}>
            When to escalate emails?
          </Typography>
          <SettingsRow
            label="Upon new order"
            control={
              <Switch
                checked={escalateUponNewOrder}
                disabled
                sx={themedSwitchSx}
                inputProps={{ 'aria-label': 'Escalate on new order' }}
              />
            }
          />
          <SettingsRow
            label="New membership approval"
            control={
              <Switch
                checked={escalateMembershipApproval}
                disabled
                sx={themedSwitchSx}
                inputProps={{ 'aria-label': 'Escalate on membership approval' }}
              />
            }
            topBorder
          />
          <SettingsRow
            label="Member registration"
            control={
              <Switch
                checked={escalateMemberRegistration}
                onChange={(_e, next) => setEscalateMemberRegistration(next)}
                sx={themedSwitchSx}
                inputProps={{ 'aria-label': 'Escalate on member registration' }}
              />
            }
            topBorder
          />
        </Box>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.75rem', opacity: 0.7, textAlign: 'right', fontStyle: 'italic' }}>
          Notification preferences are not yet persisted — toggles reset on refresh until the backend lands an
          endpoint for them.
        </Typography>
      </Grid>
    </Grid>
  );
}
