import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import AntIcon from 'components/AntIcon';
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';
import DownloadOutlined from '@ant-design/icons-svg/lib/asn/DownloadOutlined';

import ChartGlowDefs from 'components/ChartGlowDefs';
import MainCard from 'components/MainCard';
import PhenodeSelector from 'components/PhenodeSelector';
// PheNodeFleetMap is lazy-loaded so the @vis.gl/react-google-maps wrapper
// (and the Google Maps JS API runtime it pulls in at use-time) only
// parses for users who actually open the map view. Most users on this
// page stay in the chart view, so this saves a meaningful chunk of TTI
// on first paint. The conditional render below is wrapped in Suspense
// with a small CircularProgress fallback for the brief moment between
// "user clicked the toggle" and "map chunk has finished parsing."
const PheNodeFleetMap = lazy(() => import('sections/sensor-measurements/phenode-fleet-map'));
import useAuth from 'hooks/useAuth';
import useMyDevices from 'hooks/data/useMyDevices';
import useDeviceMeasurements from 'hooks/data/useDeviceMeasurements';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import { useToast } from 'providers/ToastProvider';
import { downloadDeviceSensorData, renameDevice } from 'services/mutations';
import triggerBlobDownload from 'utils/triggerBlobDownload';
import { formatLastMeasurement, formatTemperature, formatTodaysRainfall, formatWindSpeed } from 'utils/transforms/device';
import {
  CHART_TIME_RANGE_LABELS,
  DEFAULT_CHART_TIME_RANGE,
  axisTickNumberFor,
  computeAxisTicks,
  computeChartWindow,
  findChartTimeRange,
  formatAxisTick,
  formatTooltipDate,
  pickAxisFormatForRange
} from 'utils/chartTimeRanges';
import rainSensorIcon from 'assets/sensor-measurements/Rain.svg';
import tempSensorIcon from 'assets/sensor-measurements/Temp.svg';
import windSensorIcon from 'assets/sensor-measurements/Wind.svg';
import mapIconActive from 'assets/toggle_buttons/Map_Icon_Active.svg';
import mapIconInactive from 'assets/toggle_buttons/Map_Icon_Inactive.svg';
import phenodeFleetIcon from 'assets/drawer-icons/PheNode_Fleet.svg';
import phenodeFleetIconActive from 'assets/drawer-icons/PheNode_Fleet_Active.svg';

import AppstoreOutlined from '@ant-design/icons-svg/lib/asn/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons-svg/lib/asn/ClockCircleOutlined';
import ZoomInOutlined from '@ant-design/icons-svg/lib/asn/ZoomInOutlined';

import {
  reflectedCardChromeSx,
  orientationButtonSx,
  tooltipSlotProps,
  neonSelectMenuPaperProps,
  neonControlSx,
  drawerNavButtonSurfaceSx
} from 'themes/sx-tokens';

// Sensor-measurements uses a slightly opaque "drf" base for its main panel;
// keep this local variant rather than the more translucent shared one.
const glassSurfaceSx = {
  backgroundColor: 'var(--drf)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

// Chart panel surface – gradient with custom border, distinct from the shared chart surface.
const chartSurfaceSx = {
  backgroundColor: '#07143f',
  backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
  border: '1px solid #0e346a'
};

// Search-param names this page reads from and writes to.
// Centralizing keeps the URL surface auditable in one place — anything
// that wants to deep-link into a particular state (fleet-overview card
// click → ?device=, the Lighthouse audit deep-linking into the map
// view via ?view=map, or a saved bookmark with both ?device= and
// ?range= set) flips through these constants instead of hardcoded
// string literals scattered across the component.
//
//   DEVICE_PARAM ─ external_device_id the page is scoped to. Written
//                  by the fleet-overview cards and the PhenodeSelector
//                  dropdown.
//   RANGE_PARAM  ─ time-range label the chart panel is currently
//                  showing. Written by the time-range Select. Persists
//                  the user's choice across reloads and survives
//                  bookmark sharing ("send me a link to the last-year
//                  view of this device").
//   VIEW_PARAM   ─ 'map' when the map view is open, omitted otherwise.
//                  Written by the map toggle button. Lets the audit
//                  script (and any future automation) navigate
//                  directly into the map state for Lighthouse capture.
const DEVICE_PARAM = 'device';
const RANGE_PARAM = 'range';
const VIEW_PARAM = 'view';
const VIEW_PARAM_MAP_VALUE = 'map';

// Sentinel label appended to the time-range dropdown options. When the
// user picks this entry the toolbar reveals two DateTimePickers and
// the chart `from`/`to` come from those inputs instead of from
// computeChartWindow. Kept as a module constant so the comparison in
// the from/to memo + the dropdown menu use the exact same string —
// no risk of a typo silently breaking the conditional branch.
const CUSTOM_RANGE_LABEL = 'Custom range…';

// Themed sx for the date-time pickers — duplicated from
// sections/wireless-sensors/multi-sensor-graph.jsx (which is the only
// other place these tokens currently live). Two copies of a small
// styling object is cheaper than extracting an underused shared module
// at this point; promote to themes/ if a third pickers-using surface
// lands.
const dateTimePickerPaperSx = {
  backgroundColor: 'rgba(0, 20, 61, 0.94)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e',
  color: 'var(--green)',
  backdropFilter: 'blur(6px)'
};
const dateTimePickerPopperSx = {
  '& .MuiPaper-root': dateTimePickerPaperSx,
  '& .MuiPickersLayout-root': { color: 'var(--blue)' },
  '& .MuiPickersDay-root': {
    color: 'var(--green)',
    borderRadius: 1,
    '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' }
  },
  '& .MuiPickersDay-root.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)'
  },
  '& .MuiDayCalendar-weekDayLabel, & .MuiPickersCalendarHeader-label': {
    color: 'var(--blue)',
    fontWeight: 600
  },
  '& .MuiPickersArrowSwitcher-button, & .MuiPickersCalendarHeader-switchViewButton': {
    color: 'var(--blue)'
  },
  // Action-bar buttons (Cancel / OK) at the bottom of the picker
  // popper. Default MUI styling renders them as plain primary-color
  // text buttons that read foreign against the neon-on-navy popper —
  // restyle to match the project's button vocabulary: blue text +
  // reflected-light hairline border at rest, green text + green
  // border + subtle teal-tinted background on hover.
  // `.MuiPickersLayout-actionBar` is the wrapper MUI x-pickers uses
  // for the action row; targeting its child buttons keeps the
  // selector narrow enough that it doesn't accidentally hit the
  // calendar's day buttons or the arrow-switcher buttons (those have
  // their own classes handled above).
  '& .MuiPickersLayout-actionBar': {
    borderTop: '1px solid var(--reflected-light)',
    px: 1,
    py: 0.75,
    gap: 0.75,
    '& .MuiButton-root': {
      color: 'var(--blue)',
      borderColor: 'var(--reflected-light)',
      border: '1px solid var(--reflected-light)',
      borderRadius: 1,
      textTransform: 'none',
      fontWeight: 600,
      px: 1.5,
      py: 0.35,
      letterSpacing: '0.02em',
      backgroundColor: 'rgba(0, 17, 48, 0.5)',
      transition: 'color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease',
      '&:hover': {
        color: 'var(--green)',
        borderColor: 'var(--green)',
        backgroundColor: 'rgba(72, 247, 245, 0.08)'
      }
    }
  },
  // Picker toolbar — the header at the top of the popper that shows
  // the currently-selected date/time in large type. MUI defaults to
  // theme-primary text on the surface color; we recolor to the
  // green-on-blue vocabulary the rest of the popper uses so the
  // header reads as "selected value" instead of a separate widget.
  '& .MuiPickersToolbar-root, & .MuiDateTimePickerToolbar-root': {
    color: 'var(--green)',
    backgroundColor: 'transparent',
    borderBottom: '1px solid var(--reflected-light)'
  },
  '& .MuiPickersToolbarText-root': {
    color: 'var(--blue)'
  },
  '& .MuiPickersToolbarText-root.Mui-selected': {
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
  },
  // View tabs (Date / Time switcher rendered by DateTimePicker). MUI
  // ships them as MUI Tabs which default to primary-color text +
  // primary-color indicator under the active tab — restyled to blue
  // at rest, green when active, with a matching green indicator bar.
  '& .MuiTabs-root': {
    borderBottom: '1px solid var(--reflected-light)',
    minHeight: 36,
    '& .MuiTab-root': {
      color: 'var(--blue)',
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.02em',
      minHeight: 36,
      '&.Mui-selected': {
        color: 'var(--green)',
        textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
      }
    },
    '& .MuiTabs-indicator': {
      backgroundColor: 'var(--green)'
    }
  },
  // Time selection — the scrollable hour / minute / AM-PM columns
  // (MultiSectionDigitalClock, MUI's default for DateTimePicker).
  // Each column is a vertical list of items; the selected item is
  // marked with .Mui-selected. Restyled to match the calendar's
  // day-cell vocabulary so the time view reads as part of the same
  // popper, not a foreign widget.
  '& .MuiMultiSectionDigitalClockSection-root': {
    // Themed scrollbar matches the other scrollable surfaces in the
    // project (FleetOverviewView's scroll container uses the same
    // recipe). Without this the scroll thumb defaults to the
    // browser's chrome which clashes with the dark popper.
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
    '&::-webkit-scrollbar': { width: '6px' },
    '&::-webkit-scrollbar-track': { background: 'transparent' },
    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 68, 143, 0.6)', borderRadius: '3px' }
  },
  '& .MuiMultiSectionDigitalClockSection-item': {
    color: 'var(--green)',
    borderRadius: 1,
    fontWeight: 500,
    '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' }
  },
  '& .MuiMultiSectionDigitalClockSection-item.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.28)'
    }
  },
  // Single-column DigitalClock fallback — used when a picker is
  // configured to show only times in one list. Same color recipe so
  // either layout looks at-home in the popper.
  '& .MuiDigitalClock-item': {
    color: 'var(--green)',
    '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' }
  },
  '& .MuiDigitalClock-item.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
  },
  // Year picker view — appears when the user clicks the calendar
  // header's year/month switcher chevron. MUI X v8 renders a
  // scrollable grid of year buttons; default styling leaves them in
  // the theme primary color which reads foreign against the
  // neon-on-navy popper. Full coverage below: idle, hover, selected,
  // selected+hover, disabled (out of min/max range), and a themed
  // thin scrollbar for the grid itself (it scrolls when the year
  // span is large).
  //
  // IMPORTANT: class names are v8-specific. The earlier v6/v7
  // selectors (`.MuiPickersYear-yearButton`, `.MuiPickersMonth-monthButton`)
  // don't exist in v8 — verified against
  // node_modules/@mui/x-date-pickers/YearCalendar/yearCalendarClasses.js
  // which generates classes under `MuiYearCalendar-*`. The matching
  // month classes live under `MuiMonthCalendar-*`. State suffixes
  // are wired both as the local class (`MuiYearCalendar-selected`,
  // `MuiYearCalendar-disabled`) AND the global `Mui-selected` /
  // `Mui-disabled` — target both so the rule wins regardless of
  // which one MUI applies on a given render.
  '& .MuiYearCalendar-root': {
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0, 68, 143, 0.6) transparent',
    '&::-webkit-scrollbar': { width: '6px' },
    '&::-webkit-scrollbar-track': { background: 'transparent' },
    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 68, 143, 0.6)', borderRadius: '3px' }
  },
  '& .MuiYearCalendar-button': {
    color: 'var(--green)',
    fontWeight: 500,
    borderRadius: 1,
    transition: 'color 0.18s ease, background-color 0.18s ease',
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)',
      color: 'var(--green)'
    }
  },
  '& .MuiYearCalendar-button.Mui-selected, & .MuiYearCalendar-button.MuiYearCalendar-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    fontWeight: 700,
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.28)'
    }
  },
  '& .MuiYearCalendar-button.Mui-disabled, & .MuiYearCalendar-button.MuiYearCalendar-disabled': {
    color: 'var(--blue)',
    opacity: 0.35
  },
  // Month picker view — parallel recipe with v8's MuiMonthCalendar-*
  // class set.
  '& .MuiMonthCalendar-button': {
    color: 'var(--green)',
    fontWeight: 500,
    borderRadius: 1,
    transition: 'color 0.18s ease, background-color 0.18s ease',
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.12)',
      color: 'var(--green)'
    }
  },
  '& .MuiMonthCalendar-button.Mui-selected, & .MuiMonthCalendar-button.MuiMonthCalendar-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    fontWeight: 700,
    '&:hover, &:focus': {
      backgroundColor: 'rgba(72, 247, 245, 0.28)'
    }
  },
  '& .MuiMonthCalendar-button.Mui-disabled, & .MuiMonthCalendar-button.MuiMonthCalendar-disabled': {
    color: 'var(--blue)',
    opacity: 0.35
  }
};
const dateTimePickerTextFieldSx = {
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    ...neonControlSx,
    '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': { border: 'none' },
    '&:hover:not(.Mui-disabled)': { borderColor: 'var(--green)' },
    '&.Mui-focused': { borderColor: 'var(--blue)' }
  },
  '& .MuiInputBase-input': {
    color: 'var(--green) !important',
    WebkitTextFillColor: 'var(--green) !important',
    textAlign: 'center',
    '&::placeholder': { color: 'var(--green)', opacity: 1 }
  },
  '& .MuiPickersInputBase-root, & .MuiPickersSectionList-root, & .MuiPickersSectionList-sectionContent, & .MuiPickersSectionList-section': {
    color: 'var(--green) !important',
    WebkitTextFillColor: 'var(--green) !important'
  },
  '& .MuiPickersSectionList-section.Mui-selected': {
    color: 'var(--green) !important',
    backgroundColor: 'rgba(72, 247, 245, 0.2)'
  },
  '& [data-placeholder="true"]': { color: 'var(--green) !important', opacity: 1 },
  '& .MuiSvgIcon-root': { color: 'var(--blue)' }
};

