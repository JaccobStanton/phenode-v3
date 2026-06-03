import { useCallback, useEffect, useMemo, useState } from 'react';

// material-ui
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// project imports
import useAuth from 'hooks/useAuth';
import useMyDevices from 'hooks/data/useMyDevices';
import { useSelection } from 'contexts/SelectionContext';
import { useToast } from 'providers/ToastProvider';
import { renameDevice, setDeviceEnvironmentVariables } from 'services/mutations';
import { neonControlSx, neonMenuPaperSx, neonMenuItemSx } from 'themes/sx-tokens';
import {
  themedTextFieldSx,
  fieldLabelSx,
  primaryActionButtonSx,
  sectionTitleSx,
  sectionSubtitleSx
} from '../shared';

// assets
import AntIcon from 'components/AntIcon';
import EditOutlined from '@ant-design/icons-svg/lib/asn/EditOutlined';
import WifiOutlined from '@ant-design/icons-svg/lib/asn/WifiOutlined';

// =============================================================================
// DeviceSettingsTab — per-device configuration (rename + WiFi credentials).
// =============================================================================
//
// One device picker at the top, then two independent forms below:
//
//   1. Rename — PUT /devices/{external_id} with { label }
//        (services/mutations.js → renameDevice)
//   2. WiFi  — POST /devices/{external_id}/environment-variables with
//             { wifi_ssid, wifi_password }
//        (services/mutations.js → setDeviceEnvironmentVariables)
//
// Each form has its own dirty state and Save button — they save
// independently so a user changing only the WiFi password doesn't have
// to also re-confirm the label.
//
// Error-copy philosophy: the backend speaks its own implementation
// language ("Notehub environment variable management is not
// configured", "Device has no cellular notecard ID configured") and
// we deliberately TRANSLATE those status codes into customer-facing
// copy here. Two helpers below — friendlyRenameError + friendlyWifiError
// — own that mapping so the toast strings live in one place.

/**
 * Map a renameDevice error to user-facing copy. Falls back to
 * `err.detail` (then a generic message) when we don't have a
 * dedicated translation for the status.
 *
 * Backend status codes from PUT /devices/{id} (api/devices/routes.py:631):
 *   400 — empty/invalid label (guarded by `labelDirty` frontend-side)
 *   403 — caller has no access to this device
 *   404 — device not found
 *   409 — duplicate label (name already used by another PheNode)
 */
function friendlyRenameError(err) {
  const status = err?.status;
  if (status === 409) {
    return 'That name is already in use by another PheNode in your fleet. Please pick a different label.';
  }
  if (status === 403) {
    return "You don't have permission to rename this PheNode.";
  }
  if (status === 404) {
    return "We couldn't find that PheNode. It may have been removed from your fleet — refresh and try again.";
  }
  const detail = err?.detail;
  return detail ? `Couldn't rename: ${detail}` : "Couldn't rename the device. Please try again.";
}

/**
 * Map a setDeviceEnvironmentVariables error to user-facing copy. The
 * Wi-Fi push goes through Notehub, which has its own failure modes the
 * end user shouldn't see verbatim.
 *
 * Backend status codes from POST /devices/{id}/environment-variables
 * (api/devices/routes.py:683):
 *   400 — no environment variables provided (guarded by `wifiReady`)
 *   403 — caller has no access to this device
 *   404 — device not found, OR device has no cellular_notecard_id
 *   502 — Notehub OAuth failed / Notehub PUT failed
 *   503 — Notehub env-var management not configured on this server
 */
function friendlyWifiError(err) {
  const status = err?.status;
  if (status === 503) {
    return 'Wi-Fi configuration is temporarily unavailable on this server. Please try again later or contact support.';
  }
  if (status === 502) {
    return "We couldn't reach the PheNode network to push these credentials. Please try again in a moment.";
  }
  if (status === 404) {
    // Backend conflates "device not found" and "device has no notecard"
    // into the same 404. The notecard case is the far more common one
    // for a signed-in user picking from their own device list — the
    // device list (useMyDevices) already filtered out devices they
    // can't access, so a 404 here almost always means the notecard
    // isn't provisioned yet.
    return "This PheNode isn't provisioned for remote Wi-Fi configuration yet. Contact support to enable it.";
  }
  if (status === 403) {
    return "You don't have permission to push Wi-Fi credentials to this PheNode.";
  }
  const detail = err?.detail;
  return detail ? `Couldn't set Wi-Fi credentials: ${detail}` : "Couldn't set Wi-Fi credentials. Please try again.";
}

