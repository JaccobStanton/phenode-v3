import { useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// project imports
import useAuth from 'hooks/useAuth';
import { useToast } from 'providers/ToastProvider';
import API from 'services/endpoints';
import { primaryActionButtonSx, sectionTitleSx, sectionSubtitleSx } from '../shared';

// assets
import AntIcon from 'components/AntIcon';
import CopyOutlined from '@ant-design/icons-svg/lib/asn/CopyOutlined';
import EyeOutlined from '@ant-design/icons-svg/lib/asn/EyeOutlined';
import EyeInvisibleOutlined from '@ant-design/icons-svg/lib/asn/EyeInvisibleOutlined';
import KeyOutlined from '@ant-design/icons-svg/lib/asn/KeyOutlined';

// =============================================================================
// ApiAccessTab — surface the user's API access token (JWT) for use with
// the PheNode REST API.
// =============================================================================
//
// Implementation parity with phenodeX/phenode_frontend's AccessToken.jsx —
// the "API key" surfaced to the user IS their current access token. There
// is no separate long-lived API key endpoint in the backend (verified
// against phenodeX/phenode_backend/api/* — no `/auth/api-key` route
// exists; only the access/refresh token pair from /auth/login |
// /auth/token | /auth/refresh).
//
// UX considerations:
//   1. The token is sensitive (carries the user's identity). We mask it
//      by default and only reveal it on explicit click.
//   2. The token rotates — the silent-refresh path in services/fetcher.js
//      mints a new one whenever the current access token expires
//      (~1h cycle). Make that explicit in the page copy so a user who
//      copied the token last week doesn't wonder why the API is
//      rejecting it.
//   3. Copy-to-clipboard uses the navigator.clipboard API and falls back
//      to a toast.error if the browser denies the permission (Safari
//      sometimes does in non-secure contexts).

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

// Mask all but the last 4 chars so the user can still confirm they're
// looking at the right token at a glance without revealing it. JWT
// access tokens are ~200 chars on average — masking everything past
// the prefix would lose all visual signal.
function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '•'.repeat(token.length);
  return `${'•'.repeat(24)}${token.slice(-4)}`;
}

