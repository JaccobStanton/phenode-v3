// =============================================================================
// PhenodeSelector — themed Autocomplete dropdown for choosing a PheNode
// =============================================================================
//
// Used on the wireless-sensors fleet page (sections/fleet-overview/
// sensor-fleet-overview.jsx) to pick which PheNode's connected sensors
// to display. Wireless sensors are sub-devices that pair with PheNodes;
// rendering all of them at once on a multi-PheNode account is slow and
// usually irrelevant — the user almost always wants to inspect one
// PheNode's sensor cohort at a time.
//
// Visual chrome is a 1:1 copy of the PheNode-picker Autocomplete in
// sections/wireless-sensors/sensor-network.jsx (lines 126-172) — same
// neonControlSx field, same neonMenuPaperSx popped paper, same
// neonMenuItemSx options. Mirroring the existing pattern means users
// see one consistent dropdown vocabulary across the app and any future
// theme tweak (e.g. a token color change in sx-tokens.js) flows through
// to both places without needing to be repeated.
//
// Label is a plain Typography to the LEFT of the Autocomplete (not
// MUI's InputLabel above the field). InputLabel is what MUI uses for
// floating labels above an input, and its default `shrink` background
// patch was the source of the "yellow glow" the user kept seeing —
// MUI paints that small background swatch behind shrunk labels so
// they can punch through a notched-outline border, but our outline
// is suppressed and the patch was bleeding through as a tint over
// the orange title-bar divider line. Switching to a plain Typography
// sidesteps that whole MUI machinery.

import PropTypes from 'prop-types';
import { useMemo } from 'react';

import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { neonControlSx, neonMenuItemSx, neonMenuPaperSx } from 'themes/sx-tokens';

// Field width — wide enough to comfortably display longer PheNode
// labels without immediate truncation, while still leaving room for
// the search icon + input that sit to its right in the toolbar row.
//
// Widened on every breakpoint after the mobile audit — at xs=200/sm=260
// the field truncated common labels like "Greenhouse 3 — North Bay" with
// an ellipsis the moment the dropdown was closed, forcing users to open
// the menu just to read which device they had selected. The new floor
// (xs=280) lets the typical 20–24 char label render in full on a 412px
// viewport; sm+ widens further so the dropdown can grow with the
// available toolbar room.
const FIELD_WIDTH = { xs: 280, sm: 320, md: 340 };

// Narrower default for callers that share the toolbar row with other
// controls (notably the wireless-sensor fleet's scope-selector slot,
// where the dropdown lives alongside the search + filter chrome and
// 280px on xs pushed the right-side controls off the visible toolbar).
// Exported so opinionated callers can opt back into the compact size
// without re-declaring the breakpoint shape inline.
export const COMPACT_FIELD_WIDTH = { xs: 200, sm: 260 };

// Inline TextField sx — mirror of the rename input pattern in
// sensor-network.jsx:136-156. Suppresses the notched outline (the
// neonControlSx border is the visible frame), greens the typed text
// + placeholder, blues the dropdown caret icon.
const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    ...neonControlSx,
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none'
    },
    '&.Mui-focused': {
      borderColor: 'var(--blue)'
    }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green)',
    '&::placeholder': {
      color: 'var(--green)',
      opacity: 1
    }
  },
  '& .MuiSvgIcon-root': {
    color: 'var(--blue)'
  }
};

const slotPropsConfig = {
  paper: {
    sx: neonMenuPaperSx
  },
  listbox: {
    sx: {
      p: 0.5,
      '& .MuiAutocomplete-option': {
        ...neonMenuItemSx
      }
    }
  }
};

export default function PhenodeSelector({
  devices,
  selectedDeviceId,
  onChange,
  isLoading,
  // Caller-supplied label rendered above the dropdown. Default
  // matches the original "Showing sensors connected to:" copy used
  // on the wireless-sensor fleet page. Pass `null` (or an empty
  // string) to render the Autocomplete bare with no label — used by
  // the sensor-measurements page, where the placeholder text alone
  // ("Select PheNode...") communicates the affordance and the
  // surrounding title row provides the context.
  label = 'Showing sensors connected to:',
  // Optional width override. Defaults to the wide FIELD_WIDTH used on
  // standalone toolbars (Imaging, Sensor Measurements, System
  // Diagnostics, etc). The wireless-sensor fleet page passes
  // COMPACT_FIELD_WIDTH because the dropdown shares its row with the
  // search input + filter buttons and needs to stay narrow on mobile.
  width = FIELD_WIDTH
}) {
  // Autocomplete works best with object options carrying both an `id`
  // (for equality) and a `label` (for display). Mapping device list
  // here so consumers don't have to pre-shape the data.
  const options = useMemo(
    () =>
      (devices ?? []).map((device) => ({
        id: device.external_device_id,
        label: device.label || device.external_device_id
      })),
    [devices]
  );

  // Autocomplete's `value` prop expects one of the rendered option
  // objects (or null) — we resolve from the selectedDeviceId string
  // by finding the matching option each render. Defaults to null
  // when nothing matches, which keeps Autocomplete in its empty/
  // placeholder state.
  const value = options.find((opt) => opt.id === selectedDeviceId) ?? null;

  return (
    <Stack
      spacing={0.5}
      sx={{
        // Default Stack direction is column — label sits ABOVE the
        // dropdown as a label/field pair.
        // flexShrink: 0 so the search input can't squeeze the picker
        // when it expands inside the toolbar row.
        flexShrink: 0,
        minWidth: 0
      }}
    >
      {/*
        Label is optional — when the caller passes a falsy value
        (null / empty string) the Typography is skipped entirely so
        the Autocomplete sits flush at the top of the Stack. The
        sensor-measurements page uses this mode to match the bare
        dropdown chrome on the wireless-sensors page.
      */}
      {label ? (
        <Typography
          sx={{
            color: 'var(--blue)',
            fontSize: { xs: '0.78rem', sm: '0.84rem' },
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
            // No textTransform — render the label exactly as written
            // ("Showing sensors for:"), not uppercased. Plain Typography
            // means no MUI InputLabel background patch, so the yellow
            // tint that was bleeding through over the title row's
            // orange divider line is gone at the source.
            backgroundColor: 'transparent'
          }}
        >
          {label}
        </Typography>
      ) : null}
      <Autocomplete
        options={options}
        value={value}
        onChange={(_, newValue) => onChange(newValue?.id ?? null)}
        loading={isLoading}
        loadingText="Loading PheNodes…"
        noOptionsText="No PheNodes available"
        isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
        sx={{ width }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={isLoading ? 'Loading…' : 'Select PheNode...'}
            size="small"
            sx={textFieldSx}
          />
        )}
        slotProps={slotPropsConfig}
      />
    </Stack>
  );
}

PhenodeSelector.propTypes = {
  // Raw DeviceRead[] from useMyDevices — we read .external_device_id
  // and .label off each. Don't pass the transformed FleetOverviewView
  // row shape; that has different field names.
  devices: PropTypes.array,
  selectedDeviceId: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  // Accept any sx-shaped value (number, string, or a per-breakpoint
  // object) so callers can pass either FIELD_WIDTH-style maps or a
  // fixed number.
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.object])
};