// =============================================================================
// CSV download — backend-generated.
// =============================================================================
//
// The Download button on this page calls the backend's
// `POST /devices/{id}/sensor-data/{from}/{to}` endpoint
// (services/mutations.js → downloadDeviceSensorData). The backend pulls
// the user's saved data_download_preferences (decimal places, timezone,
// blank/zero handling, etc.) from the DB and applies them to the CSV
// before responding — so the file the user gets matches the formatting
// they configured, NOT the on-screen unit conversion done by the chart
// configs. Those are intentionally separate prefs buckets:
//
//   ui_preferences            → drives chart + card display (frontend)
//   data_download_preferences → drives export formatting (backend)
//
// History: an earlier version of this file built the CSV client-side
// from the chart configs. That mixed the two preference scopes and
// skipped server-side features (error/blank/zero handling, decimal-
// places). Replaced with the backend call so the export is consistent
// with the dedicated Data Downloads page and any API consumer.

/**
 * Convert one date to a slug like "2026-03-15" — safe for filenames on
 * every OS. ISO `toISOString()` produces "2026-03-15T14:23:00.000Z" so
 * we lift the YYYY-MM-DD prefix.
 *
 * Still used client-side to construct the suggested Save As name —
 * the backend's `phenode_sensor_data.csv` is generic, and a user with
 * three devices ends up with three same-named downloads otherwise.
 */
function dateToFilenameSlug(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10);
}

/**
 * Sanitize a device label for use in a filename. Replaces any sequence
 * of characters that aren't a-z, A-Z, 0-9, dash, or underscore with a
 * single dash. Falls back to "phenode" when the label is empty.
 */
function deviceLabelToFilenameSlug(label) {
  const trimmed = (label ?? '').trim();
  if (!trimmed) return 'phenode';
  return trimmed.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'phenode';
}

/**
 * Pull the extension off whatever filename the backend suggested
 * (Content-Disposition). The device endpoint returns
 * `phenode_sensor_data.csv` when the device has no linked wireless
 * sensors and `phenode_sensor_data.zip` when it does — we preserve
 * that distinction in the Save As name so the file opens with the
 * right app.
 */
function extensionFromBackendFilename(filename) {
  const m = filename ? /\.([a-z0-9]+)$/i.exec(filename) : null;
  return m ? m[1].toLowerCase() : 'csv';
}

// Conversion helpers used by the chart-config factory below.
const FAHRENHEIT_RATIO = 9 / 5;
const identity = (v) => v;
const cToF = (celsius) => celsius * FAHRENHEIT_RATIO + 32;
const msToMph = (ms) => ms * 2.2369362921;
const msToKmh = (ms) => ms * 3.6;
const mmToIn = (mm) => mm * 0.0393700787;
const kpaToHpa = (kpa) => kpa * 10;
const mvToV = (mv) => mv / 1000;

// Field key list passed to the SWR hook as the `fields` projection.
// The fieldKey set never changes with user preferences (we always need
// the same raw columns from the API; only the display conversion + unit
// label vary), so this stays a module constant.
const DEVICE_CHART_FIELDS = ['temperature', 'humidity', 'pressure', 'wind_speed', 'rainfall', 'battery_voltage'];

// Per-chart configuration factory for the device-level chart panel.
// One entry in the returned array = one rendered chart card. The
// factory takes the current display-preferences object so each chart's
// `unit` label and `transform` track the user's saved units.
//
// Schema:
//   key:    Field name on the response row (matches the canonical
//           list in services/downloads.py _DEVICE_FIELD_EXTRACTORS).
//   title:  Header text shown above the chart.
//   color:  Stroke + area-fill color, picked from the existing
//           sensor-measurements palette for visual continuity.
//   unit:   Unit suffix appended to Y-axis tick labels and tooltip
//           values — comes from displayPrefs.
//   transform: Value transform applied per point — also from
//              displayPrefs.
//
// Why six charts (not the seven the original mock had):
//   The dropped mock charts (Soil Temperature, Electrical Conductivity,
//   Soil Moisture, LUX) are all wireless-sensor metrics, not device-
//   level metrics. They live on the wireless-sensor page now.
//
// Canonical backend units (per services/downloads.py and the chart
// endpoint comments):
//   temperature        → °C
//   pressure           → kPa
//   wind_speed         → m/s
//   rainfall           → mm
//   battery_voltage    → mV
//   humidity           → % (no unit pref applies)
function buildDeviceChartConfigs(displayPrefs) {
  const tempUnit = displayPrefs?.tempUnit ?? 'F';
  const speedUnit = displayPrefs?.speedUnit ?? 'ms';
  const pressureUnit = displayPrefs?.pressureUnit ?? 'kpa';
  const rainUnit = displayPrefs?.rainUnit ?? 'mm';
  const voltageUnit = displayPrefs?.voltageUnit ?? 'mv';

  // Temperature: backend ships °C. Default 'F' converts; 'C' is identity.
  const tempTransform = tempUnit === 'C' ? identity : cToF;
  const tempLabel = tempUnit === 'C' ? '°C' : '°F';

  // Wind: backend ships m/s. 'mph' / 'kmh' / 'ms'.
  const speedTransform = speedUnit === 'mph' ? msToMph : speedUnit === 'kmh' ? msToKmh : identity;
  const speedLabel = speedUnit === 'mph' ? 'mph' : speedUnit === 'kmh' ? 'km/h' : 'm/s';

  // Pressure: backend ships kPa. 'kpa' identity; 'hpa' x10.
  const pressureTransform = pressureUnit === 'hpa' ? kpaToHpa : identity;
  const pressureLabel = pressureUnit === 'hpa' ? 'hPa' : 'kPa';

  // Rainfall: backend ships mm. 'mm' identity; 'in' converts.
  const rainTransform = rainUnit === 'in' ? mmToIn : identity;
  const rainLabel = rainUnit === 'in' ? 'in' : 'mm';

  // Battery voltage: backend ships mV. 'mv' identity; 'v' / 1000.
  const voltageTransform = voltageUnit === 'v' ? mvToV : identity;
  const voltageLabel = voltageUnit === 'v' ? 'V' : 'mV';

  return [
    {
      key: 'temperature',
      title: 'Temperature',
      color: '#48f7f5',
      unit: tempLabel,
      transform: tempTransform
    },
    {
      key: 'humidity',
      title: 'Humidity',
      color: '#c96cfc',
      unit: '%'
    },
    {
      key: 'pressure',
      title: 'Atmospheric Pressure',
      color: '#f47568',
      unit: pressureLabel,
      transform: pressureTransform
    },
    {
      key: 'wind_speed',
      title: 'Wind Speed',
      color: '#f4d04b',
      unit: speedLabel,
      transform: speedTransform
    },
    {
      key: 'rainfall',
      title: 'Rainfall',
      color: '#0043c2',
      unit: rainLabel,
      transform: rainTransform
    },
    {
      key: 'battery_voltage',
      title: 'Battery Voltage',
      color: '#8539e0',
      unit: voltageLabel,
      transform: voltageTransform
    }
  ];
}

