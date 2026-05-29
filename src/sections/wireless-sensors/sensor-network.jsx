import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import ChartGlowDefs from 'components/ChartGlowDefs';
import ConfirmRenameModal from 'components/ConfirmRenameModal';
import MainCard from 'components/MainCard';
import { useSelection } from 'contexts/SelectionContext';
import WirelessSensorFleetMap from 'sections/wireless-sensors/wireless-sensor-fleet-map';
import useAuth from 'hooks/useAuth';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import useInfoCard from 'hooks/useInfoCard';
import useMyDevices from 'hooks/data/useMyDevices';
import useMyWirelessSensors from 'hooks/data/useMyWirelessSensors';
import useWirelessSensorDetail from 'hooks/data/useWirelessSensorDetail';
import useWirelessSensorMeasurements from 'hooks/data/useWirelessSensorMeasurements';
import WirelessMeasurementsPanel from 'sections/wireless-sensors/WirelessMeasurementsPanel';
import { useToast } from 'providers/ToastProvider';
import { downloadWirelessSensorData, renameSensor } from 'services/mutations';
import triggerBlobDownload from 'utils/triggerBlobDownload';
import {
  formatBatteryPercent,
  formatLastMeasurement,
  formatMacAddress,
  formatSoilMoisture,
  formatSoilTemperature
} from 'utils/transforms/wirelessSensor';
import {
  CHART_TIME_RANGE_LABELS,
  DEFAULT_CHART_TIME_RANGE,
  computeAxisTicks,
  computeChartWindow,
  findChartTimeRange,
  pickAxisFormatForRange
} from 'utils/chartTimeRanges';
import wirelessSensorsDiagram from 'assets/diagrams/Wireless-Sensors-v4.svg';
import wsFleetIcon from 'assets/drawer-icons/WS_Fleet.svg';
import wsFleetIconActive from 'assets/drawer-icons/WS_Fleet_Active.svg';
import mapIconActive from 'assets/toggle_buttons/Map_Icon_Active.svg';
import mapIconInactive from 'assets/toggle_buttons/Map_Icon_Inactive.svg';
import soilProbeIconActive from 'assets/toggle_buttons/Soil_Probe_Icon_Active.svg';
import soilProbeIconInactive from 'assets/toggle_buttons/Soil_Probe_Icon_Inactive.svg';

import AntIcon from 'components/AntIcon';
import AppstoreOutlined from '@ant-design/icons-svg/lib/asn/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons-svg/lib/asn/ClockCircleOutlined';
import CloudOutlined from '@ant-design/icons-svg/lib/asn/CloudOutlined';
import DownloadOutlined from '@ant-design/icons-svg/lib/asn/DownloadOutlined';
import phenodeFleetIcon from 'assets/drawer-icons/PheNode_Fleet.svg';
import soilProbeIcon from 'assets/toggle_buttons/Soil_Probe_Icon_Inactive.svg';
import { WIRELESS_CATEGORY_IDS } from 'sections/wireless-sensors/wirelessSensorCatalog';

import {
  glassSurfaceSx,
  reflectedCardChromeSx,
  drfSurfaceSx,
  neonControlSx,
  drawerNavButtonSurfaceSx,
  orientationButtonSx,
  neonMenuPaperSx,
  neonMenuItemSx,
  tooltipSlotProps,
  neonSelectMenuPaperProps
} from 'themes/sx-tokens';

// Hoisted to module scope so this object literal isn't recreated every render.
const diagramWidthSx = { xs: '92%', sm: '88%', md: '90%', lg: '92%' };

// =============================================================================
// Chart panel — module-scope constants
// =============================================================================
//
// Parallel to the device chart panel in sensor-measurements.jsx but
// with a wireless-sensor field vocabulary. Single source of truth for
// the chart configs the panel renders, the field list the SWR hook
// requests, the time-range sentinel for the Custom-range dropdown
// option, the date-picker sx tokens (copied from
// sensor-measurements.jsx — small enough that duplication is cheaper
// than extracting), and the CSV download helpers.

// Sentinel option in the time-range dropdown that reveals the custom
// DateTimePickers. Same string everywhere so the comparison in the
// from/to memo + the dropdown menu can't drift.
const CUSTOM_RANGE_LABEL = 'Custom range…';

// Backend field projection — the *fieldKey* set never changes with
// user preferences (we always need the same raw columns from the API;
// only the display conversion + label vary). So this stays a module
// constant, derived from a default factory call.
const WIRELESS_SENSOR_CHART_FIELDS = [
  'temperatureTeros12_1',
  'temperatureTeros12_2',
  'vwcPercent_1',
  'vwcPercent_2',
  'electricalConductivity_1',
  'electricalConductivity_2',
  'mVbat',
  'lux',
  'rssi'
];

// Chart sx + y-axis formatter live in sections/sensor-measurements/
// measurementChartCore — pulled in by WirelessMeasurementsPanel directly.
// dimHexColor is preserved above for any future per-probe highlight UI
// that might want to reuse the dim treatment.

// =============================================================================
// Date-time picker sx — duplicated from sensor-measurements.jsx so both
// pages share the same date/time picker visual vocabulary. Promote to
// themes/ if a third surface ever lands.
// =============================================================================

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
  '& .MuiPickersLayout-actionBar': {
    borderTop: '1px solid var(--reflected-light)',
    px: 1,
    py: 0.75,
    gap: 0.75,
    '& .MuiButton-root': {
      color: 'var(--blue)',
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
  '& .MuiPickersToolbar-root, & .MuiDateTimePickerToolbar-root': {
    color: 'var(--green)',
    backgroundColor: 'transparent',
    borderBottom: '1px solid var(--reflected-light)'
  },
  '& .MuiPickersToolbarText-root': { color: 'var(--blue)' },
  '& .MuiPickersToolbarText-root.Mui-selected': {
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
  },
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
    '& .MuiTabs-indicator': { backgroundColor: 'var(--green)' }
  },
  '& .MuiMultiSectionDigitalClockSection-root': {
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
    '&:hover, &:focus': { backgroundColor: 'rgba(72, 247, 245, 0.28)' }
  },
  '& .MuiDigitalClock-item': {
    color: 'var(--green)',
    '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' }
  },
  '& .MuiDigitalClock-item.Mui-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
  },
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
    '&:hover, &:focus': { backgroundColor: 'rgba(72, 247, 245, 0.12)', color: 'var(--green)' }
  },
  '& .MuiYearCalendar-button.Mui-selected, & .MuiYearCalendar-button.MuiYearCalendar-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    fontWeight: 700,
    '&:hover, &:focus': { backgroundColor: 'rgba(72, 247, 245, 0.28)' }
  },
  '& .MuiYearCalendar-button.Mui-disabled, & .MuiYearCalendar-button.MuiYearCalendar-disabled': {
    color: 'var(--blue)',
    opacity: 0.35
  },
  '& .MuiMonthCalendar-button': {
    color: 'var(--green)',
    fontWeight: 500,
    borderRadius: 1,
    transition: 'color 0.18s ease, background-color 0.18s ease',
    '&:hover, &:focus': { backgroundColor: 'rgba(72, 247, 245, 0.12)', color: 'var(--green)' }
  },
  '& .MuiMonthCalendar-button.Mui-selected, & .MuiMonthCalendar-button.MuiMonthCalendar-selected': {
    backgroundColor: 'rgba(72, 247, 245, 0.2)',
    color: 'var(--green)',
    textShadow: '0 0 6px rgba(72, 247, 245, 0.45)',
    fontWeight: 700,
    '&:hover, &:focus': { backgroundColor: 'rgba(72, 247, 245, 0.28)' }
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
// Download helpers — backend-generated archive.
// =============================================================================
//
// The Download button on this page calls the backend's
// `POST /wireless-sensors/sensor-data/{sensor_list}/{from}/{to}` endpoint
// (services/mutations.js → downloadWirelessSensorData). The backend
// pulls the user's saved data_download_preferences (decimal places,
// timezone, blank/zero handling) from the DB and applies them to each
// CSV before zipping the archive. Always returns application/zip even
// for a single sensor — there's no single-CSV variant of this route.
//
// History: an earlier version of this file built the CSV client-side
// from the chart configs (which derive from `ui_preferences.units`).
// That mixed the two preference scopes and missed the formatting
// features the backend handles. Replaced so the export is consistent
// with the future Data Downloads page and any scripted API consumer.

const dateToFilenameSlug = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10);
};

const sensorLabelToFilenameSlug = (label) => {
  const trimmed = (label ?? '').trim();
  if (!trimmed) return 'sensor';
  return trimmed.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'sensor';
};