// Autocomplete TextField sx — copied verbatim from the canonical
// pattern in sections/data-download/data-downloads.jsx:208-252 so the
// PheNode picker reads as a sibling of the existing Autocomplete
// controls (Data Download's PheNodes / Sensors pickers).
const pickerInputSx = {
  '& .MuiOutlinedInput-root': {
    ...neonControlSx,
    border: '1px solid var(--reflected-light)',
    '&.Mui-disabled': { opacity: 1 },
    '&:hover:not(.Mui-disabled)': { borderColor: 'var(--green)' },
    '&.Mui-focused:not(.Mui-disabled)': { borderColor: 'var(--green)' },
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green)',
    WebkitTextFillColor: 'var(--green)',
    '&::placeholder': { color: 'var(--green)', opacity: 1 }
  },
  '& .MuiSvgIcon-root': { color: 'var(--blue)' },
  '& .MuiOutlinedInput-root:hover:not(.Mui-disabled) .MuiSvgIcon-root': { color: 'var(--green)' },
  '& .MuiOutlinedInput-root.Mui-focused:not(.Mui-disabled) .MuiSvgIcon-root': { color: 'var(--green)' }
};

// Friendly fallback for devices whose label hasn't been set yet — same
// convention used in the fleet-overview rows.
function labelFor(device) {
  if (!device) return '';
  return device.label?.trim() || device.external_device_id || 'Unnamed PheNode';
}