// Hoisted chart sx — was being recreated 7 times per render at the
// previous call site (every chart re-created the whole object literal).
// Now it's one stable reference shared across all charts. The line-
// stroke color is interpolated per-chart via a CSS variable set on
// the wrapper Box, so this object is fully chart-agnostic.
const chartSx = {
  width: '100%',
  overflow: 'visible',
  '& .MuiChartsSurface-root': {
    overflow: 'visible'
  },
  '& .MuiChartsGrid-line': {
    stroke: 'var(--blue)',
    strokeOpacity: 0.38,
    strokeWidth: 0.65
  },
  '& .MuiLineElement-root': {
    strokeWidth: 0.95,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    // Reference a STATIC SVG <filter> by id rather than computing
    // `drop-shadow(...)` per element. The filter defs live in
    // <ChartGlowDefs/>, mounted once at the top of this page's
    // tree. Two reasons for this approach:
    //
    //   1. drop-shadow on every line stroke triggers a separate
    //      raster pass per element. A static <filter> in <defs> is
    //      compiled once and reused, which lets the browser
    //      amortize the cost across every reference.
    //   2. The wrapper Box sets `--chart-glow-filter` based on the
    //      current point count (full glow ≤500 points; lite glow
    //      above that — see useLiteGlow in the panel below). The
    //      CSS variable indirection means the same chartSx rule
    //      serves both cases without JS branching.
    //
    // Both this surface AND the wireless-sensor chart surfaces
    // (sensor-network, MeasurementsChartGrid) use the same filter
    // ids — the two pages render visually identical glow.
    filter: 'var(--chart-glow-filter, url(#chart-glow-full))'
  },
  '& .MuiAreaElement-root': {
    fillOpacity: 0.16
  },
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
    stroke: 'rgba(232, 232, 232, 0.45)'
  },
  '& .MuiChartsAxis-tickLabel': {
    fill: 'var(--green)',
    fontWeight: 600
  },
  '& .MuiChartsAxis-left .MuiChartsAxis-line, & .MuiChartsAxis-bottom .MuiChartsAxis-line': {
    stroke: 'rgba(232, 232, 232, 0.55)'
  },
  // Hover indicator (the dashed vertical line that follows the cursor).
  // MUI's default is black on light themes / white on dark — neither
  // matches the chart line color. Pulling it from the per-chart CSS
  // variable means each chart's indicator picks up its own line color
  // automatically. !important is required because the styled component
  // ships its stroke as a styled-component-level rule.
  '& .MuiChartsAxisHighlight-root': {
    stroke: 'var(--chart-line-color) !important',
    strokeOpacity: 0.75,
    strokeWidth: 1.25
  },
  background: 'transparent',
  borderRadius: 1
};

// Y-axis tick label formatter. Compacts large values (1500 → "1.5k")
// and appends the chart's unit suffix. Defined once at module scope
// so it doesn't get re-created per chart, per render. Curried (returns
// a function bound to the unit) because MUI x-charts' valueFormatter
// API takes a single-arg callback.
const makeYAxisFormatter = (unit) => (value) => {
  if (value === null || value === undefined) return '';
  const compact = Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
  return unit ? `${compact} ${unit}` : compact;
};

// =============================================================================
// MeasurementChart — memoized LineChart wrapper.
// =============================================================================
//
// Why this is a separate memo'd component rather than inline JSX in the
// .map() loop:
//
//   The toolbar (selection-loading indicator, hover state, custom date
//   pickers, download disabled state) re-renders frequently while the
//   chart data itself is stable. Without React.memo, every toolbar
//   state change cascades into 6 LineChart re-renders — each of which
//   does internal layout, re-measures its SVG, and re-applies its sx
//   tree. MUI x-charts has its own memoization but it can't skip work
//   if React keeps handing it new prop references on every parent
//   render.
//
//   Extracting the chart into a memo'd component with PRIMITIVE props
//   (not object literals) means React.memo's default shallowEqual
//   compare actually catches "nothing changed for this chart" and
//   short-circuits the whole subtree. The toolbar can fidget all it
//   wants and the charts don't redraw.
//
// All props are designed to be stable across renders unless the data
// actually changed:
//
//   - config: comes from chartConfigs (computed in this component via
//             buildDeviceChartConfigs(displayPrefs)),
//     same reference every render.
//   - seriesTimes / seriesData: from useMemo(chartSeriesByField), same
//     reference until measurementRows changes.
//   - xAxisMin / xAxisMax: derived from a memoized array's elements,
//     so Date references are stable too.
//   - xAxisTicks: useMemo'd.
//   - axisFormat: memoized.
//   - primitives are trivially stable.
//
// The "No data" empty-state lives at the PARENT level rather than
// inside this component because the grid version and the enlarged-
// Dialog version want different "empty" styling (compact flex:1 vs
// fixed minHeight). Pushing the styling decision back to the caller
// keeps this component focused on one job: render a chart.
//
// `idSuffix` is appended to every LineChart axis/series id so the
// grid version and the enlarged-Dialog version never collide. MUI
// x-charts uses ids internally for cross-references between axes
// and series — two charts with the same id in the same DOM produce
// subtle render glitches.
const MeasurementChart = memo(function MeasurementChart({
  config,
  seriesTimes,
  seriesData,
  xAxisMin,
  xAxisMax,
  xAxisTicks,
  axisFormat,
  height,
  yAxisWidth,
  xAxisFontSize,
  yAxisFontSize,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  idSuffix
}) {
  // Y-axis padding — 4% of the range, with a 0.1 floor so a flat
  // series (every value identical) still renders a visible band
  // rather than collapsing the line into the axis. Calculation
  // happens inside the memo so the parent doesn't need to pass min
  // / max / pad through as separate props.
  const minVal = Math.min(...seriesData);
  const maxVal = Math.max(...seriesData);
  const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

  return (
    <LineChart
      xAxis={[
        {
          // Time-scale axis — was 'point' (categorical) in the
          // mock-data version, which meant evenly-spaced ticks
          // regardless of actual timestamp gaps. 'time' draws ticks
          // against real wall-clock positions, so a 6h data gap reads
          // as a 6h gap visually.
          id: `${config.key}-x${idSuffix}`,
          scaleType: 'time',
          data: seriesTimes,
          tickNumber: axisTickNumberFor(axisFormat),
          tickInterval: xAxisTicks,
          min: xAxisMin,
          max: xAxisMax,
          domainLimit: 'strict',
          tickLabelStyle: { fontSize: xAxisFontSize, fill: 'var(--green)' },
          valueFormatter: (value, context) =>
            context?.location === 'tooltip' ? formatTooltipDate(value) : formatAxisTick(value, axisFormat)
        }
      ]}
      yAxis={[
        {
          id: `${config.key}-y${idSuffix}`,
          min: minVal - pad,
          max: maxVal + pad,
          width: yAxisWidth,
          tickLabelStyle: { fontSize: yAxisFontSize, fill: 'var(--green)' },
          valueFormatter: makeYAxisFormatter(config.unit)
        }
      ]}
      series={[
        {
          id: `${config.key}-line${idSuffix}`,
          data: seriesData,
          color: config.color,
          area: true,
          showMark: false,
          curve: 'linear',
          valueFormatter: (value) =>
            value === null || value === undefined
              ? 'No data'
              : `${Number(value).toFixed(2)}${config.unit ? ` ${config.unit}` : ''}`
        }
      ]}
      grid={{ horizontal: true, vertical: true }}
      height={height}
      margin={{ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }}
      hideLegend
      sx={chartSx}
    />
  );
});

// Build the three "current value" circles from a single DeviceRead. The
// values use the same formatters the fleet-overview cards use, so the
// number the user clicked on the fleet card visually matches the number
// they land on here. Humidity (circle 1 sub-label), Gust (circle 3
// sub-label) and Wind direction (circle 3 caption) aren't on the
// DeviceRead schema yet — they render as "N/A" / "—" placeholders for
// now; the moment those land in the backend the read-throughs below
// flip to live values without any other change.
//
// `device` may be null/undefined while the hook is still loading or the
// fleet is empty — each formatter returns "N/A" for missing inputs,
// so we don't need additional guards here.
// `displayPrefs` is the memoized object from useDisplayPreferences().
// The function is pure — same inputs, same output — so it stays at
// module scope. The component-side useMemo includes displayPrefs in
// its deps so a unit change re-derives this array.
function buildCircleMetrics(device, displayPrefs) {
  const tempUnit = displayPrefs?.tempUnit ?? 'F';
  const speedUnit = displayPrefs?.speedUnit ?? 'ms';
  const rainUnit = displayPrefs?.rainUnit ?? 'mm';
  return [
    {
      id: 'metric-1',
      icon: tempSensorIcon,
      iconAlt: 'Temperature sensor icon',
      value: formatTemperature(device?.temperature_c, tempUnit),
      label: 'Current Air Temperature',
      gustLabel: 'Humidity:',
      // Humidity isn't on the DeviceRead schema (see services/schemas/
      // device.js); placeholder until backend lands the field.
      gustValue: 'N/A'
    },
    {
      id: 'metric-2',
      icon: rainSensorIcon,
      iconAlt: 'Rain sensor icon',
      value: formatTodaysRainfall(device?.rainfall_today_mm, rainUnit),
      label: "Today's Rainfall"
    },
    {
      id: 'metric-3',
      icon: windSensorIcon,
      iconAlt: 'Wind sensor icon',
      // Wind direction isn't on DeviceRead yet — em-dash placeholder
      // reads as "value unavailable" without implying a specific
      // direction. Same forward-compat plan as humidity above.
      direction: '—',
      value: formatWindSpeed(device?.wind_speed, speedUnit),
      label: 'Current Windspeed',
      gustLabel: 'Gust:',
      gustValue: 'N/A'
    }
  ];
}