// Extension from the backend's Content-Disposition filename. For the
// wireless endpoint this is always .zip — but reading it from the
// header (rather than hardcoding) keeps the code resilient if the
// backend ever adds a single-CSV variant of the route.
const extensionFromBackendFilename = (filename) => {
  const m = filename ? /\.([a-z0-9]+)$/i.exec(filename) : null;
  return m ? m[1].toLowerCase() : 'zip';
};

// Search-param name for deep-linking from the wireless-sensor fleet
// overview. The fleet card click writes
// `?sensor=<externalSensorId>` (see sections/fleet-overview/
// sensor-fleet-overview.jsx:handleRowClick); this page reads it back
// out to seed both the PheNode and Sensor dropdowns. Pulled to a
// module-scope constant so the contract is discoverable in one place
// — if we ever rename the param, both sides flip together. Mirrors
// the DEVICE_PARAM convention in sensor-measurements.jsx.
const SENSOR_PARAM = 'sensor';

// URL search-param names for the chart panel's view / range state.
// Mirror of sensor-measurements.jsx's VIEW_PARAM / RANGE_PARAM so the
// two pages share the same query-string vocabulary — a saved URL with
// `?view=map&range=Last%205%20years` works the same on either page,
// and the authenticated Lighthouse audit script
// (phenodeV3/scripts/lighthouse-audit-authenticated.mjs) can deep-link
// into specific UI states (map view open, long-range chart panel) by
// just appending these params to the route URL — no puppeteer click
// scaffolding needed.
const VIEW_PARAM = 'view';
const VIEW_PARAM_MAP_VALUE = 'map';
const RANGE_PARAM = 'range';

// Conversion ratio for °F → °m. Local consts (not magic numbers in the
// transform) make the intent obvious at the call site. Used for the
// altitude reading (backend stores meters; the existing UI displays feet).
const FEET_PER_METER = 3.28084;

// Display format for GPS coords on the Sensor Information card.
//   "32.4218, -92.8907"  — ~5 decimal places ≈ 1m precision, which is
//   the resolution the backend's _clean_location guard is good for.
//   Returns "N/A" when either coordinate is missing/invalid.
//
// Why two-line / single-string here (not separate Latitude + Longitude
// rows like the mock had): the existing card layout is a 2-column grid
// (label + value) and the rest of the labels read as one-liners
// ("Sensor ID", "Battery", "Probes Connected"). Showing GPS as a
// single combined string keeps the visual rhythm consistent. If we
// later want to break it back out, the comma-split is trivial.
const formatGpsCoords = (lat, lng) => {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return 'N/A';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

// ---------------------------------------------------------------------------
// Category dropdown plumbing — mirrors sensor-measurements.jsx so the
// device-side and wireless-side category selectors share one visual language.
// Each category in the wireless catalog gets the same icon family as its
// equivalent on the device page (Environment → cloud, Light → sun, Soil →
// soil probe, Power & Device → PheNode fleet, All → app grid).
// ---------------------------------------------------------------------------
function SunGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--blue)' }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41" />
    </svg>
  );
}

const CATEGORY_LABELS = {
  [WIRELESS_CATEGORY_IDS.WEATHER]: 'Environment',
  [WIRELESS_CATEGORY_IDS.LIGHT]: 'Light',
  [WIRELESS_CATEGORY_IDS.SOIL]: 'Soil',
  [WIRELESS_CATEGORY_IDS.POWER]: 'Power & Device',
  [WIRELESS_CATEGORY_IDS.ALL]: 'All'
};

// Ordered list driving the dropdown's MenuItem render. Pulled to module
// scope so it isn't recreated every render; "All" goes at the end so the
// catalog's natural ordering reads first.
const CATEGORY_OPTIONS = [
  WIRELESS_CATEGORY_IDS.WEATHER,
  WIRELESS_CATEGORY_IDS.LIGHT,
  WIRELESS_CATEGORY_IDS.SOIL,
  WIRELESS_CATEGORY_IDS.POWER,
  WIRELESS_CATEGORY_IDS.ALL
];

function categoryIcon(categoryId) {
  switch (categoryId) {
    case WIRELESS_CATEGORY_IDS.ALL:
      return <AntIcon icon={AppstoreOutlined} style={{ color: 'var(--blue)' }} />;
    case WIRELESS_CATEGORY_IDS.WEATHER:
      return <AntIcon icon={CloudOutlined} style={{ color: 'var(--blue)' }} />;
    case WIRELESS_CATEGORY_IDS.LIGHT:
      return <SunGlyph />;
    case WIRELESS_CATEGORY_IDS.SOIL:
      return <Box component="img" src={soilProbeIcon} alt="" sx={{ width: 18, height: 18 }} />;
    case WIRELESS_CATEGORY_IDS.POWER:
      return <Box component="img" src={phenodeFleetIcon} alt="" sx={{ width: 18, height: 18 }} />;
    default:
      return <AntIcon icon={AppstoreOutlined} style={{ color: 'var(--blue)' }} />;
  }
}

// Altitude is meters on the wire (sensor.altitude on the WirelessSensor
// model — see phenodeX/phenode_backend/db/models.py:124). The mock
// previously displayed feet ("793.95ft"), so we convert here to keep the
// surface visual unchanged. If a unit-preference toggle ever lands, this
// is the single place to flip it.
const formatAltitude = (meters) => {
  if (meters == null || Number.isNaN(meters)) return 'N/A';
  const feet = meters * FEET_PER_METER;
  return `${feet.toFixed(2)}ft`;
};

// Count the number of true entries in soilProbesConnected. The backend
// returns { teros12_1_connected: bool, teros12_2_connected: bool } —
// see _soil_probes_connected in phenodeX/phenode_backend/api/
// wireless_sensors/routes.py:92-108. Returning a bare integer (or 'N/A'
// when the dict isn't present) so the existing card UI just renders it
// as a number.
const countConnectedProbes = (probesConnected) => {
  if (!probesConnected) return 'N/A';
  return Object.values(probesConnected).filter((v) => v === true).length;
};

