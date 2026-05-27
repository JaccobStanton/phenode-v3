import { useEffect, useMemo, useState } from 'react';

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

  // Selected device. We track by external_device_id (immutable) so a
  // rename mid-session doesn't unstick the selection.
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const selectedDevice = useMemo(
    () => devices?.find((d) => d.external_device_id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  // Auto-select the first device once devices load.
  useEffect(() => {
    if (selectedDeviceId) return;
    if (!devices || devices.length === 0) return;
    setSelectedDeviceId(devices[0].external_device_id);
  }, [devices, selectedDeviceId]);

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
      const detail = err?.detail;
      toast.error(detail ? `Couldn't rename: ${detail}` : "Couldn't rename the device. Please try again.");
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
      const detail = err?.detail;
      toast.error(
        detail ? `Couldn't set Wi-Fi credentials: ${detail}` : "Couldn't set Wi-Fi credentials. Please try again."
      );
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
          onChange={(_e, next) => setSelectedDeviceId(next?.external_device_id ?? null)}
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
