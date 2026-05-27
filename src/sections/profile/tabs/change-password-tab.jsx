import { useMemo, useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// project imports
import useAuth from 'hooks/useAuth';
import { useToast } from 'providers/ToastProvider';
import { changePassword } from 'services/mutations';
import { isLowercaseChar, isNumber, isSpecialChar, isUppercaseChar, minLength } from 'utils/password-validation';
import {
  fieldLabelSx,
  innerCardSx,
  primaryActionButtonSx,
  sectionTitleSx,
  sectionSubtitleSx,
  themedTextFieldSx
} from '../shared';

// assets
import AntIcon from 'components/AntIcon';
import CheckCircleOutlined from '@ant-design/icons-svg/lib/asn/CheckCircleOutlined';
import EyeOutlined from '@ant-design/icons-svg/lib/asn/EyeOutlined';
import EyeInvisibleOutlined from '@ant-design/icons-svg/lib/asn/EyeInvisibleOutlined';
import GoogleOutlined from '@ant-design/icons-svg/lib/asn/GoogleOutlined';
import LockOutlined from '@ant-design/icons-svg/lib/asn/LockOutlined';
import MinusCircleOutlined from '@ant-design/icons-svg/lib/asn/MinusCircleOutlined';
import SaveOutlined from '@ant-design/icons-svg/lib/asn/SaveOutlined';

// =============================================================================
// ChangePasswordTab — set or change the signed-in user's password.
// =============================================================================
//
// Wired against the backend's `PUT /api/auth/password` endpoint
// (services/mutations.js → changePassword), which expects:
//
//   { current_password?: string, new_password: string }
//
// `current_password` is required for users that already have a hash
// stored; optional for Google-only / migrated accounts setting a
// password for the first time. See
// phenodeX/docs/frontend-backend-api.md:340-372 for the full contract.
//
// UX:
//   - Three password inputs (current / new / confirm), each with an
//     eye-button reveal toggle.
//   - Live requirements checklist on the right; each rule turns green
//     as the new password satisfies it.
//   - Inline confirmation-mismatch helper appears once the user has
//     started typing in the confirm field.
//   - Save button disables until current is non-empty, all five rules
//     pass, and confirm matches.
//   - During the mutation, the button shows a spinner + "Saving…",
//     fields go disabled so the user can't double-submit.
//   - On success: toast.success + clear all fields.
//   - On error: toast.error with copy specific to the status code
//     (401 → current incorrect, 400 → backend validation detail,
//     fallback → generic with the backend's .detail when present).

const tooltipSlotProps = {
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

// Each requirement is a tuple of (label, predicate). Iterated as a
// list so adding a new rule (e.g. "no spaces") is a 1-line change.
const REQUIREMENTS = [
  { label: 'At least 8 characters', test: minLength },
  { label: 'At least 1 lowercase letter (a–z)', test: isLowercaseChar },
  { label: 'At least 1 uppercase letter (A–Z)', test: isUppercaseChar },
  { label: 'At least 1 number (0–9)', test: isNumber },
  { label: 'At least 1 special character', test: isSpecialChar }
];

// Themed reveal-toggle IconButton — matches the Show/Hide token
// button in the API Access tab so password reveal reads as the same
// affordance everywhere on this page.
const revealButtonSx = {
  width: 36,
  height: 36,
  borderRadius: 1,
  color: 'var(--blue)',
  '&:hover': {
    color: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.08)'
  }
};

function PasswordField({ id, label, value, onChange, show, onToggleShow, disabled, autoComplete }) {
  return (
    <Box>
      <Typography component="label" htmlFor={id} sx={fieldLabelSx}>
        {label}
      </Typography>
      <TextField
        id={id}
        type={show ? 'text' : 'password'}
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={themedTextFieldSx}
        placeholder={`Enter ${label}`}
        disabled={disabled}
        autoComplete={autoComplete}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={show ? 'Hide' : 'Show'} arrow={false} slotProps={tooltipSlotProps}>
                  <IconButton
                    onClick={onToggleShow}
                    aria-label={show ? `Hide ${label}` : `Show ${label}`}
                    sx={revealButtonSx}
                  >
                    <AntIcon icon={show ? EyeInvisibleOutlined : EyeOutlined} />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            )
          }
        }}
      />
    </Box>
  );
}

