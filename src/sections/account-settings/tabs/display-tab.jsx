import { useEffect, useMemo, useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import useAuth from 'hooks/useAuth';
import useUserPreferences, { defaultUiPreferences } from 'hooks/data/useUserPreferences';
import { useToast } from 'providers/ToastProvider';
import { updateUserPreferences } from 'services/mutations';
import {
  themedSelectSx,
  themedDropdownMenuProps,
  fieldLabelSx,
  primaryActionButtonSx,
  sectionTitleSx,
  sectionSubtitleSx
} from '../shared';

// assets
import AntIcon from 'components/AntIcon';
import SaveOutlined from '@ant-design/icons-svg/lib/asn/SaveOutlined';

// =============================================================================
// DisplayTab — timezone + display units, persisted to /user-preferences.
// =============================================================================
//
// Mirrors the equivalent screen in the existing phenodeX/phenode_frontend
// (src/pages/Profile.jsx — "Customize how timestamps and units are
// displayed across the app and embedded dashboards.") but reskinned in
// the PheNodeV3 chrome and wired against the project's SWR/mutation
// conventions instead of the PreferencesContext from the legacy app.
//
// Data path:
//   - useUserPreferences()                 → GET /user-preferences
//   - updateUserPreferences(payload, tok)  → PUT /user-preferences
//   - mutate() after a successful PUT refreshes the SWR cache so the
//     header / sidebar / chart legends pick up the new units without a
//     reload.
//
// Form contract:
//   - Local state seeds from the loaded uiPreferences once it arrives.
//   - "Save Changes" sends the full uiPreferences object — backend
//     MERGES on the uiPreferences key so we don't have to worry about
//     clobbering dataDownloadPreferences. See
//     phenodeX/phenode_backend/api/preferences/routes.py:115-119.
//   - Dirty tracking via JSON-stringify compare: button is disabled
//     when local state equals the loaded state.

// Build the full timezone list once per mount.
function getAllTimezones() {
  try {
    if (typeof Intl?.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // ignore — fall through to the static list
  }
  return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];
}

function UnitSelect({ label, id, value, onChange, options }) {
  return (
    <Box>
      <Typography component="label" htmlFor={id} sx={fieldLabelSx}>
        {label}
      </Typography>
      <FormControl fullWidth>
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          sx={themedSelectSx}
          MenuProps={themedDropdownMenuProps}
        >
          {options.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

// Option lists — values match the backend's UiPreferencesUnits enum
// (phenodeX/phenode_backend/schemas/user_preferences.py:18-27).
const TEMPERATURE_OPTIONS = [
  { value: 'F', label: 'Fahrenheit (°F)' },
  { value: 'C', label: 'Celsius (°C)' }
];
const SPEED_OPTIONS = [
  { value: 'mph', label: 'Miles / hour (mph)' },
  { value: 'kmh', label: 'Kilometers / hour (km/h)' },
  { value: 'ms', label: 'Meters / second (m/s)' }
];
const DISTANCE_OPTIONS = [
  { value: 'mi', label: 'Miles' },
  { value: 'km', label: 'Kilometers' }
];
const PRESSURE_OPTIONS = [
  { value: 'kpa', label: 'Kilopascal (kPa)' },
  { value: 'hpa', label: 'Hectopascal (hPa)' }
];
const RAINFALL_OPTIONS = [
  { value: 'mm', label: 'Millimeters (mm)' },
  { value: 'in', label: 'Inches (in)' }
];
const VOLTAGE_OPTIONS = [
  { value: 'mv', label: 'Millivolts (mV)' },
  { value: 'v', label: 'Volts (V)' }
];
const CONDUCTIVITY_OPTIONS = [
  { value: 'dsm', label: 'Decisiemens / meter (dS/m)' },
  { value: 'mscm', label: 'Millisiemens / centimeter (mS/cm)' }
];
const RESISTANCE_OPTIONS = [
  { value: 'kohm', label: 'Kilohms (kΩ)' },
  { value: 'ohm', label: 'Ohms (Ω)' }
];
const ACCELERATION_OPTIONS = [
  { value: 'ms2', label: 'Meters / second² (m/s²)' },
  { value: 'g', label: 'Gravity (g)' }
];

export default function DisplayTab() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const { preferences, isLoading, error, mutate } = useUserPreferences();

  const timezones = useMemo(() => getAllTimezones(), []);

  const [timezone, setTimezone] = useState('');
  const [units, setUnits] = useState(defaultUiPreferences.units);
  const [saving, setSaving] = useState(false);

  const loadedFormState = useMemo(
    () => ({
      timezone: preferences?.uiPreferences?.timezone ?? '',
      units: {
        ...defaultUiPreferences.units,
        ...(preferences?.uiPreferences?.units || {})
      }
    }),
    [preferences]
  );

  useEffect(() => {
    setTimezone(loadedFormState.timezone);
    setUnits(loadedFormState.units);
  }, [loadedFormState]);

  const isDirty = useMemo(
    () => JSON.stringify({ timezone, units }) !== JSON.stringify(loadedFormState),
    [timezone, units, loadedFormState]
  );

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const updated = await updateUserPreferences(
        { uiPreferences: { timezone: timezone || null, units } },
        accessToken
      );
      await mutate(updated, { revalidate: false });
      toast.success('Your display preferences have been saved.');
    } catch (err) {
      const detail = err?.detail;
      toast.error(detail ? `Couldn't save: ${detail}` : "Couldn't save your display preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isInitialLoad = isLoading && !preferences;

  if (isInitialLoad) {
    return (
      <Stack alignItems="center" sx={{ py: 6, gap: 1.5 }}>
        <CircularProgress sx={{ color: 'var(--green)' }} size={28} />
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.9rem' }}>Loading your preferences…</Typography>
      </Stack>
    );
  }

  if (error && !preferences) {
    return (
      <Stack alignItems="center" sx={{ py: 6, gap: 1 }}>
        <Typography sx={{ color: 'var(--orange)', fontWeight: 600 }}>
          We couldn't load your preferences.
        </Typography>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem', opacity: 0.85 }}>
          Try refreshing the page. If this keeps happening, contact support.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack sx={{ gap: 2.5 }}>
      {/* ----- Timezone ----- */}
      <Box>
        <Typography variant="h6" sx={sectionTitleSx}>
          Timezone
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Controls the timezone used to display timestamps in charts, tables, and download files. Leave on
          &quot;Use device timezone&quot; to let the app follow whatever timezone your computer is set to.
        </Typography>
        <FormControl fullWidth>
          <Select
            id="tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            sx={themedSelectSx}
            MenuProps={themedDropdownMenuProps}
            displayEmpty
            renderValue={(selected) => selected || 'Use device timezone (recommended)'}
          >
            <MenuItem value="">Use device timezone (recommended)</MenuItem>
            {timezones.map((tz) => (
              <MenuItem key={tz} value={tz}>
                {tz}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Divider sx={{ borderColor: 'var(--reflected-light)' }} />

      {/* ----- Units ----- */}
      <Box>
        <Typography variant="h6" sx={sectionTitleSx}>
          Units
        </Typography>
        <Typography sx={sectionSubtitleSx}>
          Choose the units used everywhere readings are shown — sensor cards, charts, exported CSV files, and any
          embedded dashboards. Your selection applies across the whole app.
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Temperature"
              id="unit-temperature"
              value={units.temperature}
              onChange={(v) => setUnits((u) => ({ ...u, temperature: v }))}
              options={TEMPERATURE_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Speed"
              id="unit-speed"
              value={units.speed}
              onChange={(v) => setUnits((u) => ({ ...u, speed: v }))}
              options={SPEED_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Distance"
              id="unit-distance"
              value={units.distance}
              onChange={(v) => setUnits((u) => ({ ...u, distance: v }))}
              options={DISTANCE_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Pressure"
              id="unit-pressure"
              value={units.pressure}
              onChange={(v) => setUnits((u) => ({ ...u, pressure: v }))}
              options={PRESSURE_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Rainfall"
              id="unit-rainfall"
              value={units.rainfall}
              onChange={(v) => setUnits((u) => ({ ...u, rainfall: v }))}
              options={RAINFALL_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Voltage"
              id="unit-voltage"
              value={units.voltage}
              onChange={(v) => setUnits((u) => ({ ...u, voltage: v }))}
              options={VOLTAGE_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Conductivity"
              id="unit-conductivity"
              value={units.conductivity}
              onChange={(v) => setUnits((u) => ({ ...u, conductivity: v }))}
              options={CONDUCTIVITY_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Resistance"
              id="unit-resistance"
              value={units.resistance}
              onChange={(v) => setUnits((u) => ({ ...u, resistance: v }))}
              options={RESISTANCE_OPTIONS}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UnitSelect
              label="Acceleration"
              id="unit-acceleration"
              value={units.acceleration}
              onChange={(v) => setUnits((u) => ({ ...u, acceleration: v }))}
              options={ACCELERATION_OPTIONS}
            />
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ borderColor: 'var(--reflected-light)' }} />

      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1.5, alignItems: 'center' }}>
        {isDirty && (
          <Typography sx={{ fontSize: '0.78rem', color: 'var(--orange)', fontStyle: 'italic' }}>
            You have unsaved changes.
          </Typography>
        )}
        <Button
          variant="outlined"
          onClick={handleSave}
          disabled={!isDirty || saving}
          startIcon={saving ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AntIcon icon={SaveOutlined} />}
          sx={primaryActionButtonSx}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </Stack>
    </Stack>
  );
}