export default function SensorMeasurements() {
  // URL search params drive the state shape: ?device=, ?range=, ?view=.
  // Keeping the URL as the single source of truth makes every meaningful
  // state shareable, refresh-survivable, and (importantly for our
  // Lighthouse coverage) deep-linkable from the audit script. The
  // custom-range pickers stay in local state — they're transient
  // mid-input scratch values, not the kind of thing you'd bookmark.
  const [searchParams, setSearchParams] = useSearchParams();
  const deviceFromUrl = searchParams.get(DEVICE_PARAM);
  const rangeFromUrl = searchParams.get(RANGE_PARAM);
  const viewFromUrl = searchParams.get(VIEW_PARAM);

  // Resolve `timeRange` from the URL with a defensive fallback:
  //   - `?range=Last 24 hours` → match against the preset table → use it.
  //   - `?range=Custom range…` → keep as-is so the pickers render.
  //   - `?range=<garbage>` or missing → fall back to DEFAULT_CHART_TIME_RANGE.
  // The fallback path means a hand-typed URL with a stale or typo'd
  // range value won't break the page; it just opens to the default.
  const timeRange = useMemo(() => {
    if (!rangeFromUrl) return DEFAULT_CHART_TIME_RANGE;
    if (rangeFromUrl === CUSTOM_RANGE_LABEL) return CUSTOM_RANGE_LABEL;
    if (findChartTimeRange(rangeFromUrl)) return rangeFromUrl;
    return DEFAULT_CHART_TIME_RANGE;
  }, [rangeFromUrl]);

  // Helper for writing the range to the URL. Used by the Select's
  // onChange below. Identical pattern to handlePhenodeChange — we
  // delete the param when the user picks the default so the URL stays
  // clean for the most common state.
  const setTimeRange = useCallback(
    (nextRange) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextRange && nextRange !== DEFAULT_CHART_TIME_RANGE) {
          next.set(RANGE_PARAM, nextRange);
        } else {
          next.delete(RANGE_PARAM);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const [chartLayout, setChartLayout] = useState('row');

  // Custom-range pickers — only consulted when `timeRange` equals the
  // CUSTOM_RANGE_LABEL sentinel. dayjs values (or null) because that's
  // what MUI's DateTimePicker emits via its onChange. The from/to memo
  // below converts them to Date instances for the SWR hook.
  const [customFromTime, setCustomFromTime] = useState(null);
  const [customToTime, setCustomToTime] = useState(null);
  const isCustomRange = timeRange === CUSTOM_RANGE_LABEL;

  // Compute [from, to] for the chart hook. Why useMemo with `timeRange`
  // as the only dep:
  //
  //   `to = new Date()` reads wall-clock time — if we computed it on
  //   every render, the URL would tick every render and break SWR
  //   dedup. The hook itself floors `from`/`to` to the nearest minute
  //   before they enter the SWR key, so even a re-computed `to`
  //   collapses to the same key as long as the page is rendered
  //   within the same minute. But we still avoid recomputing every
  //   render here for the sake of cheap referential stability.
  //
  //   `axisFormat` rides along in the same memo because it's a
  //   property of the same range selection — fewer hooks, simpler.
  // Resolve the active [from, to] window. Three branches:
  //
  //   1. Custom range mode WITH both pickers filled and ordered → use
  //      the picker values verbatim. axisFormat derived from the span
  //      so the X-axis ticks pick the right granularity.
  //   2. Custom range mode WITHOUT a valid pair (one empty, or to
  //      before from) → fall back to the DEFAULT preset's window so
  //      the chart still has data to show while the user is mid-
  //      input. Avoids a "blank chart while typing" experience.
  //   3. Preset range → original computeChartWindow path.
  //
  // The from/to are Date instances regardless of branch so the SWR
  // hook (which floors them to the nearest minute for its URL key)
  // doesn't have to know which mode produced them.
  const { from, to, axisFormat } = useMemo(() => {
    if (isCustomRange && customFromTime && customToTime) {
      const fromDate = customFromTime.toDate();
      const toDate = customToTime.toDate();
      if (fromDate < toDate) {
        return { from: fromDate, to: toDate, axisFormat: pickAxisFormatForRange(fromDate, toDate) };
      }
    }
    const label = isCustomRange ? DEFAULT_CHART_TIME_RANGE : timeRange;
    return computeChartWindow(label);
  }, [isCustomRange, timeRange, customFromTime, customToTime]);

  // Explicit X-axis tick positions for ranges that need them — currently
  // MONTH only (Last 6 months / 1 year / 2 years / 5 years), where MUI's
  // auto-placement would propose ticks at sub-month resolution and the
  // MMM-YY format would render duplicate labels (e.g. "Mar 26 / Mar 26 /
  // Apr 26 / Apr 26"). For other formats this returns undefined, and
  // MUI's auto-placement + axisTickNumberFor hint handles them fine.
  // Memoized on [from, to, axisFormat] so SWR refreshes don't keep
  // recomputing the array.
  const xAxisTicks = useMemo(() => computeAxisTicks(from, to, axisFormat), [from, to, axisFormat]);

  // Map-view toggle — mirrors the same pattern used in
  // sections/wireless-sensors/sensor-network.jsx so the affordance
  // reads the same on both pages. When true, the circles + chart panel
  // are replaced by PheNodeFleetMap — a Google Maps view of the fleet
  // plotted by each device's lat/lng. (The wireless-sensors page
  // currently renders its own placeholder map; upgrading it to Google
  // Maps is a separate follow-up PR — see plan notes.)
  //
  // The hover state is tracked separately so the icon can swap between
  // its active / inactive variants on pointer + focus — matches the
  // hover-swap behavior on the sensor-network map button.
  // Map-view derived from the URL (?view=map). Writing it back through
  // the same setSearchParams hook the dropdown uses keeps state shape
  // consistent and lets the audit script (or a shared bookmark) deep-
  // link directly into the map state without a puppeteer click step.
  const isMapView = viewFromUrl === VIEW_PARAM_MAP_VALUE;
  const setIsMapView = useCallback(
    (nextMapViewValue) => {
      // Accept the same setter shapes useState does — a boolean OR a
      // functional updater `(prev) => next` — so the existing onClick
      // pattern (`setIsMapView((prev) => !prev)`) continues to work
      // without per-call-site changes.
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const wasMap = prev.get(VIEW_PARAM) === VIEW_PARAM_MAP_VALUE;
        const resolved = typeof nextMapViewValue === 'function' ? nextMapViewValue(wasMap) : nextMapViewValue;
        if (resolved) {
          next.set(VIEW_PARAM, VIEW_PARAM_MAP_VALUE);
        } else {
          next.delete(VIEW_PARAM);
        }
        return next;
      });
    },
    [setSearchParams]
  );
  const [isMapToggleHovered, setIsMapToggleHovered] = useState(false);

  // Icon variant for the map toggle button. Four visual states organized
  // around two axes (which view is open × pointer/focus hover):
  //
  //   NOT in map view:
  //     - hovered    → mapIconActive    (tinted map icon)
  //     - resting    → mapIconInactive  (quiet map icon)
  //   IN map view:
  //     - hovered    → phenodeFleetIconActive   (tinted "go back to fleet" icon)
  //     - resting    → phenodeFleetIcon         (quiet "go back to fleet" icon)
  //
  // The button never stays in a permanently-active state. When the
  // user opens the map, the icon flips to the PheNode_Fleet glyph in
  // its inactive variant — communicating "the next click goes back to
  // the fleet measurements view" — and only highlights on hover. This
  // matches the affordance pattern used in sensor-network.jsx where
  // the icon always represents the *destination* of the next click,
  // not the *current* state of the toggle.
  const mapToggleIcon = isMapView
    ? isMapToggleHovered
      ? phenodeFleetIconActive
      : phenodeFleetIcon
    : isMapToggleHovered
      ? mapIconActive
      : mapIconInactive;
  const mapToggleTooltip = isMapView ? 'Sensor Measurements' : 'Map View';

  // (searchParams + deviceFromUrl + rangeFromUrl + viewFromUrl already
  // resolved at the top of the component — see the URL-state block.
  // Keeping them at the top means timeRange/isMapView are derived
  // before any consumers run, which avoids ordering bugs from a stale
  // useMemo dep.)

  const { devices, isLoading: devicesLoading, mutate: mutateDevices } = useMyDevices();
  const { accessToken } = useAuth();

  // Rename handler — mirrors fleet-overview.jsx's pattern. PUTs the new
  // label, then revalidates useMyDevices so the new name appears on the
  // info card (and anywhere else the device list is rendered) without
  // waiting for the next SWR refresh interval. Errors propagate to the
  // map's confirmation modal, which surfaces them in the toast and keeps
  // the modal open for retry.
  const handleRename = useCallback(
    async (externalId, newLabel) => {
      await renameDevice(externalId, newLabel, accessToken);
      mutateDevices();
    },
    [accessToken, mutateDevices]
  );

  // Toast hook is used by handleDownload below; declared up here next
  // to the other hooks so React's hook-order invariant is obvious at
  // a glance. The download handler itself has to live further down,
  // after `activeDevice` is declared — see the comment by handleDownload.
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  // Most-recently-reporting PheNode — used as the fallback selection
  // when the URL doesn't carry a device id (e.g. the user navigated
  // here directly via the sidebar rather than clicking a fleet card).
  //
  // -Infinity fallback for devices that have never reported keeps
  // them from incorrectly "winning" the recency race against a peer
  // with a real last_measurement_at. Mirrors the same sort comparator
  // used in sensor-fleet-overview.jsx and FleetOverviewView's default
  // recency sort, so the "default device" surfaced here is the same
  // one that sits at the top of the fleet list.
  const defaultPhenodeId = useMemo(() => {
    if (!devices?.length) return null;
    const byRecency = [...devices].sort((a, b) => {
      const aTime = a.last_measurement_at ? new Date(a.last_measurement_at).getTime() : -Infinity;
      const bTime = b.last_measurement_at ? new Date(b.last_measurement_at).getTime() : -Infinity;
      return bTime - aTime;
    });
    return byRecency[0]?.external_device_id ?? null;
  }, [devices]);

  // FROZEN copy of the recency default — captured exactly once on the
  // first non-null evaluation, then held stable for the rest of the
  // page visit. Without this, every 60s SWR poll could shift
  // `activeDeviceId` (and therefore the whole page's selection,
  // including the map's selected pin and the chart panel's device
  // data) to whatever device just became most-recently-reporting —
  // yanking the user's view out from under them mid-look.
  //
  // The freeze persists only as long as the component is mounted —
  // when the user navigates away and back, the component unmounts and
  // remounts, state resets, and the next visit captures whichever
  // device is most-recent at that moment. Matches the requested
  // behavior: "only update to the most-recent when the user leaves
  // the page."
  //
  // URL deep-link (deviceFromUrl) still wins over the frozen default
  // — the freeze is only the fallback when no URL is present.
  const [frozenDefaultPhenodeId, setFrozenDefaultPhenodeId] = useState(null);
  useEffect(() => {
    if (defaultPhenodeId && !frozenDefaultPhenodeId) {
      setFrozenDefaultPhenodeId(defaultPhenodeId);
    }
  }, [defaultPhenodeId, frozenDefaultPhenodeId]);

  // Resolve the active device id, preferring the URL value but falling
  // back to the FROZEN recency-default (not the live one — see the
  // frozenDefaultPhenodeId comment above). We tolerate a URL value
  // that no longer matches any device (e.g. the user deep-linked an
  // external_id that's since been removed) by treating the unmatched
  // case the same as "no URL value" and falling through to the
  // frozen default.
  const activeDeviceId = useMemo(() => {
    if (deviceFromUrl) {
      const exists = devices?.some((d) => d.external_device_id === deviceFromUrl);
      if (exists) return deviceFromUrl;
    }
    return frozenDefaultPhenodeId;
  }, [deviceFromUrl, devices, frozenDefaultPhenodeId]);

  // If the URL referenced a device that no longer exists in the fleet,
  // clean the param out of the URL so back/forward + reload don't keep
  // pointing at a phantom selection. We only clear the param — other
  // unrelated params (e.g. future filters) stay in place.
  //
  // Guard against running during the initial loading window when
  // devices is still undefined; the "doesn't exist" check would
  // spuriously fire and wipe a perfectly valid deep link.
  useEffect(() => {
    if (!devices) return;
    if (!deviceFromUrl) return;
    const exists = devices.some((d) => d.external_device_id === deviceFromUrl);
    if (!exists) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(DEVICE_PARAM);
          return next;
        },
        { replace: true }
      );
    }
  }, [devices, deviceFromUrl, setSearchParams]);

  // Find the active DeviceRead for the resolved id. Null while the
  // hook is still loading — buildCircleMetrics handles that case by
  // rendering "N/A" in each circle.
  const activeDevice = useMemo(() => {
    if (!devices || !activeDeviceId) return null;
    return devices.find((d) => d.external_device_id === activeDeviceId) ?? null;
  }, [devices, activeDeviceId]);

  // PheNode dropdown change → write to URL. We don't mirror this into
  // local state because the URL is already the source of truth — the
  // next render reads the new value back out of searchParams.
  //
  // replace:false (default) so the dropdown action is a real history
  // entry. Back button takes the user to the previously-selected device.
  const handlePhenodeChange = useCallback(
    (nextDeviceId) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextDeviceId) {
          next.set(DEVICE_PARAM, nextDeviceId);
        } else {
          next.delete(DEVICE_PARAM);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  // The three circles' content is fully derived from the active
  // device + the user's display-unit preferences. useMemo so the array
  // reference is stable across renders when neither input has changed
  // — prevents the .map() below from remounting <Box> children
  // unnecessarily. `displayPrefs` is memoized inside the hook so a
  // re-render of this parent without a preference change doesn't
  // bust the memo.
  const displayPrefs = useDisplayPreferences();

  // Device chart configs derived from preferences. A unit-pref change
  // flips displayPrefs, this useMemo recomputes, and every consumer
  // (the chart renderer, the enlarged-chart lookup, the CSV export)
  // sees the new transforms + unit labels in lockstep.
  const chartConfigs = useMemo(() => buildDeviceChartConfigs(displayPrefs), [displayPrefs]);

  const circleMetrics = useMemo(
    () => buildCircleMetrics(activeDevice, displayPrefs),
    [activeDevice, displayPrefs]
  );

  // Formatted "Last Measurements Taken" string for the page header.
  // Uses the shared transform (returns "Never" for null,
  // "Unknown" for an unparseable string) so this page surfaces the
  // same vocabulary as the fleet cards.
  const lastMeasurementsDisplay = activeDevice ? formatLastMeasurement(activeDevice.last_measurement_at) : '—';

  // ---------------------------------------------------------------------------
  // CSV download — backend POST → Blob → browser save.
  //
  // Has to live below `activeDevice` (declared via useMemo above)
  // because its deps array references it — declaring the useCallback
  // earlier would hit a temporal-dead-zone ReferenceError on first
  // mount. `from`/`to` (declared at the top of the component) and
  // `accessToken` / `toast` / `downloading` (declared above) are all
  // already in scope.
  //
  // The backend reads the user's data_download_preferences from the DB
  // and applies them (decimal places, timezone, blank/zero/hyphen
  // handling) before responding. Response is text/csv when the device
  // has no linked wireless sensors, application/zip when it does — the
  // browser saves the suggested filename for either case (we override
  // it client-side with a per-device-and-range name).
  // ---------------------------------------------------------------------------
  const handleDownload = useCallback(async () => {
    if (!activeDevice || downloading) return;
    setDownloading(true);
    try {
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const { blob, filename } = await downloadDeviceSensorData(
        activeDevice.external_device_id,
        fromIso,
        toIso,
        accessToken
      );
      // Construct a per-device + date-range name, but use whatever
      // extension the backend chose (.csv vs .zip varies).
      const ext = extensionFromBackendFilename(filename);
      const label = deviceLabelToFilenameSlug(activeDevice.label || activeDevice.external_device_id);
      const saveAs = `${label}_${dateToFilenameSlug(from)}_${dateToFilenameSlug(to)}.${ext}`;
      triggerBlobDownload(blob, saveAs);
      toast.success('Download started.');
    } catch (err) {
      // 404 from this endpoint means "no rows in this range" — that
      // happens routinely (user picks a range before any data was
      // captured) and isn't really an error worth scaring the user
      // over. Surface it as a friendlier line.
      if (err?.status === 404) {
        toast.error('No data found in this date range.');
      } else {
        const detail = err?.detail;
        toast.error(detail ? `Couldn't download: ${detail}` : "Couldn't generate the download. Please try again.");
      }
    } finally {
      setDownloading(false);
    }
  }, [activeDevice, from, to, accessToken, downloading, toast]);

  // Live time-series data for the chart panel. `bucket: 'auto'` lets
  // the backend pick the right aggregation level based on the
  // selected time range — short ranges return raw rows, long ranges
  // return min/max/avg bucketed rows. The hook normalizes both into a
  // single `{ time, fields: { <key>: { min, max, avg } } }` shape so
  // the chart code below doesn't have to branch on bucket mode.
  //
  // We pass DEVICE_CHART_FIELDS so the backend's `fields` projection
  // only ships back the columns we'll actually render — saves
  // bandwidth on long ranges where the full column set would multiply
  // the payload.
  //
  // `measurementRows` is undefined while the first fetch is in flight;
  // the chart map() below short-circuits to an empty-state per chart
  // in that case rather than rendering a flat axis.
  //
  // We previously dropped `mutate` (the manual refresh handler) when
  // the refresh button was pulled from the toolbar. `isValidating`
  // is back because we need it to drive the selection-change
  // loading indicator (see the isFetchingSelection state below).
  const {
    rows: measurementRows,
    isLoading: measurementsLoading,
    isValidating: measurementsValidating,
    error: measurementsError
  } = useDeviceMeasurements(activeDeviceId, {
    from,
    to,
    fields: DEVICE_CHART_FIELDS,
    bucket: 'auto'
  });

  // "User just changed the selection" tracker — feeds the toolbar
  // loading indicator without flickering on the 60s SWR background
  // poll.
  //
  // The composite key below captures everything that changes the
  // SWR query: the selected PheNode plus the active from/to window.
  // When the key changes (dropdown pick, time-range change, custom
  // date update), we flip isFetchingSelection on; when the resulting
  // fetch settles (isValidating false), we flip it off. Background
  // polls don't change the key, so the flag never flips and the
  // indicator stays quiet — even though `isValidating` itself
  // toggles every minute.
  //
  // ISO strings via .getTime() so the dep only changes when the
  // floored minute changes, matching what useDeviceMeasurements
  // does internally for its SWR key.
  const selectionKey = useMemo(() => `${activeDeviceId ?? ''}|${from?.getTime() ?? ''}|${to?.getTime() ?? ''}`, [activeDeviceId, from, to]);
  const previousSelectionKeyRef = useRef(selectionKey);
  const [isFetchingSelection, setIsFetchingSelection] = useState(false);
  useEffect(() => {
    if (previousSelectionKeyRef.current !== selectionKey) {
      setIsFetchingSelection(true);
      previousSelectionKeyRef.current = selectionKey;
    }
  }, [selectionKey]);
  useEffect(() => {
    if (isFetchingSelection && !measurementsValidating) {
      setIsFetchingSelection(false);
    }
  }, [isFetchingSelection, measurementsValidating]);

  // The unified indicator flag. True when:
  //   - First fetch in flight for a key with no cached data
  //     (measurementsLoading), OR
  //   - User just changed selection and the resulting fetch is
  //     still in flight (isFetchingSelection)
  // False during background polls on a stable selection.
  const showSelectionLoading = measurementsLoading || isFetchingSelection;

  // Chart-key of the chart currently displayed in the "Enlarge" Dialog,
  // or null when no enlarged view is open. Single piece of state instead
  // of a separate open/closed flag — `null` IS closed, anything else is
  // the enlarged target's config.key from chartConfigs.
  const [enlargedChartKey, setEnlargedChartKey] = useState(null);
  const enlargedChartConfig = enlargedChartKey ? (chartConfigs.find((c) => c.key === enlargedChartKey) ?? null) : null;

  // Pre-compute the X-axis timestamp array once per data refresh.
  // Every chart shares this exact array (same X for every metric of
  // the same device, by definition), so building it once at the
  // panel level rather than inside each chart's render saves both
  // memory allocation and re-render churn.
  const chartTimes = useMemo(() => {
    if (!measurementRows) return [];
    return measurementRows.map((row) => new Date(row.time));
  }, [measurementRows]);

  // Glow intensity selector — picks the chart-stroke filter once at
  // the panel level since point counts move together (all six charts
  // share chartTimes by definition). When the user selects a long
  // time range and the backend's auto-bucketing returns lots of
  // buckets, switch to the lite glow: the full 8px-equivalent blur
  // is visually unnecessary at high line density (the glow on
  // individual segments overlaps with itself) AND it's a measurable
  // paint-cost win. Threshold of 500 points is calibrated to the
  // typical break-even where the glow stops adding perceptible
  // visual richness.
  //
  // The variable name `--chart-glow-filter` is what `chartSx` reads
  // via `filter: var(--chart-glow-filter, url(#chart-glow-full))`.
  // Setting it on the chart wrapper Box scopes the choice per
  // chart-card — although in practice all six pick the same value
  // since they share the data shape.
  const useLiteGlow = chartTimes.length > 500;
  const chartGlowFilterVar = useLiteGlow ? 'url(#chart-glow-lite)' : 'url(#chart-glow-full)';

  // Per-chart series data. Returns an object keyed by field name with
  // a `{ times, values }` pair PER CHART — each chart has its own
  // X-axis timestamps containing ONLY the rows where that specific
  // field actually has a reading. Rows where the field is missing
  // (or its `.avg` is null) are dropped from BOTH the times and
  // values arrays for that chart, not preserved as null gaps.
  //
  // Why per-chart filtering instead of preserving nulls:
  //   The previous implementation aligned every chart to one shared
  //   `chartTimes` array and used `null` in the values array to mark
  //   gaps. MUI x-charts honored those nulls in two visible ways:
  //     (1) The line broke at every null position — a connected
  //         "Last 24 hours" stretch with intermittent missing fields
  //         rendered as dozens of disconnected line segments.
  //     (2) The tooltip's null branch ("No data") fired whenever the
  //         user hovered at one of those null positions.
  //   Per-chart filtering makes the line continuous and ensures the
  //   tooltip only ever resolves to real data points. The shared
  //   chartTimes (above) is still used for the X-axis min/max so all
  //   six charts in the grid stay aligned on the same time range
  //   even when their individual data extents differ.
  //
  // For raw rows the hook collapses min/max/avg to a single value
  // (set all three to the raw value), so reading `.avg` works
  // uniformly. Bucketed rows are likewise rendered against `.avg`
  // for the line — future work could add a translucent min/max
  // envelope using the same row data, but the line alone is the
  // baseline a chart layer always supports.
  const chartSeriesByField = useMemo(() => {
    if (!measurementRows) return {};
    const seriesMap = {};
    for (const config of chartConfigs) {
      const transform = config.transform;
      const times = [];
      const values = [];
      for (const row of measurementRows) {
        const field = row.fields[config.key];
        if (!field) continue;
        const raw = field.avg;
        if (raw === null || raw === undefined) continue;
        times.push(new Date(row.time));
        values.push(transform ? transform(raw) : raw);
      }
      seriesMap[config.key] = { times, values };
    }
    return seriesMap;
    // `chartConfigs` in the deps so a unit-pref change re-derives the
    // values array through the new transforms.
  }, [measurementRows, chartConfigs]);

  return (
    <>
      {/*
        Mount the shared SVG <filter> defs once at the top of the
        tree. Provides the chart-glow-full / chart-glow-lite ids that
        chartSx references via `filter: url(#chart-glow-full)`. See
        components/ChartGlowDefs.jsx for filter mechanics.
      */}
      <ChartGlowDefs />
      <MainCard content={false} sx={{ width: '100%', minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
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
              Sensor Measurements
            </Typography>
            <Typography
              variant="subtitle1"
              // Render as a paragraph, not as the default <h6> MUI
              // attaches to `subtitle1`. This is a status line label,
              // not a section heading — and a page-level h4 ("Sensor
              // Measurements") sits right above it, so an <h6> in this
              // position would cause Lighthouse's heading-order audit
              // to fail (h4 → h6 skips h5). Verified in
              // Lighthouse_Reports/lighthouse-sensor-measurements.json.
              component="p"
              sx={{
                textAlign: { xs: 'left', md: 'right' },
                width: { xs: '100%', md: 'auto' },
                display: { xs: 'flex', md: 'block' },
                alignItems: { xs: 'center', md: 'unset' }
              }}
            >
              <Box component="span" sx={{ color: 'var(--blue)' }}>
                Last Measurements Taken:
              </Box>
              <Box
                component="span"
                sx={{ color: 'var(--green)', ml: { xs: 'auto', md: 1.5 }, display: 'inline-block', textAlign: 'right' }}
              >
                {lastMeasurementsDisplay}
              </Box>
            </Typography>
          </Stack>
        </Box>

        {/*
        Toolbar row mirroring the dropdown + map-button placement used
        on the wireless-sensors page (sections/wireless-sensors/sensor-
        network.jsx). Lives in its own Box with the same px/pt/pb
        spacing the wireless-sensors toolbar uses, so the bare
        Autocomplete + map button sit at the same vertical distance
        below the title divider on both pages.

        Layout:
          - PhenodeSelector on the LEFT (no label — the placeholder
            "Select PheNode..." carries the affordance, and the title
            row above provides the page-level context).
          - Map toggle IconButton on the RIGHT — clicking flips the
            content area between the regular measurements view
            (circles + chart panel) and the PheNodeFleetMap (Google
            Maps view of the fleet).
      */}
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 1.5, sm: 2 } }}>
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: { xs: 1.5, sm: 2 },
              gap: 1
            }}
          >
            <PhenodeSelector
              devices={devices}
              selectedDeviceId={activeDeviceId}
              onChange={handlePhenodeChange}
              isLoading={devicesLoading}
              label={null}
            />

            <Tooltip title={mapToggleTooltip} arrow={false} slotProps={tooltipSlotProps}>
              <IconButton
                aria-label={isMapView ? 'show sensor measurements' : 'show map view'}
                onClick={() => setIsMapView((prev) => !prev)}
                // Hover state on pointer + focus — keyboard navigation
                // gets the same icon swap as a mouse hover would, so the
                // affordance is consistent for keyboard users.
                onMouseEnter={() => setIsMapToggleHovered(true)}
                onMouseLeave={() => setIsMapToggleHovered(false)}
                onFocus={() => setIsMapToggleHovered(true)}
                onBlur={() => setIsMapToggleHovered(false)}
                sx={{
                  border: '1px solid var(--reflected-light)',
                  color: 'var(--blue)',
                  ...drawerNavButtonSurfaceSx,
                  boxShadow: '0 11px 19px 1px #0000002e'
                }}
              >
                {/*
                Image-based icon (not an icon-font glyph) so the SVG's
                own colors render — the active variant is a tinted
                green and the inactive variant is the muted blue,
                matching the same swap used on sensor-network's
                map button.
              */}
                <Box component="img" src={mapToggleIcon} alt="" sx={{ width: 21, height: 21 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/*
        Content area — the UPPER half toggles between the map and the
        circles via isMapView. The chart panel BELOW now renders
        unconditionally (was previously nested inside the non-map
        branch, so it disappeared whenever the user opened the map).
        Mounting the chart panel in both modes preserves the user's
        chart context when they pop the map open — they can scroll
        down to keep comparing values over time without leaving the
        map view.

        The chart panel mounts here on first render and stays mounted
        across map toggles, so MUI x-charts gets a real layout box
        from the start. (Original concern about MUI x-charts measuring
        against a zero-height box only applied to unmount → re-mount
        of the chart inside a hidden branch — not applicable now.)
      */}
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
          {isMapView ? (
            <Suspense
              fallback={
                <Box
                  sx={{
                    minHeight: { xs: 320, md: 420 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--blue)',
                    fontSize: '0.9rem',
                    gap: 1.25
                  }}
                  role="status"
                  aria-live="polite"
                >
                  <CircularProgress size={22} sx={{ color: 'var(--green)' }} />
                  <Box component="span">Loading map…</Box>
                </Box>
              }
            >
              <PheNodeFleetMap
                devices={devices}
                selectedDeviceId={activeDeviceId}
                onSelectDevice={handlePhenodeChange}
                activeDevice={activeDevice}
                onRename={handleRename}
                isLoading={devicesLoading}
              />
            </Suspense>
          ) : (
            <Box
              sx={{
                overflowX: { xs: 'auto', md: 'hidden' },
                pb: 1.25,
                mb: { xs: 2.5, sm: 3 },
                '&::-webkit-scrollbar': {
                  height: '10px'
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0, 68, 143, 0.8)'
                }
              }}
            >
              <Stack direction="row" spacing={2.5} sx={{ minWidth: { xs: 930, md: 'auto' } }}>
                {circleMetrics.map((metric) => (
                  <Box key={metric.id} sx={{ flex: 1, minWidth: 290, display: 'flex', justifyContent: 'center' }}>
                    <Box
                      sx={{
                        width: { xs: 290, sm: 300, md: 315 },
                        height: { xs: 290, sm: 300, md: 315 },
                        borderRadius: '50%',
                        backgroundColor: '#00143642',
                        backgroundImage:
                          'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.06), rgba(255,255,255,0.01) 38%, transparent 55%)',
                        boxShadow: `
      inset -12px 0 18px rgba(0, 0, 0, 0.22),
      inset -24px 0 30px rgba(0, 20, 54, 0.28),
      inset 1px 4px 5px rgba(0, 0, 0, 0.2)
    `,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 1.1
                      }}
                    >
                      <Box
                        component="img"
                        src={metric.icon}
                        alt={metric.iconAlt}
                        sx={{
                          width: metric.id === 'metric-1' ? { xs: 68, sm: 74, md: 80 } : { xs: 78, sm: 84, md: 90 },
                          height: metric.id === 'metric-1' ? { xs: 68, sm: 74, md: 80 } : { xs: 78, sm: 84, md: 90 },
                          border: 'none',
                          objectFit: 'contain'
                        }}
                      />
                      {metric.direction && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'var(--blue)', fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1 }}
                        >
                          {metric.direction}
                        </Typography>
                      )}
                      <Typography
                        variant="h1"
                        // Keep `variant="h1"` for the large-display
                        // typography but render as a <p> so the page
                        // doesn't end up with three <h1> elements (one
                        // per circle). The biggest reading per circle
                        // is a visual emphasis, not a top-level
                        // document landmark, and the dashboard layout
                        // already sets the real page <h1>.
                        component="p"
                        sx={{
                          color: 'var(--green)',
                          lineHeight: 1,
                          fontWeight: 300,
                          fontSize: { xs: '3.2rem', sm: '3.4rem', md: '3.7rem' },
                          textShadow: '0 1px 9px #1a75e0c9',
                          // Remove default <p> margin so the visual
                          // spacing stays exactly as it did before.
                          m: 0
                        }}
                      >
                        {metric.value}
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        // Render as <p> so this caption isn't a
                        // sub-heading. Without this, the subtitle1
                        // variant defaults to <h6> and breaks the
                        // page's heading order (the panel-level
                        // <h4> "Sensor Measurements" would jump
                        // straight to <h6> here).
                        component="p"
                        sx={{ color: 'var(--blue)', textAlign: 'center', fontSize: { xs: '1rem', sm: '1.05rem' }, m: 0 }}
                      >
                        {metric.label}
                      </Typography>
                      {metric.gustLabel && metric.gustValue && (
                        <Typography
                          variant="subtitle2"
                          // Same reasoning as the subtitle1 above —
                          // render as <p>, not <h6>. The gust/humidity
                          // line is a sub-label of the metric value,
                          // not a section heading.
                          component="p"
                          sx={{ textAlign: 'center', color: 'var(--blue)', m: 0 }}
                        >
                          <Box component="span">{metric.gustLabel}</Box>
                          <Box component="span" sx={{ color: 'var(--green)', ml: 0.75 }}>
                            {metric.gustValue}
                          </Box>
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/*
            Chart panel — rendered UNCONDITIONALLY now so it sits
            below either the map or the circles. mt provides the same
            visual separation the circles-only layout used to get from
            its own mb. Keeps the user's time-series context visible
            whether they're looking at the snapshot circles or the
            geographic map above.
          */}
          <Box
            sx={{
              borderRadius: 1,
              p: { xs: 1.5, sm: 2 },
              mt: { xs: 2.5, sm: 3 },
              ...reflectedCardChromeSx,
              backgroundColor: 'var(--drf)',
              backgroundImage: 'none',
              boxShadow: '0 14px 26px rgba(1, 13, 50, 1)'
            }}
          >
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                Measurements Over Time
              </Typography>
              <Tooltip title="Orientation" arrow={false} slotProps={tooltipSlotProps}>
                <IconButton
                  aria-label="toggle sensor chart layout"
                  onClick={() => setChartLayout((prev) => (prev === 'column' ? 'row' : 'column'))}
                  sx={orientationButtonSx}
                >
                  <AntIcon icon={AppstoreOutlined} />
                </IconButton>
              </Tooltip>
            </Stack>

            {/*
              Toolbar wrapped in LocalizationProvider so the
              DateTimePicker children get the AdapterDayjs date adapter
              they need. The provider mounts unconditionally even when
              the pickers aren't visible (custom range mode off) —
              having it always in scope keeps the conditional render
              cheap and avoids any "first-toggle initialization"
              flicker.
            */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              {/*
                Outer Stack uses space-between so the left-group
                (dropdown + optional pickers) anchors to the left edge
                and the Download button anchors to the right edge of
                the toolbar regardless of how much space the left
                group consumes. This way the Download button sits
                flush right whether the custom pickers are visible or
                not, instead of sliding against the dropdown.
              */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                sx={{
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                  mb: 2,
                  flexWrap: 'wrap',
                  rowGap: 1
                }}
              >
                {/*
                  Left-group wrapper — dropdown + optional pickers
                  share this Stack so the parent's space-between has
                  exactly two children (left group + Download), and
                  the pickers stay grouped next to the dropdown rather
                  than competing for the right edge with Download.
                */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.25}
                  sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap', rowGap: 1, minWidth: 0 }}
                >
                  <FormControl
                    size="small"
                    sx={{ minWidth: { xs: 0, sm: 220 }, width: { xs: '100%', sm: 220 }, flex: { xs: 1, sm: '0 0 auto' } }}
                  >
                    <Select
                      value={timeRange}
                      onChange={(event) => setTimeRange(event.target.value)}
                      // Accessible name for the dropdown. Without this,
                      // screen readers announce it as just "combobox"
                      // and Lighthouse's `aria-input-field-name`
                      // audit fails (verified in
                      // Lighthouse_Reports/lighthouse-sensor-
                      // measurements.json). Short label on purpose:
                      // the renderValue prop already shows the
                      // current selection, so the aria-label only
                      // needs to identify the control's purpose, not
                      // restate the value.
                      inputProps={{ 'aria-label': 'Chart time range' }}
                      displayEmpty
                      sx={{
                        color: 'var(--green)',
                        border: '1px solid var(--reflected-light)',
                        borderRadius: 1,
                        backgroundColor: 'var(--drf)',
                        boxShadow: '0 11px 19px 1px #0000002e',
                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                        '& .MuiSelect-select': { color: 'var(--green)' },
                        '& .MuiSelect-icon': { color: 'var(--blue)' }
                      }}
                      MenuProps={{ PaperProps: neonSelectMenuPaperProps }}
                      renderValue={(selected) => (
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <AntIcon icon={ClockCircleOutlined} style={{ color: 'var(--blue)' }} />
                          <Box component="span" sx={{ color: 'var(--green)' }}>
                            {selected || 'Select Time Range...'}
                          </Box>
                        </Stack>
                      )}
                    >
                      {CHART_TIME_RANGE_LABELS.map((option) => (
                        <MenuItem
                          key={option}
                          value={option}
                          sx={{
                            color: 'var(--green)',
                            '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' },
                            '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.18)' }
                          }}
                        >
                          {option}
                        </MenuItem>
                      ))}
                      {/*
                      "Custom range…" — sentinel option at the bottom
                      of the dropdown. Selecting it reveals the two
                      DateTimePickers below; picking any other preset
                      hides them again. Single source of truth via
                      `timeRange === CUSTOM_RANGE_LABEL` (the
                      `isCustomRange` derived flag).
                    */}
                      <MenuItem
                        key={CUSTOM_RANGE_LABEL}
                        value={CUSTOM_RANGE_LABEL}
                        sx={{
                          color: 'var(--green)',
                          borderTop: '1px solid var(--reflected-light)',
                          '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' },
                          '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.18)' }
                        }}
                      >
                        {CUSTOM_RANGE_LABEL}
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {/*
                  Custom range DateTimePickers — only rendered when the
                  dropdown is on the custom sentinel. Two side-by-side
                  inputs, auto-applied (no explicit "Apply" button) —
                  the chart re-fetches as soon as BOTH have valid
                  values and from < to, per the from/to memo's branch
                  resolution above. Until both are entered, the chart
                  falls back to the DEFAULT preset so the user doesn't
                  see a blank chart while typing.
                */}
                  {isCustomRange && (
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flex: { sm: 1 } }}
                    >
                      <DateTimePicker
                        value={customFromTime}
                        onChange={(value) => setCustomFromTime(value)}
                        ampm
                        slotProps={{
                          textField: {
                            size: 'small',
                            placeholder: 'From',
                            sx: { minWidth: { sm: 180 }, flex: 1, ...dateTimePickerTextFieldSx }
                          },
                          popper: { sx: dateTimePickerPopperSx },
                          desktopPaper: { sx: dateTimePickerPaperSx },
                          mobilePaper: { sx: dateTimePickerPaperSx }
                        }}
                      />
                      <DateTimePicker
                        value={customToTime}
                        onChange={(value) => setCustomToTime(value)}
                        ampm
                        slotProps={{
                          textField: {
                            size: 'small',
                            placeholder: 'To',
                            sx: { minWidth: { sm: 180 }, flex: 1, ...dateTimePickerTextFieldSx }
                          },
                          popper: { sx: dateTimePickerPopperSx },
                          desktopPaper: { sx: dateTimePickerPaperSx },
                          mobilePaper: { sx: dateTimePickerPaperSx }
                        }}
                      />
                    </Stack>
                  )}

                  {/*
                    Selection-change loading indicator. Lives inside
                    the LEFT group (next to the dropdown / pickers)
                    so the badge sits adjacent to the controls the
                    user just changed, making the visual association
                    obvious. Only fires when the user's selection
                    actually triggered a fetch (see the
                    `showSelectionLoading` derivation above) — the
                    60s background SWR poll won't flash it.
                  */}
                  {showSelectionLoading && (
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{
                        alignItems: 'center',
                        color: 'var(--green)',
                        // Subtle fade-in so a quick fetch doesn't
                        // produce a hard pop. CSS-only — no React
                        // state involved.
                        '@keyframes phenode-loading-fade-in': {
                          from: { opacity: 0 },
                          to: { opacity: 1 }
                        },
                        animation: 'phenode-loading-fade-in 200ms ease-out'
                      }}
                      role="status"
                      aria-live="polite"
                    >
                      <CircularProgress size={14} sx={{ color: 'var(--green)' }} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'var(--green)',
                          textShadow: '0 0 6px rgba(72, 247, 245, 0.35)',
                          fontWeight: 600
                        }}
                      >
                        Loading…
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                {/*
                  Download CSV — exports the currently-loaded
                  measurement rows for whichever range is active
                  (preset OR custom). Disabled when there's no data
                  to export (loading window, empty range, or error
                  before first response). Filename embeds the device
                  label slug + ISO from/to dates so multiple
                  downloads from the same session don't overwrite
                  each other in the user's Downloads folder.

                  Sits as the second (right-most) child of the outer
                  space-between Stack, so it anchors to the right edge
                  of the toolbar regardless of how wide the left group
                  is — see the outer Stack's justifyContent comment
                  above.
                */}
                <Tooltip
                  title={measurementRows?.length ? 'Download CSV for this range' : 'No data to download'}
                  arrow={false}
                  slotProps={tooltipSlotProps}
                >
                  <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
                    <Button
                      variant="outlined"
                      startIcon={<AntIcon icon={DownloadOutlined} />}
                      disabled={!measurementRows?.length || downloading || !activeDevice}
                      onClick={handleDownload}
                      sx={{
                        textTransform: 'none',
                        borderColor: 'var(--orange)',
                        color: 'var(--green)',
                        backgroundColor: 'rgba(0, 20, 61, 0.72)',
                        boxShadow: '0 11px 19px 1px #0000002e',
                        transition: 'none',
                        '&:hover': {
                          borderColor: 'var(--green)',
                          boxShadow: '0 0 7px -5px var(--green)',
                          color: 'var(--green)',
                          textShadow: '0 1px 5px #007bff',
                          backgroundColor: 'rgba(72, 247, 245, 0.08)'
                        },
                        // Disabled state matches the Download button in
                        // the Data Downloads page (sections/data-download/
                        // data-downloads.jsx:586-593) so the "no data
                        // available" affordance is consistent across the
                        // app's download surfaces — grey text + grey
                        // border on a flat dark-navy fill, no hover
                        // brightening.
                        '&.Mui-disabled': {
                          color: 'var(--med-grey)',
                          borderColor: 'var(--med-grey)',
                          backgroundColor: '#01113d'
                        },
                        '&.Mui-disabled:hover': {
                          backgroundColor: '#01113d'
                        }
                      }}
                    >
                      {downloading ? 'Downloading…' : 'Download CSV'}
                    </Button>
                  </Box>
                </Tooltip>
              </Stack>
            </LocalizationProvider>

            {/*
              Panel-level initial-load + error states. Replaces the
              per-chart "Failed to load chart data" / "Loading chart
              data…" branches that used to fire six times during the
              first fetch — six wrapper Boxes + six spinners is wasted
              work when the user is looking at one consolidated "still
              waiting on the first response" state.

              Once `measurementRows` has any value (even an empty
              array), the grid renders normally and each chart's own
              "No data for this time range" branch handles per-metric
              gaps. So:

                first fetch in flight (no rows yet)           → panel-level Loading
                first fetch failed (no rows yet)              → panel-level Error
                rows exist (even if some are empty per metric) → render grid

              Background polls don't blank the grid — the
              `!measurementRows` guard ensures we only suppress the
              grid before the very first response arrives.
            */}
            {measurementsError && !measurementRows ? (
              <Box
                sx={{
                  minHeight: { xs: 320, md: 380 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--orange)',
                  fontSize: '0.9rem',
                  fontStyle: 'italic'
                }}
                role="alert"
              >
                Failed to load chart data
              </Box>
            ) : measurementsLoading && !measurementRows ? (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  minHeight: { xs: 320, md: 380 },
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--blue)',
                  fontSize: '0.9rem'
                }}
                role="status"
                aria-live="polite"
              >
                <CircularProgress size={22} sx={{ color: 'var(--green)' }} />
                <Box component="span">Loading chart data…</Box>
              </Stack>
            ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns:
                  chartLayout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr'
              }}
            >
              {chartConfigs.map((config) => {
                // Per-chart series shape is now `{ times, values }` —
                // both arrays are null-filtered so the chart only
                // plots positions where this field actually has a
                // reading. The shared `chartTimes` above is still
                // used for the X-axis min/max so every chart in the
                // grid stays aligned on the same time range.
                const { times: seriesTimes, values: seriesData } = chartSeriesByField[config.key] ?? { times: [], values: [] };
                // `seriesData` is already null-filtered above, so
                // these are all real numeric values — no need to
                // re-filter. Length check alone tells us if there's
                // anything to render.
                const hasData = seriesData.length > 0;

                // Y-axis padding is computed INSIDE MeasurementChart
                // now — see the memoized component at the top of this
                // file. We only need `hasData` here to gate between
                // the "No data" branch and the chart render below.

                return (
                  <Box
                    key={config.key}
                    // Per-chart CSS variable for the line/glow color.
                    // The shared `chartSx` references both vars so we
                    // don't have to build a different sx object per
                    // chart — keeps `chartSx` a single hoisted
                    // reference instead of N reconstructed objects.
                    // `--chart-glow-filter` is computed once at the
                    // panel level (chartGlowFilterVar) since all six
                    // charts share the same point-count threshold —
                    // setting it on the wrapper scopes the lookup
                    // while keeping the threshold logic in one place.
                    style={{ '--chart-line-color': config.color, '--chart-glow-filter': chartGlowFilterVar }}
                    sx={{
                      borderRadius: 1,
                      p: { xs: 0.45, sm: 0.65 },
                      // Card min-height tuned so it exactly matches the
                      // content height in row layout: padding-top (~5.2px
                      // sm) + title row (~28px) + title-mb (~2px) + chart
                      // height (228 in row, 258 in column) + padding-
                      // bottom (~5.2px sm) ≈ 268. Previously this was 286,
                      // forcing the card ~18px taller than its content
                      // and parking that extra space as a visible gap
                      // below the chart. The new value lets the bottom
                      // padding-inside-card equal the top padding-inside-
                      // card (both ~5.2px). For column layout the chart
                      // is taller (258) so the card naturally grows
                      // beyond minHeight to fit it — no gap either way.
                      minHeight: { xs: 265, sm: 268 },
                      display: 'flex',
                      flexDirection: 'column',
                      ...reflectedCardChromeSx,
                      ...chartSurfaceSx,
                      border: '1px solid #0e346a'
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                      <Typography variant="subtitle1" component="p" sx={{ color: 'var(--blue)', ml: 1.25, mt: 0, mb: 0, mr: 0 }}>
                        {config.title}
                        {config.unit ? (
                          <Box component="span" sx={{ color: 'var(--green)', ml: 0.75, fontSize: '0.85em' }}>
                            ({config.unit})
                          </Box>
                        ) : null}
                      </Typography>
                      <Tooltip title="Enlarge" arrow={false} slotProps={tooltipSlotProps}>
                        <IconButton
                          aria-label={`enlarge ${config.title} chart`}
                          size="small"
                          // Click opens a themed Dialog with the same
                          // chart rendered at full Dialog width. The
                          // single Dialog instance lives at the end of
                          // this component and switches its content
                          // based on enlargedChartKey.
                          onClick={() => setEnlargedChartKey(config.key)}
                          sx={{ color: 'var(--blue)', '&:hover': { color: 'var(--green)' } }}
                        >
                          <AntIcon icon={ZoomInOutlined} />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    {/*
                      Three render branches: error → loading → empty →
                      chart. The initial-load / first-error states are
                      now handled at the PANEL level (see the wrapper
                      above), so each chart only needs to distinguish
                      "no data for this metric in this range" from
                      "we have data — draw it." Background poll errors
                      don't blank charts that already have rows; this
                      is the stale-while-revalidate side of the
                      per-chart treatment.
                    */}
                    {!hasData ? (
                      <Box
                        sx={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--blue)',
                          fontSize: '0.85rem',
                          fontStyle: 'italic'
                        }}
                      >
                        No data for this time range
                      </Box>
                    ) : (
                      // Memoized chart — see MeasurementChart at the
                      // top of this file for the rationale. All props
                      // are primitives or stable-reference values so
                      // React.memo's default shallowEqual will skip
                      // the chart re-render when nothing meaningful
                      // changed (the toolbar fidgeting elsewhere on
                      // the page won't propagate down here).
                      <MeasurementChart
                        config={config}
                        seriesTimes={seriesTimes}
                        seriesData={seriesData}
                        xAxisMin={chartTimes[0]}
                        xAxisMax={chartTimes[chartTimes.length - 1]}
                        xAxisTicks={xAxisTicks}
                        axisFormat={axisFormat}
                        height={chartLayout === 'row' ? 228 : 258}
                        yAxisWidth={56}
                        xAxisFontSize={11}
                        yAxisFontSize={11}
                        marginTop={8}
                        marginRight={8}
                        marginBottom={0}
                        marginLeft={0}
                        idSuffix=""
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
            )}
          </Box>
        </Box>
      </MainCard>
      {/*
      Enlarge Dialog — renders the user-selected chart at full Dialog
      width. Single mounted instance for the whole panel: open by
      setEnlargedChartKey(<key>), close by setEnlargedChartKey(null).
      MUI Dialog uses a Portal internally so it visually escapes the
      MainCard chrome and sits above the rest of the page with the
      themed backdrop blur (same recipe used by the ConfirmRenameModal).

      Data flows directly from the existing useDeviceMeasurements hook —
      so a fetch that updates the grid charts also updates the enlarged
      chart, and the same loading / empty / error branches handle the
      states uniformly.
    */}
      <Dialog
        open={Boolean(enlargedChartConfig)}
        onClose={() => setEnlargedChartKey(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'rgba(0, 20, 61, 0.96)',
              backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--reflected-light)',
              boxShadow: '0 11px 19px 1px #0000002e',
              borderRadius: 1
            }
          },
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(6px)'
            }
          }
        }}
      >
        {enlargedChartConfig &&
          (() => {
            const config = enlargedChartConfig;
            // Same per-chart `{ times, values }` shape as the grid
            // version above — null-filtered so the enlarged line is
            // continuous and the tooltip never resolves to "No data".
            const { times: seriesTimes, values: seriesData } = chartSeriesByField[config.key] ?? { times: [], values: [] };
            const hasData = seriesData.length > 0;
            return (
              <>
                <DialogTitle sx={{ pb: 1, pr: 1 }}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                      {config.title}
                      {config.unit ? (
                        <Box component="span" sx={{ color: 'var(--green)', ml: 1, fontSize: '0.85em' }}>
                          ({config.unit})
                        </Box>
                      ) : null}
                    </Typography>
                    <Tooltip title="Close" arrow={false} slotProps={tooltipSlotProps}>
                      <IconButton aria-label="close enlarged chart" onClick={() => setEnlargedChartKey(null)} sx={{ color: 'var(--blue)' }}>
                        <AntIcon icon={CloseOutlined} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </DialogTitle>
                <DialogContent sx={{ pt: 1.5, pb: 2.5 }}>
                  <Box
                    style={{ '--chart-line-color': config.color, '--chart-glow-filter': chartGlowFilterVar }}
                    sx={{ ...chartSurfaceSx, border: '1px solid #0e346a', borderRadius: 1, p: { xs: 1, sm: 1.5 } }}
                  >
                    {measurementsError && !measurementRows ? (
                      <Box
                        sx={{
                          minHeight: 380,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--orange)',
                          fontSize: '0.85rem',
                          fontStyle: 'italic'
                        }}
                      >
                        Failed to load chart data
                      </Box>
                    ) : measurementsLoading && !measurementRows ? (
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ minHeight: 380, alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontSize: '0.85rem' }}
                      >
                        <CircularProgress size={22} sx={{ color: 'var(--green)' }} />
                        <Box component="span">Loading chart data…</Box>
                      </Stack>
                    ) : !hasData ? (
                      <Box
                        sx={{
                          minHeight: 380,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--blue)',
                          fontSize: '0.85rem',
                          fontStyle: 'italic'
                        }}
                      >
                        No data for this time range
                      </Box>
                    ) : (
                      // Same memoized component as the grid version —
                      // just larger and with a unique idSuffix so the
                      // two charts' MUI x-charts ids don't collide
                      // when both are mounted (the grid card stays
                      // visible underneath the Dialog).
                      <MeasurementChart
                        config={config}
                        seriesTimes={seriesTimes}
                        seriesData={seriesData}
                        xAxisMin={seriesTimes[0]}
                        xAxisMax={seriesTimes[seriesTimes.length - 1]}
                        xAxisTicks={xAxisTicks}
                        axisFormat={axisFormat}
                        height={500}
                        yAxisWidth={64}
                        xAxisFontSize={12}
                        yAxisFontSize={12}
                        marginTop={12}
                        marginRight={12}
                        marginBottom={4}
                        marginLeft={4}
                        idSuffix="-enlarged"
                      />
                    )}
                  </Box>
                </DialogContent>
              </>
            );
          })()}
      </Dialog>
    </>
  );
}