// Format electrical conductivity for the Soil Data card. Backend
// normalizes to dS/m (decisiemens per meter) — see _normalize_conductivity
// in routes.py:53-57. The mock previously labelled this "Soil Salinity"
// in kPa, which was wrong on both axes (the value is conductivity, not
// salinity, and the unit is dS/m). We keep the same row in the same
// position so the visual layout is unchanged, but with correct copy
// + unit so the number actually means something.
const formatConductivity = (value) => {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(2)} dS/m`;
};

// Build the soil-data rows for the active probe. selectedSoilProbe is
// 'probe-1' or 'probe-2' (see useInfoCard); we map that to the matching
// element of detail.soilSensors. Falls back to an "N/A" row set when
// the detail hook hasn't resolved or the sensor doesn't have a probe
// wired to that port — same shape as the mock so the .map() in the
// render branch doesn't have to special-case loading.
// `tempUnit` from useDisplayPreferences flows in so the Soil
// Temperature row matches the user's preferred display unit. The
// caller's useMemo includes tempUnit in its deps so a unit change
// re-derives the rows.
const buildSoilReadings = (sensorDetail, selectedSoilProbe, tempUnit = 'F') => {
  const port = selectedSoilProbe === 'probe-2' ? 1 : 0;
  const soil = sensorDetail?.soilSensors?.[port];
  return [
    { label: 'Soil Temperature', value: formatSoilTemperature(soil?.soilTemperature, tempUnit) },
    { label: 'Soil Moisture', value: formatSoilMoisture(soil?.soilMoisture) },
    // Renamed from "Soil Salinity / kPa" (mock) → "Conductivity / dS/m"
    // because the backend value is electrical conductivity, not salinity.
    // See note on formatConductivity above.
    { label: 'Conductivity', value: formatConductivity(soil?.electricalConductivity) }
  ];
};

export default function SensorNetwork() {
  // useSearchParams owns the URL read/write side of every URL-driven
  // piece of state on this page (`?sensor=` for the active sensor,
  // `?view=map` for the map-vs-diagram toggle, `?range=<label>` for
  // the chart time range). Pulled up to the top of the component so
  // every URL-derived value below can reference the same instance.
  const [searchParams, setSearchParams] = useSearchParams();

  // Display preferences. Drives:
  //   - the soil-readings card (Soil Temperature row → tempUnit)
  //   - the WIRELESS_SENSOR chart configs (soil temperature transform/
  //     label → tempUnit; conductivity label → conductivityUnit;
  //     battery voltage transform/label → voltageUnit)
  //   - the CSV export (column headers reflect the user's units)
  // useDisplayPreferences memoizes the returned object so referencing
  // it in the chartConfigs useMemo deps below is stable.
  const displayPrefs = useDisplayPreferences();
  // tempUnit drives chart configs + CSV headers; timezone drives the chart
  // axis + tooltip valueFormatters below so all time labels render in the
  // user's saved Display timezone (null falls back to browser-local).
  const { tempUnit, timezone } = displayPrefs;

  // Chart configs derived from preferences. A unit change in Account
  // Settings → Display flips displayPrefs, this useMemo recomputes,
  // and every downstream consumer (chartSeriesByField, the chart
  // renderer, the enlarged-chart lookup, the CSV export) sees the new
  // transforms + unit labels.
  // Time range derived from `?range=`. Three resolution paths:
  //   - `?range=Last 24 hours` → match against the preset table → use it
  //   - `?range=Custom range…` → keep as-is so the pickers render
  //   - missing or stale → fall back to DEFAULT_CHART_TIME_RANGE
  // The defensive fallback means a hand-typed URL with a typo'd range
  // value won't break the page; it just opens to the default.
  const rangeFromUrl = searchParams.get(RANGE_PARAM);
  const timeRange = useMemo(() => {
    if (!rangeFromUrl) return DEFAULT_CHART_TIME_RANGE;
    if (rangeFromUrl === CUSTOM_RANGE_LABEL) return CUSTOM_RANGE_LABEL;
    if (findChartTimeRange(rangeFromUrl)) return rangeFromUrl;
    return DEFAULT_CHART_TIME_RANGE;
  }, [rangeFromUrl]);

  // Writes the range to the URL. Used by the dropdown's onChange.
  // Deletes the param when the user picks the DEFAULT so the URL stays
  // clean for the most common state — same convention as
  // sensor-measurements.jsx.
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

  // Chart panel state — mirrors sensor-measurements.jsx so the
  // wireless-sensor chart panel behaves identically to the device
  // chart panel (custom range pickers, loading indicator, enlarge
  // dialog, etc.).
  const [customFromTime, setCustomFromTime] = useState(null);
  const [customToTime, setCustomToTime] = useState(null);
  const isCustomRange = timeRange === CUSTOM_RANGE_LABEL;

  // Chart-panel category + probe filter. Both live here (rather than inside
  // WirelessMeasurementsPanel) so they can sit in the same toolbar row as
  // the time-range select and the Download button. The probe toggle is only
  // rendered on Soil / All (computed via `showProbeToggle` below) but the
  // state value is preserved across category switches so flipping to Light
  // and back to Soil restores the user's last probe pick.
  const [selectedCategory, setSelectedCategory] = useState(WIRELESS_CATEGORY_IDS.WEATHER);
  // Panel speaks 'both' | '1' | '2' for its probe filter.
  const [selectedProbe, setSelectedProbe] = useState('both');
  const showProbeToggle = selectedCategory === WIRELESS_CATEGORY_IDS.SOIL || selectedCategory === WIRELESS_CATEGORY_IDS.ALL;

  // Currently-enlarged chart key. null = closed; otherwise the
  // config.key of the chart being displayed in the Dialog.
  // Map view derived from `?view=map`. Same URL-as-source-of-truth
  // pattern the chart range uses above — auditable + shareable + the
  // back button gives honest history between distinct view states.
  // `setIsMapView` accepts both a boolean and a functional updater
  // shape (`(prev) => next`) so existing onClick handlers like
  // `setIsMapView((prev) => !prev)` keep working without per-call-
  // site changes.
  const viewFromUrl = searchParams.get(VIEW_PARAM);
  const isMapView = viewFromUrl === VIEW_PARAM_MAP_VALUE;
  const setIsMapView = useCallback(
    (nextValue) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const wasMap = prev.get(VIEW_PARAM) === VIEW_PARAM_MAP_VALUE;
        const resolved = typeof nextValue === 'function' ? nextValue(wasMap) : nextValue;
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

  // PheNode selection comes from the shared, session-scoped SelectionContext
  // so it persists across pages and only resets on logout. `selectedPhenodeId`
  // is null until the device list loads and the provider resolves the
  // explicit-or-recency default.
  const { selectedPheNodeId, selectPheNode } = useSelection() ?? {};
  const selectedPhenodeId = selectedPheNodeId ?? null;

  // Wireless-sensor sub-selection stays page-local — this dropdown only
  // exists here and is scoped to the selected PheNode's cohort. `undefined`
  // is the "uninitialized" sentinel the auto-default effect below keys off of
  // (vs `null` = user explicitly cleared).
  const [selectedSensorId, setSelectedSensorId] = useState(undefined);

  // Info-card state (mode + soil-probe selection) lives in a hook so we can
  // pass it directly to MapView without prop-drilling four setters.
  const { infoCardMode, setInfoCardMode, selectedSoilProbe, setSelectedSoilProbe, isSoilDataMode } = useInfoCard();
  const [isMapToggleHovered, setIsMapToggleHovered] = useState(false);
  const [isInfoToggleHovered, setIsInfoToggleHovered] = useState(false);

  // Live data hooks — devices for the PheNode dropdown + sensor-cohort
  // membership; sensors for the wireless-sensor dropdown; detail for
  // the Sensor Information / Soil Data cards' richer fields (altitude,
  // soil-probe metrics, probes connected).
  const { devices, isLoading: devicesLoading } = useMyDevices();
  const { sensors, isLoading: sensorsLoading, mutate: mutateSensors } = useMyWirelessSensors();
  const { accessToken } = useAuth();

  // Deep-link entry point — `?sensor=<externalSensorId>` written by the
  // wireless-sensor fleet card click handler. When present and valid
  // (sensor exists in the user's list AND has a parent PheNode in the
  // user's devices), we seed BOTH dropdowns to that sensor's pair.
  // When absent or invalid, the existing recency-based defaults take
  // over.
  //
  // Mirrors the URL-as-source-of-truth pattern used in
  // sections/sensor-measurements/sensor-measurements.jsx — refresh-safe,
  // shareable, and gives the back button honest history between
  // distinct sensor selections. The same `searchParams`/`setSearchParams`
  // pair is shared with the view + range derivations at the top of the
  // component, so all URL writes flow through one instance.
  const sensorFromUrl = searchParams.get(SENSOR_PARAM);

  // Resolve the URL sensor into a { sensorId, phenodeId } pair, or null
  // if the URL value is missing/invalid. Returns null when:
  //   - no URL param
  //   - sensor not yet loaded (validation can't run)
  //   - URL sensor isn't in the user's sensor list (e.g. the user
  //     deep-linked an externalSensorId that's since been removed)
  //   - URL sensor has no parent PheNode in the user's devices
  //     (orphaned sensor — shouldn't normally happen, but we degrade
  //     gracefully rather than wedging the dropdowns)
  //
  // The stale-URL cleanup effect below removes the param in any of the
  // "invalid" cases so back/forward + reload don't keep pointing at a
  // phantom selection.
  const urlSensorResolution = useMemo(() => {
    if (!sensorFromUrl || !sensors || !devices) return null;
    const sensorExists = sensors.some((s) => s.externalSensorId === sensorFromUrl);
    if (!sensorExists) return null;
    const parentDevice = devices.find((d) => d.wireless_sensors?.some((ws) => ws.external_sensor_id === sensorFromUrl));
    if (!parentDevice) return null;
    return { sensorId: sensorFromUrl, phenodeId: parentDevice.external_device_id };
  }, [sensorFromUrl, sensors, devices]);

  // Chart panel time window. Three branches: custom range with both
  // pickers filled and ordered, custom range mid-input (falls back
  // to DEFAULT preset to avoid blank chart), or preset. Same shape
  // as sensor-measurements.jsx — see that file's matching memo for
  // the full rationale.
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

  const xAxisTicks = useMemo(() => computeAxisTicks(from, to, axisFormat), [from, to, axisFormat]);

  // Wireless-sensor measurement time series for the active sensor.
  // bucket: 'auto' lets the backend pick aggregation by time range
  // (raw for short, bucketed for long). Field projection trims the
  // payload to what the 6 charts actually render.
  const {
    rows: measurementRows,
    isLoading: measurementsLoading,
    isValidating: measurementsValidating
  } = useWirelessSensorMeasurements(selectedSensorId, {
    from,
    to,
    fields: WIRELESS_SENSOR_CHART_FIELDS,
    bucket: 'auto'
  });

  // Selection-change loading indicator — fires for any
  // user-initiated SWR-key change but stays quiet on the 60s
  // background poll. See sensor-measurements.jsx for the full
  // pattern; identical logic.
  const selectionKey = useMemo(
    () => `${selectedSensorId ?? ''}|${from?.getTime() ?? ''}|${to?.getTime() ?? ''}`,
    [selectedSensorId, from, to]
  );
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
  const showSelectionLoading = measurementsLoading || isFetchingSelection;

  // Shared time array — used as the X-axis data for every chart so
  // all six render on the same horizontal scale.
  // Per-chart, per-series values aligned to chartTimes. Nulls
  // preserved (with connectNulls: true on the series so the line
  // stays continuous over gaps). Multi-series charts (Soil Temp /
  // Moisture / Conductivity) return one entry per probe; single-line
  // charts (Battery / Lux / RSSI) return one entry total.
  //
  // We keep nulls here (instead of the per-chart filter pattern used
  // in sensor-measurements.jsx) because the multi-series case would
  // require independent per-series X axes to truly drop them — a
  // bigger refactor than buying back the few "No data" tooltips that
  // appear at rare missing readings. Both probes typically report
  // together, so these gaps are uncommon in practice.
  const infoCardTitle = isSoilDataMode ? 'Soil Data' : 'Sensor Information';
  const infoCardTooltipTitle = isSoilDataMode ? 'Sensor Info.' : 'Soil Data';
  const infoCardToggleIcon = isSoilDataMode
    ? isInfoToggleHovered
      ? wsFleetIconActive
      : wsFleetIcon
    : isInfoToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive;
  const mapToggleIcon = isMapView
    ? isMapToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive
    : isMapToggleHovered
      ? mapIconActive
      : mapIconInactive;
  const sectionTitle = isMapView ? 'Sensor Overview' : 'Wireless Sensor Measurements';
  const mapToggleTooltip = isMapView ? 'Sensor Overview' : 'Map View';

  // PheNode selection now comes from the shared, session-scoped
  // SelectionContext (see contexts/SelectionContext.jsx). The recency
  // default + freeze that used to live here as local state has moved up to
  // that provider so the selection is stable across BOTH the 60s SWR poll
  // and navigation between pages — a PheNode that reported in the gap
  // between two page loads can no longer swap the selection out from under
  // the user.
  //
  // Deep-link bridge: a `?sensor=` URL resolves to a parent PheNode (see
  // urlSensorResolution above). When the user lands here from a fleet-card
  // click, that parent is the PheNode they expect selected, so we push it
  // into the shared selection as an explicit pick — promoting it past
  // recency, and making it stick app-wide. selectPheNode no-ops on an
  // unchanged id, so re-running on every render is cheap.
  useEffect(() => {
    if (urlSensorResolution?.phenodeId) selectPheNode?.(urlSensorResolution.phenodeId);
  }, [urlSensorResolution, selectPheNode]);

  // Stale-URL cleanup. If the URL referenced a sensor that is no longer
  // resolvable (sensor was removed, parent PheNode was unassigned,
  // etc.), drop the param so back/forward + reload don't keep pointing
  // at a phantom selection. Mirrors the cleanup pattern in
  // sensor-measurements.jsx.
  //
  // Only runs once both data sources have loaded — checking before then
  // would spuriously fire and wipe a perfectly valid deep link during
  // the brief window between mount and first SWR resolution.
  //
  // We delete the param with `replace: true` so the cleanup doesn't
  // create a new history entry; the previous URL (which presumably did
  // hold a valid value) stays the back-button target.
  useEffect(() => {
    if (!sensorFromUrl) return;
    if (!sensors || !devices) return;
    if (urlSensorResolution) return; // URL value is valid — leave it alone.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SENSOR_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [sensorFromUrl, sensors, devices, urlSensorResolution, setSearchParams]);

  // Sensor cohort = wireless sensors paired to the selected PheNode.
  // The DeviceRead carries a `wireless_sensors[]` field of
  // { id, external_sensor_id, label } — see services/schemas/device.js.
  // We collect the external IDs into a Set for O(1) membership checks
  // when filtering the full sensor list below.
  const connectedSensorIds = useMemo(() => {
    if (!selectedPhenodeId || !devices) return new Set();
    const selected = devices.find((d) => d.external_device_id === selectedPhenodeId);
    if (!selected?.wireless_sensors?.length) return new Set();
    return new Set(selected.wireless_sensors.map((s) => s.external_sensor_id));
  }, [devices, selectedPhenodeId]);

  // The sensors visible in the dropdown — the full list filtered down
  // to the selected PheNode's cohort. Returns undefined while sensors
  // haven't loaded yet so the "loading" branch on the Autocomplete
  // still fires; returns [] when sensors exist but none are connected
  // to the selected PheNode (Autocomplete shows "No options").
  const filteredSensors = useMemo(() => {
    if (!sensors) return undefined;
    if (!selectedPhenodeId) return [];
    return sensors.filter((s) => connectedSensorIds.has(s.externalSensorId));
  }, [sensors, selectedPhenodeId, connectedSensorIds]);

  // Most-recently-reporting sensor in the current cohort. Same
  // -Infinity-fallback recency sort used for the PheNode default
  // above. Recomputed whenever the cohort changes (e.g. user picks a
  // different PheNode) so the "default sensor" stays meaningful.
  //
  // URL sensor wins over recency, but only if it actually lives in the
  // current cohort. We check membership against `filteredSensors` (the
  // selected-PheNode-scoped list) rather than `sensors` (the full
  // account list) because the cohort filter can legitimately exclude a
  // URL sensor — e.g. the user lands via deep link, then changes the
  // PheNode dropdown to a different device. In that case we drop back
  // to the new cohort's recency winner and let the stale-cleanup
  // effect below remove the now-stale URL param.
  const defaultSensorId = useMemo(() => {
    if (urlSensorResolution?.sensorId && filteredSensors?.some((s) => s.externalSensorId === urlSensorResolution.sensorId)) {
      return urlSensorResolution.sensorId;
    }
    if (!filteredSensors?.length) return null;
    const byRecency = [...filteredSensors].sort((a, b) => {
      const aTime = a.lastMeasurementAt ? new Date(a.lastMeasurementAt).getTime() : -Infinity;
      const bTime = b.lastMeasurementAt ? new Date(b.lastMeasurementAt).getTime() : -Infinity;
      return bTime - aTime;
    });
    return byRecency[0]?.externalSensorId ?? null;
  }, [filteredSensors, urlSensorResolution]);

  // FROZEN copy of the cohort's recency default. Differs from the
  // PheNode freeze in one important way: this one RESETS when the
  // user manually changes the PheNode (see the resetting useEffect
  // below) so the new cohort's most-recent sensor gets re-captured.
  // Without that reset, a PheNode change would leave the frozen
  // value pinned to the OLD cohort's most-recent sensor — which
  // doesn't exist in the new cohort and would land the dropdown on
  // a phantom selection.
  //
  // Same lifetime semantics otherwise: held stable across SWR polls,
  // resets on component unmount → remount.
  const [frozenDefaultSensorId, setFrozenDefaultSensorId] = useState(null);
  useEffect(() => {
    if (defaultSensorId && !frozenDefaultSensorId) {
      setFrozenDefaultSensorId(defaultSensorId);
    }
  }, [defaultSensorId, frozenDefaultSensorId]);
  // Reset the frozen sensor default whenever the user changes PheNode
  // so the new cohort's most-recent sensor gets captured fresh by the
  // freeze useEffect above.
  useEffect(() => {
    setFrozenDefaultSensorId(null);
  }, [selectedPhenodeId]);

  // Apply the auto-default to the sensor selection. Two clamp cases:
  //   1. Uninitialized   → pick the cohort's default.
  //   2. Stale selection → user previously picked a sensor that is no
  //      longer in the current cohort (changed PheNodes, or SWR
  //      dropped the sensor from the list). Re-default rather than
  //      stranding the user on a phantom selection.
  // Uses the FROZEN default with live fallback (same recovery
  // pattern as the PheNode effect above).
  useEffect(() => {
    if (selectedSensorId === undefined) {
      if (frozenDefaultSensorId) setSelectedSensorId(frozenDefaultSensorId);
      else if (defaultSensorId) setSelectedSensorId(defaultSensorId);
      return;
    }
    if (!filteredSensors) return;
    const stillExists = filteredSensors.some((s) => s.externalSensorId === selectedSensorId);
    if (!stillExists) {
      // Recovery path: prefer the frozen default if it's still in the
      // current cohort, else fall back to whatever's most-recent now.
      const frozenStillExists = frozenDefaultSensorId && filteredSensors.some((s) => s.externalSensorId === frozenDefaultSensorId);
      setSelectedSensorId(frozenStillExists ? frozenDefaultSensorId : (defaultSensorId ?? null));
    }
  }, [frozenDefaultSensorId, defaultSensorId, filteredSensors, selectedSensorId]);

  // The active list-item record (matches the dropdown selection).
  // Carries the lastMeasurementAt used by the page header. The detail
  // hook below provides the richer info-card fields.
  const activeSensor = useMemo(() => {
    if (!filteredSensors || !selectedSensorId) return null;
    return filteredSensors.find((s) => s.externalSensorId === selectedSensorId) ?? null;
  }, [filteredSensors, selectedSensorId]);

  // The currently-selected PheNode (DeviceRead) — passed to the map so
  // its new "PheNode" overlay button can plot the parent device when
  // toggled on. Resolved here (instead of inside the map) because
  // we already have the lookup machinery for selectedPhenodeId. Returns
  // null until devices have loaded or no PheNode is selected; the map
  // gracefully no-ops the toggle in either case.
  const activePhenode = useMemo(() => {
    if (!devices || !selectedPhenodeId) return null;
    return devices.find((d) => d.external_device_id === selectedPhenodeId) ?? null;
  }, [devices, selectedPhenodeId]);

  // Detail fetch for the selected sensor — populates Sensor Information
  // (altitude, GPS, battery, probes connected) and Soil Data
  // (soilSensors[0/1] readings). Auto-skips when no sensor is selected.
  // We don't surface the hook's loading flag right now: every consumer
  // formatter ('formatGpsCoords', 'formatAltitude', etc.) renders 'N/A'
  // for missing inputs, so the card naturally degrades to "N/A" rows
  // during the brief window between dropdown selection and detail
  // arrival. Wire `isLoading` through here when a placeholder shimmer
  // becomes desirable.
  const { sensor: sensorDetail } = useWirelessSensorDetail(selectedSensorId);

  // Autocomplete options for both dropdowns. Object form `{ id, label }`
  // is what MUI Autocomplete prefers (id for equality, label for
  // display). Falls back to the immutable identifier when no label is
  // set so a freshly provisioned device/sensor is still pickable.
  const phenodeOptions = useMemo(
    () =>
      (devices ?? []).map((device) => ({
        id: device.external_device_id,
        label: device.label || device.external_device_id
      })),
    [devices]
  );
  const phenodeValue = phenodeOptions.find((opt) => opt.id === selectedPhenodeId) ?? null;

  const sensorOptions = useMemo(
    () =>
      (filteredSensors ?? []).map((sensor) => ({
        id: sensor.externalSensorId,
        label: sensor.label || sensor.externalSensorId
      })),
    [filteredSensors]
  );
  const sensorValue = sensorOptions.find((opt) => opt.id === selectedSensorId) ?? null;

  // Header "Last Measurements Taken:" string — uses the same
  // formatLastMeasurement transform as the fleet view so the date
  // vocabulary ("Never" / "Unknown" / localized timestamp) is consistent.
  const lastMeasurementsDisplay = activeSensor ? formatLastMeasurement(activeSensor.lastMeasurementAt, timezone) : '—';

  // Diagram-heading identifier — the real MAC address. Backend now
  // exposes `macAddress` (12-char lowercase hex, no separators) on
  // both the list summary and the detail endpoint, derived from the
  // externalSensorId's WS-<MAC> suffix or from the latest reading's
  // `wirelessDeviceMac`/`mac` field (see
  // phenodeX/phenode_backend/api/wireless_sensors/routes.py:39-57).
  // We prefer the detail-fetch value (always fresh against the latest
  // reading); fall back to the list-summary `macAddress` for the brief
  // window between dropdown selection and detail-fetch resolution; and
  // finally fall back to the externalSensorId itself so the heading
  // degrades gracefully for sensors whose external id isn't in
  // WS-<MAC> shape and that haven't reported yet. formatMacAddress
  // turns the raw 12-char hex into the canonical colon-separated
  // uppercase display ("e3452c89b6ff" → "E3:45:2C:89:B6:FF") or
  // returns "—" for missing input.
  const macAddressRaw = sensorDetail?.macAddress ?? activeSensor?.macAddress ?? null;
  const diagramIdentifier = macAddressRaw ? formatMacAddress(macAddressRaw) : (selectedSensorId ?? '—');

  // Soil-data rows for the active probe. Built once per detail/probe
  // change so the .map() in the render branch doesn't recompute on
  // every parent render.
  const activeSoilReadings = useMemo(
    () => buildSoilReadings(sensorDetail, selectedSoilProbe, tempUnit),
    [sensorDetail, selectedSoilProbe, tempUnit]
  );

  // ---- Rename card -------------------------------------------------------
  // Local controlled state for the Rename TextField. Reset whenever the
  // selected sensor changes so the input doesn't carry stale text from
  // a different sensor's rename attempt.
  const [renameInput, setRenameInput] = useState('');
  // Toast hook — used by both rename and download handlers below.
  // Routes through providers/ToastProvider so rename feedback uses the
  // same themed surface as every other toast in the app (no more
  // bespoke MUI Snackbar+Alert).
  const toast = useToast();

  // `renameDraft` is the same {externalId, oldName, newName} payload
  // FleetOverviewView uses to drive its ConfirmRenameModal — kept as a
  // single object so we never get into a half-open modal where one
  // field is set and another isn't. `null` = modal closed; non-null =
  // modal open with that draft.
  //
  // Mirroring the fleet view's pattern (instead of two states for
  // "open" + "draft data") means the modal only exists in one
  // consistent state at any given time, and the same Continue/Cancel
  // contract applies on both pages — a user who has renamed a device
  // before sees the same modal behavior here.
  const [renameDraft, setRenameDraft] = useState(null);

  useEffect(() => {
    setRenameInput('');
  }, [selectedSensorId]);

  // Compute the OLD name once for the modal. Same fallback chain the
  // dropdown uses (label || externalSensorId) so the modal text matches
  // what the user just saw in the dropdown.
  const activeSensorOldName = activeSensor?.label || activeSensor?.externalSensorId || '';

  // Open the confirm-rename modal. Inline-guards on the no-sensor and
  // empty-input cases so the button reads as always-active (per user
  // request) but a stray click before a selection reads as a no-op
  // rather than throwing or opening an empty modal.
  //
  // The modal is what owns the actual PUT — see handleConfirmRename
  // below. This function only sets the draft.
  const handleOpenRenameModal = useCallback(() => {
    const trimmed = renameInput.trim();
    if (!selectedSensorId || !trimmed) return;
    setRenameDraft({
      // externalId stays the actual external_sensor_id for the
      // mutation; the MAC below is a display-only field the modal
      // surfaces in its hardware-id badge.
      externalId: selectedSensorId,
      // Pre-formatted MAC (e.g. "E3:45:2C:89:B6:FF") so the modal
      // can render it directly. Uses the same `macAddressRaw` value
      // the diagram heading reads from, so the badge and the heading
      // are always in lockstep. Null when neither the detail-fetch
      // nor the list-summary carries a MAC — the modal falls back to
      // displaying externalId in that case.
      macAddress: macAddressRaw ? formatMacAddress(macAddressRaw) : null,
      oldName: activeSensorOldName,
      newName: trimmed
    });
  }, [activeSensorOldName, macAddressRaw, renameInput, selectedSensorId]);

  // Continue handler — runs when the user confirms inside the modal.
  // Performs the PUT, revalidates the sensor list (so the dropdown
  // label updates immediately), surfaces a success/error toast, and
  // closes the modal on success. Mirror of FleetOverviewView's
  // handleConfirmRename.
  //
  // Modal behavior on error: stays OPEN so the user can read the
  // failure detail and retry without re-typing the new name. The
  // modal's internal isSubmitting resets in its `finally`, so the
  // Continue button re-enables automatically.
  const handleConfirmRename = useCallback(async () => {
    if (!renameDraft) return;
    const { externalId, newName } = renameDraft;
    try {
      await renameSensor(externalId, newName, accessToken);
      await mutateSensors();
      setRenameInput('');
      setRenameDraft(null);
      toast.success(`Renamed sensor to "${newName}".`);
    } catch (err) {
      // ApiError carries `.detail` from the backend; fall back to a
      // generic message for non-API errors (network blip etc.).
      const detail = err?.detail || err?.message || 'Failed to rename sensor';
      toast.error(detail);
      // Intentionally do NOT clear renameDraft — modal stays open for
      // retry.
    }
  }, [accessToken, mutateSensors, renameDraft, toast]);

  // Note: the Rename button is intentionally NOT disabled — the
  // open-modal handler already guards against the no-sensor and
  // empty-input cases by returning early. Pressing Rename with nothing
  // entered just no-ops; pressing it with valid input opens the
  // confirmation modal. The modal owns its own in-flight state so a
  // double-click on Continue can't fire two PUTs.

  // Map-mode rename callback — passed to WirelessSensorFleetMap so its
  // internal ConfirmRenameModal can reuse our renameSensor mutation +
  // sensor-list revalidation. Distinct from handleConfirmRename above
  // because the map owns its own modal (it's its own self-contained
  // surface), not the diagram-mode rename draft. Errors propagate so
  // the map can surface them in its toast and keep the modal open.
  const handleMapRename = useCallback(
    async (externalSensorId, newLabel) => {
      await renameSensor(externalSensorId, newLabel, accessToken);
      await mutateSensors();
    },
    [accessToken, mutateSensors]
  );

  // ---------------------------------------------------------------------------
  // Archive download — backend POST → Blob → browser save.
  //
  // The backend reads data_download_preferences from the DB and applies
  // them to each per-sensor CSV before zipping. We only request ONE
  // sensor (the currently-selected one) from the inline button here;
  // the dedicated Data Downloads page will support multi-sensor
  // exports by passing a comma-separated list to the same endpoint.
  // ---------------------------------------------------------------------------
  // `toast` is declared earlier (alongside the rename handlers) so both
  // surfaces share the same themed ToastProvider hook.
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!activeSensor?.externalSensorId || downloading) return;
    setDownloading(true);
    try {
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const { blob, filename } = await downloadWirelessSensorData(activeSensor.externalSensorId, fromIso, toIso, accessToken);
      const ext = extensionFromBackendFilename(filename);
      const label = sensorLabelToFilenameSlug(activeSensor.label || activeSensor.externalSensorId);
      const saveAs = `${label}_${dateToFilenameSlug(from)}_${dateToFilenameSlug(to)}.${ext}`;
      triggerBlobDownload(blob, saveAs);
      toast.success('Download started.');
    } catch (err) {
      // 404 means no rows in the requested range — friendlier copy
      // than the generic catch-all so the user knows to widen the
      // window rather than think the export is broken.
      if (err?.status === 404) {
        toast.error('No data found in this date range.');
      } else {
        const detail = err?.detail;
        toast.error(detail ? `Couldn't download: ${detail}` : "Couldn't generate the download. Please try again.");
      }
    } finally {
      setDownloading(false);
    }
  }, [activeSensor, from, to, accessToken, downloading, toast]);

  // Clear the `?sensor` URL param. Called by the dropdown change
  // handlers below — once the user picks something different from the
  // deep-linked sensor, the URL param no longer reflects the user's
  // intent and a subsequent refresh shouldn't rewind their choice. The
  // existing stale-cleanup effect doesn't catch this case because the
  // URL value is still technically resolvable; "the user chose
  // otherwise" isn't a validity signal it can detect.
  //
  // Wrapped in useCallback so the inline onChange handlers stay
  // referentially stable across renders. `replace: true` avoids
  // polluting history with a no-content URL change.
  const clearSensorUrlParam = useCallback(() => {
    if (!sensorFromUrl) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SENSOR_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [sensorFromUrl, setSearchParams]);

  return (
    <>
      {/*
        Mount the shared SVG <filter> defs once at the top of the
        tree. Provides the chart-glow-full / chart-glow-lite ids that
        the chartSx + MeasurementsChartGrid filter rules reference
        via `filter: url(#chart-glow-full)`. The same component
        renders on sensor-measurements so both pages' chart glows
        are pixel-identical. See components/ChartGlowDefs.jsx.
      */}
      <ChartGlowDefs />
      <MainCard content={false} sx={{ overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
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
              {sectionTitle}
            </Typography>
            <Typography
              variant="subtitle1"
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

        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2.5, gap: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Autocomplete
                options={phenodeOptions}
                value={phenodeValue}
                onChange={(_, newValue) => {
                  // Switching PheNode invalidates the sensor selection
                  // (different cohort). Reset to undefined so the
                  // auto-default effect repopulates with the new cohort's
                  // most-recently-reporting sensor instead of stranding
                  // the dropdown on a stale ID. Also clear any
                  // deep-link `?sensor` param — the user has explicitly
                  // moved off the URL-targeted PheNode/sensor pair.
                  selectPheNode?.(newValue?.id ?? null);
                  setSelectedSensorId(undefined);
                  clearSensorUrlParam();
                }}
                loading={devicesLoading}
                loadingText="Loading PheNodes…"
                noOptionsText="No PheNodes available"
                isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                sx={{ width: { xs: 170, sm: 220 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={devicesLoading ? 'Loading…' : 'Select PheNode...'}
                    size="small"
                    sx={{
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
                    }}
                  />
                )}
                slotProps={{
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
                }}
              />

              <Autocomplete
                options={sensorOptions}
                value={sensorValue}
                onChange={(_, newValue) => {
                  // Manual sensor change — drop the deep-link `?sensor`
                  // param so a subsequent refresh doesn't rewind the
                  // user's pick to the URL-targeted sensor.
                  setSelectedSensorId(newValue?.id ?? null);
                  clearSensorUrlParam();
                }}
                loading={sensorsLoading}
                loadingText="Loading sensors…"
                noOptionsText={selectedPhenodeId ? 'No sensors connected to this PheNode' : 'Select a PheNode first'}
                isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                disabled={!selectedPhenodeId}
                sx={{ width: { xs: 190, sm: 250 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={sensorsLoading ? 'Loading…' : 'Select Wireless Sensor...'}
                    size="small"
                    sx={{
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
                    }}
                  />
                )}
                slotProps={{
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
                }}
              />
            </Stack>

            <Tooltip title={mapToggleTooltip} arrow={false} slotProps={tooltipSlotProps}>
              <IconButton
                aria-label={isMapView ? 'sensor overview' : 'map view'}
                onClick={() => setIsMapView((prev) => !prev)}
                onMouseEnter={() => setIsMapToggleHovered(true)}
                onMouseLeave={() => setIsMapToggleHovered(false)}
                onFocus={() => setIsMapToggleHovered(true)}
                onBlur={() => setIsMapToggleHovered(false)}
                sx={{
                  border: '1px solid var(--reflected-light)',
                  color: 'var(--blue)',
                  ...drawerNavButtonSurfaceSx,
                  boxShadow: '0 11px 19px 1px #0000002e',
                  '&:hover': { borderColor: 'var(--green)' }
                }}
              >
                <Box component="img" src={mapToggleIcon} alt="" sx={{ width: 21, height: 21 }} />
              </IconButton>
            </Tooltip>
          </Stack>

          <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
            {isMapView ? (
              <Grid size={{ xs: 12 }}>
                <WirelessSensorFleetMap
                  // Full account-wide sensor list — the map plots
                  // ALL sensors, not just the selected PheNode's
                  // cohort, because the geographic relationships the
                  // map exists to surface (Nearby radius especially)
                  // are inherently account-wide concerns.
                  sensors={sensors}
                  selectedSensorId={selectedSensorId}
                  // Pin click + nearby-list click → flip the dropdown
                  // selection. clearSensorUrlParam keeps the URL in
                  // sync with manual moves, mirroring the Autocomplete
                  // change handlers above so behavior is consistent
                  // regardless of where the user clicks.
                  onSelectSensor={(id) => {
                    setSelectedSensorId(id);
                    clearSensorUrlParam();
                  }}
                  activeSensor={activeSensor}
                  sensorDetail={sensorDetail}
                  // Parent PheNode for the new "PheNode" overlay toggle
                  // — passed in pre-resolved so the map doesn't have to
                  // know about devices[].wireless_sensors[] lookup.
                  parentDevice={activePhenode}
                  infoCardMode={infoCardMode}
                  setInfoCardMode={setInfoCardMode}
                  selectedSoilProbe={selectedSoilProbe}
                  setSelectedSoilProbe={setSelectedSoilProbe}
                  onRename={handleMapRename}
                  isLoading={sensorsLoading}
                />
              </Grid>
            ) : (
              <>
                <Grid size={{ xs: 12, lg: 8 }} sx={{ display: 'flex' }}>
                  <Box
                    sx={{
                      borderRadius: 1,
                      p: { xs: 1.5, sm: 2 },
                      width: '100%',
                      height: '100%',
                      ...drfSurfaceSx,
                      ...reflectedCardChromeSx
                    }}
                  >
                    <Box sx={{ width: diagramWidthSx, mx: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Typography variant="body1" sx={{ width: '100%', textAlign: 'center', fontWeight: 600, pt: { xs: 0.25, sm: 0.5 } }}>
                        <Box component="span" sx={{ color: 'var(--blue)' }}>
                          [ MAC ADDR:
                        </Box>{' '}
                        <Box component="span" sx={{ color: 'var(--green)', textShadow: '0 1px 9px #1a75e0c9' }}>
                          {diagramIdentifier}
                        </Box>{' '}
                        <Box component="span" sx={{ color: 'var(--blue)' }}>
                          ]
                        </Box>
                      </Typography>

                      <Box
                        sx={{
                          mt: { xs: 2.5, lg: 'auto' },
                          pb: 0,
                          lineHeight: 0,
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center'
                        }}
                      >
                        <Box
                          component="img"
                          src={wirelessSensorsDiagram}
                          alt="Wireless sensor network diagram"
                          sx={{
                            width: '100%',
                            maxHeight: { xs: 250, sm: 330, md: 400, lg: 350 },
                            objectFit: 'contain',
                            display: 'block',
                            transform: { xs: 'translateY(8px)', sm: 'translateY(10px)' },
                            mb: 0,
                            pb: 0
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, lg: 4 }} sx={{ display: 'flex' }}>
                  <Stack spacing={2.5} sx={{ width: '100%', height: '100%' }}>
                    <Box
                      sx={{
                        borderRadius: 1,
                        p: { xs: 1.5, sm: 2 },
                        ...drfSurfaceSx,
                        ...reflectedCardChromeSx,
                        '& .info-card-green-text': {
                          color: 'var(--green)',
                          textShadow: '0 1px 9px #1a75e0c9'
                        }
                      }}
                    >
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h5" sx={{ color: '#646cff' }}>
                          {infoCardTitle}
                        </Typography>
                        <Tooltip title={infoCardTooltipTitle} arrow={false} slotProps={tooltipSlotProps}>
                          <IconButton
                            aria-label={isSoilDataMode ? 'show sensor info' : 'show soil data'}
                            onClick={() => setInfoCardMode((prev) => (prev === 'soil' ? 'sensor' : 'soil'))}
                            onMouseEnter={() => setIsInfoToggleHovered(true)}
                            onMouseLeave={() => setIsInfoToggleHovered(false)}
                            onFocus={() => setIsInfoToggleHovered(true)}
                            onBlur={() => setIsInfoToggleHovered(false)}
                            sx={{
                              border: '1px solid var(--reflected-light)',
                              color: 'var(--blue)',
                              ...drawerNavButtonSurfaceSx,
                              boxShadow: '0 11px 19px 1px #0000002e',
                              '&:hover': { borderColor: 'var(--green)' }
                            }}
                          >
                            <Box component="img" src={infoCardToggleIcon} alt="" sx={{ width: 22, height: 22 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>

                      {isSoilDataMode ? (
                        <>
                          <ToggleButtonGroup
                            exclusive
                            value={selectedSoilProbe}
                            onChange={(_, nextValue) => {
                              if (nextValue) setSelectedSoilProbe(nextValue);
                            }}
                            size="small"
                            sx={{
                              mb: 2,
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              '& .MuiToggleButtonGroup-grouped': {
                                border: '1px solid var(--reflected-light) !important',
                                borderRadius: '6px !important',
                                color: 'var(--blue)',
                                backgroundColor: 'rgba(0, 20, 61, 0.72)',
                                textTransform: 'none',
                                fontWeight: 600
                              },
                              '& .MuiToggleButtonGroup-grouped:first-of-type': {
                                borderTopRightRadius: '0 !important',
                                borderBottomRightRadius: '0 !important'
                              },
                              '& .MuiToggleButtonGroup-grouped:last-of-type': {
                                borderTopLeftRadius: '0 !important',
                                borderBottomLeftRadius: '0 !important'
                              },
                              '& .Mui-selected': {
                                color: 'var(--green) !important',
                                backgroundColor: 'rgba(72, 247, 245, 0.12) !important'
                              }
                            }}
                          >
                            <ToggleButton value="probe-1">Soil Probe 1</ToggleButton>
                            <ToggleButton value="probe-2">Soil Probe 2</ToggleButton>
                          </ToggleButtonGroup>

                          <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                            {activeSoilReadings.map((reading) => (
                              <Box key={reading.label} sx={{ display: 'contents' }}>
                                <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                                  {reading.label}
                                </Typography>
                                <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                                  {reading.value}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </>
                      ) : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                          <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                            Sensor ID:
                          </Typography>
                          <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                            {selectedSensorId ?? 'N/A'}
                          </Typography>

                          <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                            GPS:
                          </Typography>
                          <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatGpsCoords(sensorDetail?.location?.latitude, sensorDetail?.location?.longitude)}
                          </Typography>

                          <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                            Altitude:
                          </Typography>
                          <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatAltitude(sensorDetail?.location?.altitude)}
                          </Typography>

                          <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                            Battery:
                          </Typography>
                          <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatBatteryPercent(sensorDetail?.battery?.batteryPercent ?? activeSensor?.batteryPercent)}
                          </Typography>

                          <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                            Probes Connected:
                          </Typography>
                          <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                            {countConnectedProbes(sensorDetail?.soilProbesConnected)}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, flexGrow: 1, ...drfSurfaceSx, ...reflectedCardChromeSx }}>
                      <Stack sx={{ height: '100%', justifyContent: 'center', alignItems: 'center' }} spacing={2}>
                        <Typography variant="h5" sx={{ textAlign: 'center', color: 'var(--blue)' }}>
                          Rename this Sensor:
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={selectedSensorId ? 'Enter new sensor name' : 'Select a sensor first'}
                          value={renameInput}
                          onChange={(event) => setRenameInput(event.target.value)}
                          onKeyDown={(event) => {
                            // Submit on Enter for keyboard parity with the
                            // Rename button. preventDefault keeps the field
                            // from submitting any ancestor form (none today,
                            // but defensive). handleOpenRenameModal owns
                            // the guard logic (no sensor / empty input),
                            // so a fire-and-forget call here matches the
                            // button's behavior — no click-vs-Enter drift.
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleOpenRenameModal();
                            }
                          }}
                          disabled={!selectedSensorId}
                          sx={{
                            maxWidth: 320,
                            '& .MuiOutlinedInput-root': {
                              minHeight: 40,
                              borderStyle: 'none none solid',
                              borderWidth: '1px 1px 2px',
                              borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
                              color: 'var(--blue)',
                              backgroundColor: '#00143642',
                              boxShadow: 'inset 1px 4px 5px #0003',
                              borderRadius: 1,
                              '&:hover:not(.Mui-disabled)': {
                                borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light) !important',
                                boxShadow: 'inset 1px 4px 5px #0003'
                              },
                              '&.Mui-focused': {
                                borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light) !important',
                                boxShadow: 'inset 1px 4px 5px #0003'
                              },
                              '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                              }
                            },
                            '& .MuiInputBase-input': {
                              color: 'var(--blue)',
                              textAlign: 'center',
                              '&::placeholder': {
                                color: 'var(--blue)',
                                opacity: 1
                              }
                            }
                          }}
                          inputProps={{ 'aria-label': 'Rename sensor input' }}
                        />
                        <Button
                          variant="outlined"
                          onClick={handleOpenRenameModal}
                          sx={{
                            minWidth: 140,
                            color: 'var(--green)',
                            borderColor: 'var(--orange)',
                            transition: 'none',
                            '&:hover': {
                              borderColor: 'var(--green)',
                              boxShadow: '0 0 7px -5px var(--green)',
                              color: 'var(--green)',
                              textShadow: '0 1px 5px #007bff',
                              backgroundColor: 'rgba(72, 247, 245, 0.08)'
                            },
                            // The button is never disabled today, but
                            // keep this rule so a future re-introduction
                            // of the disabled state degrades gracefully
                            // (still readable, just dimmer) instead of
                            // greying out unexpectedly.
                            '&.Mui-disabled': {
                              color: 'var(--green)',
                              borderColor: 'var(--orange)',
                              opacity: 0.6
                            }
                          }}
                        >
                          Rename
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </Grid>
              </>
            )}

            <Grid size={{ xs: 12 }}>
              <Box
                sx={{
                  borderRadius: 1,
                  p: { xs: 1.5, sm: 2 },
                  ...drfSurfaceSx,
                  ...reflectedCardChromeSx
                }}
              >
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                    Measurements Over Time
                  </Typography>
                  {/*
                    Title-row corner control. Mirrors the sensor-measurements
                    + system-diagnostics pattern:
                      - Desktop (md+): orientation toggle. Row/column swap
                        is meaningful when there's room for a multi-column
                        chart grid.
                      - Mobile (xs): CSV download. Orientation has no
                        purpose at xs (the chart grid is already a single
                        column), and the toolbar download below would
                        otherwise crowd the category Select on a narrow
                        viewport — hoisting it up here clears the toolbar.
                  */}
                  <Tooltip title="Orientation" arrow={false} slotProps={tooltipSlotProps}>
                    <IconButton
                      aria-label="toggle sensor chart layout"
                      onClick={() => setChartLayout((prev) => (prev === 'column' ? 'row' : 'column'))}
                      sx={{ ...orientationButtonSx, display: { xs: 'none', md: 'inline-flex' } }}
                    >
                      <AntIcon icon={AppstoreOutlined} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip
                    title={measurementRows?.length ? 'Download CSV for this range' : 'No data to download'}
                    arrow={false}
                    slotProps={tooltipSlotProps}
                  >
                    {/* Span wrapper keeps the tooltip working while the
                        button is disabled. */}
                    <Box component="span" sx={{ display: { xs: 'inline-flex', md: 'none' }, flexShrink: 0 }}>
                      <IconButton
                        aria-label="download csv for this range"
                        onClick={handleDownload}
                        disabled={!measurementRows?.length || downloading || !activeSensor?.externalSensorId}
                        sx={{
                          color: 'var(--blue)',
                          border: '1px solid var(--reflected-light)',
                          borderRadius: 1,
                          backgroundColor: 'var(--drf)',
                          boxShadow: '0 11px 19px 1px #0000002e',
                          '&:hover': { color: 'var(--green)', borderColor: 'var(--green)', backgroundColor: 'var(--drf)' },
                          '&.Mui-disabled': {
                            color: 'var(--med-grey)',
                            borderColor: 'var(--med-grey)',
                            backgroundColor: '#01113d'
                          }
                        }}
                      >
                        {downloading ? (
                          <CircularProgress size={16} sx={{ color: 'var(--green)' }} />
                        ) : (
                          <AntIcon icon={DownloadOutlined} />
                        )}
                      </IconButton>
                    </Box>
                  </Tooltip>
                </Stack>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                          sx={{
                            color: 'var(--green)',
                            border: '1px solid var(--reflected-light)',
                            borderRadius: 1,
                            backgroundColor: 'rgba(0, 20, 61, 0.72)',
                            boxShadow: '0 11px 19px 1px #0000002e',
                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                            '& .MuiSelect-icon': { color: 'var(--blue)' }
                          }}
                          MenuProps={{ PaperProps: neonSelectMenuPaperProps }}
                          renderValue={(selected) => (
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <AntIcon icon={ClockCircleOutlined} style={{ color: 'var(--blue)' }} />
                              <Box component="span" sx={{ color: 'var(--green)' }}>
                                {selected}
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
                        Category selector — mirrors the time-range Select's
                        styling so the two controls read as one family, and
                        matches the device-side category dropdown
                        (sensor-measurements.jsx:1533) one-to-one. Lives next
                        to the time-range select per Jake's chart-toolbar
                        spec.
                      */}
                      <FormControl
                        size="small"
                        sx={{ minWidth: { xs: 0, sm: 200 }, width: { xs: '100%', sm: 200 }, flex: { xs: 1, sm: '0 0 auto' } }}
                      >
                        <Select
                          value={selectedCategory}
                          onChange={(event) => setSelectedCategory(event.target.value)}
                          inputProps={{ 'aria-label': 'Chart category' }}
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
                              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                {categoryIcon(selected)}
                              </Box>
                              <Box component="span" sx={{ color: 'var(--green)' }}>
                                {CATEGORY_LABELS[selected] ?? 'Category'}
                              </Box>
                            </Stack>
                          )}
                        >
                          {CATEGORY_OPTIONS.map((catId) => (
                            <MenuItem
                              key={catId}
                              value={catId}
                              sx={{
                                color: 'var(--green)',
                                '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' },
                                '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.18)' }
                              }}
                            >
                              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', mr: 1 }}>
                                {categoryIcon(catId)}
                              </Box>
                              {CATEGORY_LABELS[catId]}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Download icon button — desktop-only mirror of
                          the title-row mobile button above. Same handler
                          + disabled props in both spots; toggling via
                          `display` (not unmount) keeps focus tied to a
                          stable node if the viewport resizes mid-session.
                          Hidden on xs because the title-row corner now
                          carries the mobile download affordance. */}
                      <Tooltip
                        title={measurementRows?.length ? 'Download CSV for this range' : 'No data to download'}
                        arrow={false}
                        slotProps={tooltipSlotProps}
                      >
                        <Box component="span" sx={{ display: { xs: 'none', md: 'inline-flex' }, flexShrink: 0 }}>
                          <IconButton
                            aria-label="download csv for this range"
                            onClick={handleDownload}
                            disabled={!measurementRows?.length || downloading || !activeSensor?.externalSensorId}
                            sx={{
                              color: 'var(--blue)',
                              border: '1px solid var(--reflected-light)',
                              borderRadius: 1,
                              backgroundColor: 'var(--drf)',
                              boxShadow: '0 11px 19px 1px #0000002e',
                              '&:hover': { color: 'var(--green)', borderColor: 'var(--green)', backgroundColor: 'var(--drf)' },
                              // Disabled affordance matches the Data Downloads
                              // page so "no data" reads the same across every
                              // download surface in the app.
                              '&.Mui-disabled': {
                                color: 'var(--med-grey)',
                                borderColor: 'var(--med-grey)',
                                backgroundColor: '#01113d'
                              }
                            }}
                          >
                            {downloading ? (
                              <CircularProgress size={16} sx={{ color: 'var(--green)' }} />
                            ) : (
                              <AntIcon icon={DownloadOutlined} />
                            )}
                          </IconButton>
                        </Box>
                      </Tooltip>

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

                      {showSelectionLoading && (
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{
                            alignItems: 'center',
                            color: 'var(--green)',
                            '@keyframes phenode-sn-loading-fade-in': {
                              from: { opacity: 0 },
                              to: { opacity: 1 }
                            },
                            animation: 'phenode-sn-loading-fade-in 200ms ease-out'
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
                      Probe filter — flex-end right of the toolbar row. Only
                      mounts on the Soil and All categories (the only ones
                      that surface probe-keyed charts: the four two-probe
                      soil families). The state itself (`selectedProbe`) is
                      preserved across category switches so a flip to Light
                      and back to Soil restores the user's last pick. The
                      panel does the actual filtering — this is just the UI
                      that drives it.
                    */}
                    {showProbeToggle && (
                      <ToggleButtonGroup
                        exclusive
                        value={selectedProbe}
                        onChange={(_, next) => {
                          if (next != null) setSelectedProbe(next);
                        }}
                        size="small"
                        aria-label="probe filter"
                        sx={{
                          alignSelf: { xs: 'flex-start', sm: 'center' },
                          '& .MuiToggleButton-root': {
                            border: '1px solid var(--reflected-light) !important',
                            color: 'var(--blue)',
                            backgroundColor: 'rgba(0, 20, 61, 0.72)',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            px: '13px',
                            py: '8px'
                          },
                          '& .MuiToggleButton-root:hover': {
                            backgroundColor: 'rgba(0, 20, 61, 0.72) !important',
                            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.08), rgba(72, 247, 245, 0.08)) !important'
                          },
                          '& .Mui-selected': {
                            color: 'var(--green) !important',
                            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.2), rgba(72, 247, 245, 0.2)) !important',
                            textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
                          }
                        }}
                      >
                        <ToggleButton value="both">Both</ToggleButton>
                        <ToggleButton value="1">Probe 1</ToggleButton>
                        <ToggleButton value="2">Probe 2</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  </Stack>
                </LocalizationProvider>

                {/*
                  Categorized chart panel — single source for every wireless
                  chart on this page. Owns its own data fetch (one composite
                  SWR call across selected sensors), category dropdown, and
                  enlarge dialog. Sized off `chartLayout` (row vs column) so
                  the orientation toggle keeps working.
                */}
                <WirelessMeasurementsPanel
                  wirelessSensors={
                    activeSensor
                      ? [{ external_sensor_id: activeSensor.externalSensorId, label: activeSensor.label || activeSensor.externalSensorId }]
                      : []
                  }
                  displayPrefs={displayPrefs}
                  from={from}
                  to={to}
                  axisFormat={axisFormat}
                  xAxisTicks={xAxisTicks}
                  layout={chartLayout}
                  timezone={timezone}
                  selectedCategory={selectedCategory}
                  selectedProbe={selectedProbe}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/*
        Rename feedback is surfaced via the app-wide ToastProvider
        (toast.success / toast.error in handleConfirmRename above) so it
        uses the same themed surface as downloads and every other toast
        in the app. The previous bespoke MUI Snackbar+Alert was removed
        for visual consistency.
      */}

        {/*
        Confirmation modal for the Rename action. Single mounted
        instance — opened by setRenameDraft({...}), closed by
        setRenameDraft(null). Mirrors the mounting pattern in
        FleetOverviewView so the user sees the same modal vocabulary
        and behavior whether they rename from a fleet card or from this
        page's Rename Card.
      */}
        <ConfirmRenameModal
          open={Boolean(renameDraft)}
          entityNoun="Sensor"
          externalId={renameDraft?.externalId}
          macAddress={renameDraft?.macAddress}
          oldName={renameDraft?.oldName}
          newName={renameDraft?.newName}
          onConfirm={handleConfirmRename}
          onCancel={() => setRenameDraft(null)}
        />
      </MainCard>
    </>
  );
}