export default function ChangePasswordTab() {
  const toast = useToast();
  const { accessToken, user } = useAuth();

  // signInMethod is a frontend-only marker set at login time
  // (AuthLogin → 'password', AuthOAuthCallback → 'google'). When it's
  // explicitly 'google', we lock the form and explain why — that user
  // doesn't have a password to change.
  //
  // TODO(backend has_password): replace this check with
  //   `user?.hasPassword === false` once the backend adds a
  //   has_password claim to the JWT (see SIGN_IN_METHOD_KEY comment
  //   in AuthContext.jsx). The claim is signed and authoritative;
  //   the localStorage marker we use here is only safe for UX gating.
  //
  // Lenient by default: anyone whose signInMethod is null/undefined
  // (legacy localStorage from before this feature shipped) still sees
  // the form. They'll get the right view the next time they sign out
  // and back in.
  const isOAuthOnlySession = user?.signInMethod === 'google';

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);

  // Live requirement evaluation. useMemo so the array reference is
  // stable across renders when newPassword hasn't changed — keeps
  // the requirements list from churning.
  const requirementResults = useMemo(
    () => REQUIREMENTS.map((req) => ({ ...req, met: newPassword.length > 0 && req.test(newPassword) })),
    [newPassword]
  );

  const allRequirementsMet = requirementResults.every((r) => r.met);
  const confirmsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const oldEntered = oldPassword.length > 0;
  const canSubmit = oldEntered && allRequirementsMet && confirmsMatch && !saving;

  // Clear and reset the form. Called on successful save AND any time
  // we want to give the user a clean slate.
  const resetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await changePassword(
        { currentPassword: oldPassword, newPassword },
        accessToken
      );
      // Themed toast — global ToastProvider paints success in
      // var(--green) on the project's chrome (see imports).
      toast.success('Your password has been updated.');
      resetForm();
    } catch (err) {
      // Branch on the documented status codes so the message is
      // actionable rather than a wall of backend internals. The
      // backend's `.detail` is surfaced when present for the
      // generic-error path so a 5xx still shows whatever the
      // backend wrote.
      if (err?.status === 401) {
        toast.error('Your current password is incorrect.');
      } else if (err?.status === 400) {
        toast.error(err?.detail || 'The new password didn\'t meet the requirements.');
      } else if (err?.status === 404) {
        // Shouldn't happen for a signed-in caller — surfaces here
        // only if the JWT references a user that was deleted
        // server-side between sign-in and now.
        toast.error("We couldn't find your account. Try signing out and back in.");
      } else {
        const detail = err?.detail;
        toast.error(detail ? `Couldn't update password: ${detail}` : "Couldn't update your password. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Locked branch — OAuth-only session.
  //
  // The user signed in with Google, so they don't have a password for
  // us to change. Render a clearly-themed lock card instead of the
  // form. Same `innerCardSx` surface as the rest of the page so the
  // visual hierarchy stays consistent — only the content differs.
  // ---------------------------------------------------------------------------
  if (isOAuthOnlySession) {
    return (
      <Stack sx={{ gap: 2.5 }}>
        <Box sx={innerCardSx}>
          <Stack alignItems="center" sx={{ py: 4, gap: 1.5, textAlign: 'center', maxWidth: 520, mx: 'auto' }}>
            {/* Lock + provider chip — visually communicates "external
                provider managed" at a glance before the user reads. */}
            <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--green)',
                  backgroundColor: 'rgba(72, 247, 245, 0.08)',
                  border: '1px solid var(--reflected-light)',
                  fontSize: '1.2rem'
                }}
              >
                <AntIcon icon={LockOutlined} />
              </Box>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--blue)',
                  backgroundColor: 'rgba(26, 118, 224, 0.08)',
                  border: '1px solid var(--reflected-light)',
                  fontSize: '1.2rem'
                }}
              >
                <AntIcon icon={GoogleOutlined} />
              </Box>
            </Stack>

            <Typography variant="h6" sx={sectionTitleSx}>
              Password Change Not Available
            </Typography>

            <Typography sx={{ color: 'var(--blue)', fontSize: '0.9rem', lineHeight: 1.55, opacity: 0.9 }}>
              You signed in with Google, so this account doesn't have a password to manage from here. Your sign-in
              is handled by your Google account.
            </Typography>

            <Typography sx={{ color: 'var(--blue)', fontSize: '0.82rem', opacity: 0.75, mt: 1 }}>
              To change the password on your Google account, visit{' '}
              <Box
                component="a"
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'var(--green)',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                myaccount.google.com/security
              </Box>
              .
            </Typography>
          </Stack>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack sx={{ gap: 2.5 }}>
      <Box sx={innerCardSx}>
        <Typography variant="h6" sx={sectionTitleSx}>
          Change Password
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Enter your current password followed by a new one that satisfies all of the requirements below.
        </Typography>

        <Grid container spacing={3}>
          {/* ----- Left column: the three inputs ----- */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack sx={{ gap: 2 }}>
              <PasswordField
                id="old-password"
                label="Old Password"
                value={oldPassword}
                onChange={setOldPassword}
                show={showOld}
                onToggleShow={() => setShowOld((v) => !v)}
                autoComplete="current-password"
                disabled={saving}
              />
              <PasswordField
                id="new-password"
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggleShow={() => setShowNew((v) => !v)}
                autoComplete="new-password"
                disabled={saving}
              />
              <PasswordField
                id="confirm-password"
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showConfirm}
                onToggleShow={() => setShowConfirm((v) => !v)}
                autoComplete="new-password"
                disabled={saving}
              />
              {/* Inline mismatch helper — only shown once the user has
                  typed in the confirm field, so it doesn't shout at
                  them mid-typing. */}
              {confirmPassword.length > 0 && !confirmsMatch && (
                <Typography sx={{ color: 'var(--orange)', fontSize: '0.78rem', mt: -1 }}>
                  Confirm password doesn't match the new password yet.
                </Typography>
              )}
            </Stack>
          </Grid>

          {/* ----- Right column: live requirements checklist ----- */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid var(--reflected-light)',
                backgroundColor: 'rgba(0, 17, 48, 0.45)',
                height: '100%'
              }}
            >
              <Typography sx={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.95rem', mb: 1.5 }}>
                New password must contain:
              </Typography>
              <Stack sx={{ gap: 0.75 }}>
                {requirementResults.map((req) => (
                  <Stack key={req.label} direction="row" alignItems="center" sx={{ gap: 1 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        color: req.met ? 'var(--green)' : 'var(--blue)',
                        fontSize: '0.85rem',
                        opacity: req.met ? 1 : 0.7,
                        transition: 'color 0.18s ease, opacity 0.18s ease'
                      }}
                    >
                      <AntIcon icon={req.met ? CheckCircleOutlined : MinusCircleOutlined} />
                    </Box>
                    <Typography
                      sx={{
                        color: req.met ? 'var(--green)' : 'var(--blue)',
                        fontSize: '0.82rem',
                        textDecoration: req.met ? 'none' : 'none',
                        opacity: req.met ? 1 : 0.85
                      }}
                    >
                      {req.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* =================== Action row =================== */}
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={handleSave}
          disabled={!canSubmit}
          startIcon={
            // Mirrors the Save Changes button in the Account Settings
            // Display tab — spinner replaces the floppy icon during
            // the in-flight PUT so the button reads "working" without
            // resizing.
            saving ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AntIcon icon={SaveOutlined} />
          }
          sx={primaryActionButtonSx}
        >
          {saving ? 'Saving…' : 'Update Password'}
        </Button>
      </Stack>
    </Stack>
  );
}
