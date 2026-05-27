import { useMemo, useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// project imports
import Avatar from 'components/@extended/Avatar';
import useAuth from 'hooks/useAuth';
import { useToast } from 'providers/ToastProvider';
import { formatRoleLabel } from 'utils/auth';
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
import SendOutlined from '@ant-design/icons-svg/lib/asn/SendOutlined';
import MoreOutlined from '@ant-design/icons-svg/lib/asn/MoreOutlined';
import avatar1 from 'assets/images/users/marble_icon.svg';

// =============================================================================
// RoleTab — team invitations + member list.
// =============================================================================
//
// Modeled after the Mantis "Role" template (invite-by-email row +
// member roster). Reskinned for PheNode chrome.
//
// Backend honesty:
//   No team / multi-user invitation endpoints exist in the PheNode
//   backend. The /admin/users routes are admin-only and used for
//   approving users, not inviting them. So everything visible here is
//   UI scaffolding:
//
//     - Send (invite) button shows a toast explaining the gap.
//     - Member list seeds with just the current user (role from JWT)
//       so the page isn't visually empty. When the backend grows an
//       endpoint for "list users in my org", swap the seeded array
//       for the SWR hook's result.

// Status pill — color-coded by member state. "Joined" is green
// (active member), "Invited" is blue (pending acceptance).
function StatusPill({ status }) {
  const isJoined = status === 'Joined';
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        border: '1px solid',
        borderColor: isJoined ? 'var(--green)' : 'var(--blue)',
        color: isJoined ? 'var(--green)' : 'var(--blue)',
        backgroundColor: isJoined ? 'rgba(72, 247, 245, 0.08)' : 'rgba(26, 118, 224, 0.08)'
      }}
    >
      {status}
    </Box>
  );
}

// Role pill — color shifts by role tier so SUPER_ADMIN reads brighter
// than USER at a glance, same convention the Profile identity card
// already uses.
function RolePill({ role }) {
  const map = {
    SUPER_ADMIN: { label: 'Super Admin', color: 'var(--green)' },
    ADMIN: { label: 'Admin', color: 'var(--orange)' },
    USER: { label: 'User', color: 'var(--blue)' }
  };
  const upper = (role || 'USER').toUpperCase();
  const tier = map[upper] || map.USER;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        border: '1px solid',
        borderColor: tier.color,
        color: tier.color,
        backgroundColor: 'rgba(0, 17, 48, 0.45)'
      }}
    >
      {tier.label}
    </Box>
  );
}

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