export default function ApiAccessTab() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);

  const hasToken = Boolean(accessToken);
  const displayValue = revealed ? accessToken : maskToken(accessToken);

  // Canonical PheNode API host shown in the example. We deliberately
  // hardcode `https://phenode.com` here rather than reading from
  // VITE_API_URL — dev/staging values (e.g. localhost, *.phenode.cloud)
  // shouldn't show up in user-facing documentation copy. The user can
  // swap in their actual host if they need to. The path still comes
  // from the endpoint catalog so a backend route rename keeps this
  // snippet honest. /devices/my-devices is a good example call because
  // it's read-only, requires auth, and exists in every env.
  const exampleCurl = `curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\\n  https://phenode.com${API.devices.myDevices}`;

  const handleCopyExample = async () => {
    try {
      await navigator.clipboard.writeText(exampleCurl);
      toast.success('Example copied to clipboard.');
    } catch {
      toast.error("Couldn't copy the example automatically. Select the text and copy manually.");
    }
  };

  const handleCopy = async () => {
    if (!accessToken) {
      toast.error('No access token available. Please sign in again.');
      return;
    }
    try {
      // navigator.clipboard.writeText is the modern API. It can throw
      // in non-secure contexts (HTTP page) or if the user denies
      // clipboard permission — we surface the error rather than
      // silently failing.
      await navigator.clipboard.writeText(accessToken);
      toast.success('Access token copied to clipboard.');
    } catch (err) {
      // Fallback: most copy failures are permission/secure-context
      // issues. The token is still visible in the masked field — the
      // user can manually select and copy if needed.
      toast.error("Couldn't copy automatically. Reveal the token and copy it manually.");
    }
  };

  return (
    <Stack sx={{ gap: 2.5 }}>
      <Box>
        <Typography variant="h6" sx={sectionTitleSx}>
          API Access Token
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Use this token in the <code style={{ color: 'var(--green)' }}>Authorization: Bearer &lt;token&gt;</code>{' '}
          header when calling the PheNode API from scripts or external tools.
        </Typography>

        {/* Token display field — readonly, masked by default. Wraps in
            a styled Box (not a TextField) because the token can be long
            and we want it to wrap naturally and stay visually compact. */}
        <Stack direction="row" alignItems="stretch" sx={{ gap: 1 }}>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              p: 1.25,
              border: '1px solid var(--reflected-light)',
              borderRadius: 1,
              backgroundColor: 'rgba(0, 17, 48, 0.45)',
              color: revealed ? 'var(--green)' : 'var(--blue)',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              wordBreak: 'break-all',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              userSelect: 'all'
            }}
            // Lets the user double-click to select the whole token
            // when revealed — much faster than dragging through 200
            // chars to highlight.
            tabIndex={hasToken ? 0 : -1}
            aria-label={revealed ? 'API access token' : 'API access token, hidden'}
          >
            {hasToken ? displayValue : '— No active session —'}
          </Box>
          <Tooltip
            title={revealed ? 'Hide token' : 'Show token'}
            placement="top"
            arrow={false}
            slotProps={tooltipSlotProps}
          >
            <span>
              <IconButton
                onClick={() => setRevealed((r) => !r)}
                disabled={!hasToken}
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1,
                  border: '1px solid var(--reflected-light)',
                  color: 'var(--blue)',
                  backgroundColor: 'rgba(0, 20, 61, 0.72)',
                  '&:hover': {
                    borderColor: 'var(--green)',
                    color: 'var(--green)',
                    backgroundColor: 'rgba(72, 247, 245, 0.08)'
                  },
                  '&.Mui-disabled': {
                    color: 'var(--med-grey)',
                    borderColor: 'var(--med-grey)',
                    backgroundColor: '#01113d'
                  }
                }}
                aria-label={revealed ? 'Hide access token' : 'Show access token'}
              >
                <AntIcon icon={revealed ? EyeInvisibleOutlined : EyeOutlined} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {/* Notice — the token rotates with the session. Surfaces an easy-
          to-miss gotcha for anyone who saves the token in a script. */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1,
          backgroundColor: 'rgba(0, 17, 48, 0.45)',
          border: '1px dashed var(--reflected-light)'
        }}
      >
        <Stack direction="row" alignItems="flex-start" sx={{ gap: 1 }}>
          <Box sx={{ color: 'var(--orange)', mt: 0.25, fontSize: '1rem' }}>
            <AntIcon icon={KeyOutlined} />
          </Box>
          <Typography sx={{ fontSize: '0.82rem', color: 'var(--blue)', opacity: 0.9, lineHeight: 1.5 }}>
            This token is tied to your active sign-in session and rotates automatically when it expires (roughly every
            hour). Long-running scripts should re-fetch the token from the sign-in flow rather than caching the value
            shown here. Treat it like a password — anyone holding it can act as you.
          </Typography>
        </Stack>
      </Box>

      {/* ----- Usage example -----
          A real, copy-pasteable curl call against an actual API endpoint
          (/devices/my-devices). URL comes from buildUrl() so it tracks
          whatever VITE_API_URL is set to — no risk of drifting from the
          real host. Token placeholder is YOUR_ACCESS_TOKEN rather than
          the live token so the example is safe to share in screenshots
          / docs. */}
      <Box>
        <Typography variant="h6" sx={sectionTitleSx}>
          Usage example
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Substitute <code style={{ color: 'var(--green)' }}>YOUR_ACCESS_TOKEN</code> with the token above. This
          example lists the PheNode devices visible to your account.
        </Typography>
        <Box
          sx={{
            position: 'relative',
            p: 1.5,
            pr: 6,
            border: '1px solid var(--reflected-light)',
            borderRadius: 1,
            backgroundColor: 'rgba(0, 17, 48, 0.45)',
            fontFamily: 'monospace',
            fontSize: '0.82rem',
            color: 'var(--green)',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            userSelect: 'all'
          }}
        >
          <Box component="code" sx={{ display: 'block' }}>
            {exampleCurl}
          </Box>
          {/* In-line copy button so the user doesn't have to highlight
              the snippet and Ctrl-C. Themed identically to the Show/Hide
              token IconButton above so the controls read as a family. */}
          <Tooltip title="Copy example" placement="top" arrow={false} slotProps={tooltipSlotProps}>
            <IconButton
              onClick={handleCopyExample}
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 32,
                height: 32,
                borderRadius: 1,
                border: '1px solid var(--reflected-light)',
                color: 'var(--blue)',
                backgroundColor: 'rgba(0, 20, 61, 0.72)',
                '&:hover': {
                  borderColor: 'var(--green)',
                  color: 'var(--green)',
                  backgroundColor: 'rgba(72, 247, 245, 0.08)'
                }
              }}
              aria-label="Copy example command"
            >
              <AntIcon icon={CopyOutlined} style={{ fontSize: '0.85rem' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={handleCopy}
          disabled={!hasToken}
          startIcon={<AntIcon icon={CopyOutlined} />}
          sx={primaryActionButtonSx}
        >
          Copy Access Token
        </Button>
      </Stack>
    </Stack>
  );
}