export default function DeviceSettingsTab() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const { devices, isLoading, error, mutate } = useMyDevices();

  // Cross-page device selection — same source of truth that drives
  // Sensor Measurements, Imaging, Diagnostics, and the Fleet Overview.
  // Reading from useSelection() gives this tab the session-scoped
  // freeze-on-first-load default (most-recently-reporting device) for
  // free, AND any explicit pick here propagates to the rest of the
  // dashboard so the user doesn't have to re-pick the same device when
  // they jump from "Account Settings → Devices" to "Sensor Measurements".
  //
  // We still track by external_device_id (the immutable hardware id) so
  // a successful rename mid-session can't unstick the selection.
  //
  // The provider is optional-chained for tests / Storybook where the
  // page is rendered outside the dashboard shell — we fall back to a
  // local useState picker in that case so the component still works.
  const selection = useSelection();
  const [localDeviceId, setLocalDeviceId] = useState(null);
  const selectedDeviceId = selection?.selectedPheNodeId ?? localDeviceId;

  const handleSelectDevice = useCallback(
    (nextId) => {
      if (selection?.selectPheNode) selection.selectPheNode(nextId);
      else setLocalDeviceId(nextId);
    },
    [selection]
  );

  const selectedDevice = useMemo(
    () => devices?.find((d) => d.external_device_id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  // Standalone-render fallback: when there's no SelectionProvider above
  // us, seed the local picker with the most-recently-reporting device
  // exactly once — same recency winner the SelectionProvider would pick
  // (useMyDevices is sorted by last_measurement_at desc on the server).
  // Inside the dashboard this effect is a no-op because `selection` is
  // truthy.
  useEffect(() => {
    if (selection) return;
    if (localDeviceId) return;
    if (!devices || devices.length === 0) return;
    setLocalDeviceId(devices[0].external_device_id);
  }, [selection, devices, localDeviceId]);

  // ---------------------------------------------------------------------------
  // Rename form
  // ---------------------------------------------------------------------------
  const [labelDraft, setLabelDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const currentLabel = selectedDevice?.label ?? '';

  useEffect(() => {
    setLabelDraft(currentLabel);
  }, [currentLabel, selectedDeviceId]);

  const labelDirty = labelDraft.trim() !== (currentLabel || '').trim() && labelDraft.trim().length > 0;

  const handleRename = async () => {
    if (!selectedDevice || !labelDirty || renaming) return;
    const newLabel = labelDraft.trim();
    setRenaming(true);
    try {
      await renameDevice(selectedDevice.external_device_id, newLabel, accessToken);
      await mutate();
      toast.success(`Renamed to "${newLabel}".`);
    } catch (err) {
      toast.error(friendlyRenameError(err));
    } finally {
      setRenaming(false);
    }
  };

  // ---------------------------------------------------------------------------
  // WiFi form
  // ---------------------------------------------------------------------------
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [savingWifi, setSavingWifi] = useState(false);

  useEffect(() => {
    setSsid('');
    setWifiPassword('');
  }, [selectedDeviceId]);

  const wifiReady = ssid.trim().length > 0 && wifiPassword.length > 0 && Boolean(selectedDevice);

  const handleSetWifi = async () => {
    if (!wifiReady || savingWifi) return;
    setSavingWifi(true);
    try {
      await setDeviceEnvironmentVariables(
        selectedDevice.external_device_id,
        { wifi_ssid: ssid.trim(), wifi_password: wifiPassword },
        accessToken
      );
      toast.success('Wi-Fi credentials sent. The PheNode will reconnect shortly.');
      setWifiPassword('');
    } catch (err) {
      toast.error(friendlyWifiError(err));
    } finally {
      setSavingWifi(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading && !devices) {
    return (
      <Stack alignItems="center" sx={{ py: 6, gap: 1.5 }}>
        <CircularProgress sx={{ color: 'var(--green)' }} size={28} />
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.9rem' }}>Loading your devices…</Typography>
      </Stack>
    );
  }

  if (error && !devices) {
    return (
      <Stack alignItems="center" sx={{ py: 6, gap: 1 }}>
        <Typography sx={{ color: 'var(--orange)', fontWeight: 600 }}>We couldn't load your devices.</Typography>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', opacity: 0.85 }}>
          Try refreshing the page. If this keeps happening, contact support.
        </Typography>
      </Stack>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <Stack alignItems="center" sx={{ py: 6, gap: 1 }}>
        <Typography sx={{ color: 'var(--blue)', fontWeight: 600 }}>You don't have any PheNodes yet.</Typography>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', opacity: 0.85 }}>
          Once a PheNode is assigned to your account it will appear here.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack sx={{ gap: 2.5 }}>
      {/* ----- Device picker -----
          Canonical Autocomplete recipe — slotProps.paper + slotProps.listbox
          using the project's neon menu chrome, TextField styled the same
          way the Data Download page styles its pickers. */}
      <Box>
        <Typography component="label" htmlFor="device-picker" sx={fieldLabelSx}>
          PheNode
        </Typography>
        <Autocomplete
          id="device-picker"
          options={devices}
          getOptionLabel={labelFor}
          isOptionEqualToValue={(opt, val) => opt.external_device_id === val.external_device_id}
          value={selectedDevice}
          onChange={(_e, next) => handleSelectDevice(next?.external_device_id ?? null)}
          disableClearable
          renderInput={(params) => (
            <TextField {...params} placeholder="Select a PheNode" size="small" sx={pickerInputSx} />
          )}
          slotProps={{
            paper: { sx: neonMenuPaperSx },
            listbox: {
              sx: {
                p: 0.5,
                '& .MuiAutocomplete-option': { ...neonMenuItemSx, fontSize: '0.85rem' }
              }
            }
          }}
        />
      </Box>

      <Divider sx={{ borderColor: 'var(--reflected-light)' }} />

      {/* ----- Rename -----
          TextField + Save Label button live in one horizontal Stack so
          they share a row at the same baseline. Hardware ID sits BELOW
          the row as a caption — putting it inside a Grid column was what
          pushed the button out of alignment. */}
      <Box>
        <Typography variant="h6" sx={sectionTitleSx}>
          Rename PheNode
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Set a friendly label for this PheNode. The label is what appears in the fleet overview, charts, and
          downloads — the device's hardware identifier never changes.
        </Typography>
        <Typography component="label" htmlFor="device-label" sx={fieldLabelSx}>
          Label
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 1.5, alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <TextField
            id="device-label"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="e.g. North Field PheNode"
            sx={{ ...themedTextFieldSx, flex: 1, minWidth: 0 }}
            disabled={!selectedDevice || renaming}
            inputProps={{ maxLength: 120 }}
          />
          <Button
            variant="outlined"
            onClick={handleRename}
            disabled={!labelDirty || renaming}
            startIcon={
              renaming ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AntIcon icon={EditOutlined} />
            }
            sx={{
              ...primaryActionButtonSx,
              // Lock the button to a comfortable width so it doesn't
              // stretch full-width next to a fluid text field on desktop.
              // On mobile (column layout) it goes full-width naturally
              // via the Stack's `alignItems: stretch`.
              minWidth: { sm: 160 },
              height: 40,
              flexShrink: 0
            }}
          >
            {renaming ? 'Renaming…' : 'Save Label'}
          </Button>
        </Stack>
        {selectedDevice?.external_device_id && (
          <Typography sx={{ fontSize: '0.72rem', color: 'var(--blue)', opacity: 0.7, mt: 0.75 }}>
            Hardware ID: <code style={{ color: 'var(--green)' }}>{selectedDevice.external_device_id}</code>
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'var(--reflected-light)' }} />

      {/* ----- WiFi credentials ----- */}
      <Box>
        <Typography variant="h6" sx={sectionTitleSx}>
          Wi-Fi Credentials
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Push a new Wi-Fi network to this PheNode. The device will reboot and reconnect using the new credentials
          on its next sync. Existing credentials are not shown for security reasons.
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography component="label" htmlFor="wifi-ssid" sx={fieldLabelSx}>
              SSID
            </Typography>
            <TextField
              id="wifi-ssid"
              fullWidth
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="Network name"
              sx={themedTextFieldSx}
              disabled={!selectedDevice || savingWifi}
              inputProps={{ maxLength: 64 }}
              autoComplete="off"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography component="label" htmlFor="wifi-password" sx={fieldLabelSx}>
              Password
            </Typography>
            <TextField
              id="wifi-password"
              type="password"
              fullWidth
              value={wifiPassword}
              onChange={(e) => setWifiPassword(e.target.value)}
              placeholder="Network password"
              sx={themedTextFieldSx}
              disabled={!selectedDevice || savingWifi}
              inputProps={{ maxLength: 128 }}
              autoComplete="new-password"
            />
          </Grid>
        </Grid>
        <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="outlined"
            onClick={handleSetWifi}
            disabled={!wifiReady || savingWifi}
            startIcon={
              savingWifi ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AntIcon icon={WifiOutlined} />
            }
            sx={primaryActionButtonSx}
          >
            {savingWifi ? 'Sending…' : 'Set Wi-Fi Credentials'}
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