export default function RoleTab() {
  const { user } = useAuth();
  const toast = useToast();

  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);

  // Member list — seeded with the current user only. When the backend
  // grows an endpoint like GET /org/members, replace this useMemo
  // with an SWR call that returns the full roster.
  const members = useMemo(() => {
    if (!user) return [];
    return [
      {
        id: user.email || 'me',
        name: user.email ? user.email.split('@')[0] : 'You',
        email: user.email || '—',
        role: user.role || 'USER',
        status: user.isApproved ? 'Joined' : 'Invited',
        isCurrent: true
      }
    ];
  }, [user]);

  // Plan placeholder copy. The actual seats-available value would come
  // from a billing/plan endpoint that doesn't exist today. We display
  // the current member count over a placeholder cap so the row is
  // visually present (matches the Mantis "5/10" UI element).
  const seatsUsed = members.length;
  const seatsAvailable = 10;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim());

  const handleSendInvite = async () => {
    if (!isValidEmail || sending) return;
    setSending(true);
    try {
      // No real endpoint to call. Show the user a clear message about
      // what's not wired so the click isn't a silent no-op.
      await new Promise((resolve) => setTimeout(resolve, 400));
      toast.error(
        'Team invitations aren\'t wired up yet — the backend doesn\'t expose an invite endpoint. Contact an administrator to add team members.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack sx={{ gap: 2.5 }}>
      {/* =================== Invite ============================ */}
      <Box sx={innerCardSx}>
        <Typography variant="h6" sx={sectionTitleSx}>
          Invite Team Members
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Send an invitation by email. New members get a sign-in link they can use to join your organization.
        </Typography>

        <Stack
          direction="row"
          alignItems="center"
          sx={{
            mb: 2,
            gap: 1,
            color: 'var(--green)',
            fontSize: '0.92rem',
            fontWeight: 600
          }}
        >
          <Box component="span" sx={{ color: 'var(--green)' }}>{seatsUsed}/{seatsAvailable}</Box>
          <Typography component="span" sx={{ color: 'var(--blue)', fontSize: '0.88rem', fontWeight: 400, opacity: 0.85 }}>
            members available in your plan.
          </Typography>
        </Stack>

        <Divider sx={{ borderColor: 'var(--reflected-light)', mb: 2 }} />

        <Typography component="label" htmlFor="invite-email" sx={fieldLabelSx}>
          Email Address
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, alignItems: { xs: 'stretch', sm: 'center' } }}>
          <TextField
            id="invite-email"
            type="email"
            fullWidth
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter email address"
            sx={{ ...themedTextFieldSx, flex: 1, minWidth: 0 }}
            disabled={sending}
            autoComplete="off"
          />
          <Button
            variant="outlined"
            onClick={handleSendInvite}
            disabled={!isValidEmail || sending}
            startIcon={<AntIcon icon={SendOutlined} />}
            sx={{ ...primaryActionButtonSx, minWidth: { sm: 140 }, height: 40, flexShrink: 0 }}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </Stack>
      </Box>

      {/* =================== Member list ======================= */}
      <Box sx={innerCardSx}>
        <Typography variant="h6" sx={sectionTitleSx}>
          Members
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          People with access to this account. Roles are managed by an administrator.
        </Typography>

        {/* Table header — desktop only; collapses cleanly on mobile via the
            row layout below. */}
        <Stack
          direction="row"
          sx={{
            display: { xs: 'none', sm: 'flex' },
            gap: 2,
            pb: 1,
            borderBottom: '1px solid var(--reflected-light)',
            color: 'var(--blue)',
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase'
          }}
        >
          <Box sx={{ flex: 1 }}>Member</Box>
          <Box sx={{ width: 140 }}>Role</Box>
          <Box sx={{ width: 100 }}>Status</Box>
          <Box sx={{ width: 32 }} />
        </Stack>

        {members.map((m) => (
          <Stack
            key={m.id}
            direction={{ xs: 'column', sm: 'row' }}
            sx={{
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 1, sm: 2 },
              py: 1.5,
              borderBottom: '1px solid var(--reflected-light)',
              '&:last-of-type': { borderBottom: 'none' }
            }}
          >
            <Stack direction="row" alignItems="center" sx={{ gap: 1.5, flex: 1, minWidth: 0 }}>
              <Avatar
                alt={m.name}
                src={avatar1}
                size="sm"
                sx={{ bgcolor: 'transparent', color: 'inherit', '& img': { display: 'block' } }}
              />
              <Stack sx={{ minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.92rem' }}
                >
                  {m.name}
                  {m.isCurrent && (
                    <Box component="span" sx={{ color: 'var(--blue)', fontSize: '0.75rem', fontWeight: 400, ml: 1, opacity: 0.8 }}>
                      (you)
                    </Box>
                  )}
                </Typography>
                <Typography noWrap sx={{ color: 'var(--blue)', fontSize: '0.78rem', opacity: 0.85 }}>
                  {m.email}
                </Typography>
              </Stack>
            </Stack>
            <Box sx={{ width: { xs: '100%', sm: 140 } }}>
              <RolePill role={m.role} />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 100 } }}>
              <StatusPill status={m.status} />
            </Box>
            <Tooltip title="More actions (coming soon)" arrow={false} slotProps={tooltipSlotProps}>
              {/* The 3-dot menu is a placeholder — no per-member actions
                  are wired (remove member, change role, resend invite)
                  because none of those endpoints exist. The icon stays
                  so the row layout matches the Mantis screenshot, and
                  the click is harmless. */}
              <span>
                <IconButton
                  size="small"
                  sx={{
                    color: 'var(--blue)',
                    '&:hover': { color: 'var(--green)', backgroundColor: 'rgba(72, 247, 245, 0.08)' }
                  }}
                  aria-label={`Open actions for ${m.name}`}
                  disabled
                >
                  <AntIcon icon={MoreOutlined} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ))}

        {members.length === 0 && (
          <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', opacity: 0.7, py: 3, textAlign: 'center' }}>
            No members yet.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
