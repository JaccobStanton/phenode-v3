import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
import { LineChart } from '@mui/x-charts/LineChart';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import ChartGlowDefs from 'components/ChartGlowDefs';
import ConfirmRenameModal from 'components/ConfirmRenameModal';
import MainCard from 'components/MainCard';
import WirelessSensorFleetMap from 'sections/wireless-sensors/wireless-sensor-fleet-map';
import useAuth from 'hooks/useAuth';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import useInfoCard from 'hooks/useInfoCard';
import useMyDevices from 'hooks/data/useMyDevices';
import useMyWirelessSensors from 'hooks/data/useMyWirelessSensors';
import useWirelessSensorDetail from 'hooks/data/useWirelessSensorDetail';
import useWirelessSensorMeasurements from 'hooks/data/useWirelessSensorMeasurements';
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
  axisTickNumberFor,
  computeAxisTicks,
  computeChartWindow,
  findChartTimeRange,
  formatAxisTick,
  formatTooltipDate,
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
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';
import DownloadOutlined from '@ant-design/icons-svg/lib/asn/DownloadOutlined';
import ZoomInOutlined from '@ant-design/icons-svg/lib/asn/ZoomInOutlined';

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

// Conversion helpers used by the chart-config factory below.
const FAHRENHEIT_RATIO = 9 / 5;
const cToF = (celsius) => celsius * FAHRENHEIT_RATIO + 32;
const identity = (v) => v;
const mvToV = (mv) => mv / 1000;
// Backend `electricalConductivity_N` ships raw values; the detail
// endpoint normalizes via `_normalize_conductivity` (`/1000 if > 10`)
// because some firmwares emit µS/m while others emit dS/m directly.
// Apply the same normalization here so chart units stay consistent
// with the diagram-mode soil-data card. The result is in dS/m, which
// numerically equals mS/cm — only the label changes between the two
// user-preference choices.
const normalizeEc = (raw) => (raw > 10 ? raw / 1000 : raw);

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

// 6-chart config factory for the wireless-sensor measurement panel.
// Returns the same shape the old `WIRELESS_SENSOR_CHART_CONFIGS`
// constant did — three dual-probe soil charts (Soil Temp / Moisture /
// Conductivity) + three single-line system charts (Battery / Lux /
// RSSI) — but with `unit` labels and `transform` functions chosen
// based on the user's saved Display preferences.
//
// Each chart's `series` entries describe one rendered line:
//
//   id        — stable id for MUI x-charts and the series-targeted
//               sx selectors below
//   fieldKey  — the backend field name (matches KNOWN_WIRELESS_SENSOR_FIELDS
//               in useWirelessSensorMeasurements)
//   label     — legend / tooltip display name
//   color     — line + area-fill color (also used as the CSS variable
//               for the per-chart glow effect)
//   probe     — 1 or 2 for per-probe series; omitted for single-line
//               charts. Drives the probe-highlight toggle's opacity
//               dimming.
//   transform — value transform applied per point: unit conversion +
//               (for conductivity) the firmware-emit normalization.
//
// Color palette: probe 1 uses the primary teal (#48f7f5) the rest of
// the dashboard uses for "current value" emphasis; probe 2 uses the
// purple accent (#c96cfc) — chosen for high luminance contrast at
// the chart's typical small size and for matching the project's
// existing accent vocabulary.
//
// Unit-pref mapping (all defaults match the legacy hardcoded behavior
// when no preferences are loaded):
//
//   tempUnit         'F' → cToF + label '°F'   (default)
//                    'C' → identity + '°C'
//   conductivityUnit 'dsm'  → normalizeEc + 'dS/m'  (default)
//                    'mscm' → normalizeEc + 'mS/cm' (numerically equal)
//   voltageUnit      'v'  → mvToV + 'V'   (default)
//                    'mv' → identity + 'mV'
function buildWirelessSensorChartConfigs(displayPrefs) {
  const tempUnit = displayPrefs?.tempUnit ?? 'F';
  const conductivityUnit = displayPrefs?.conductivityUnit ?? 'dsm';
  const voltageUnit = displayPrefs?.voltageUnit ?? 'v';

  const tempTransform = tempUnit === 'C' ? identity : cToF;
  const tempLabel = tempUnit === 'C' ? '°C' : '°F';
  const conductivityLabel = conductivityUnit === 'mscm' ? 'mS/cm' : 'dS/m';
  const voltageTransform = voltageUnit === 'mv' ? identity : mvToV;
  const voltageLabel = voltageUnit === 'mv' ? 'mV' : 'V';

  return [
    {
      key: 'soil_temperature',
      title: 'Soil Temperature',
      unit: tempLabel,
      series: [
        { id: 'p1', fieldKey: 'temperatureTeros12_1', label: 'Probe 1', color: '#48f7f5', probe: 1, transform: tempTransform },
        { id: 'p2', fieldKey: 'temperatureTeros12_2', label: 'Probe 2', color: '#c96cfc', probe: 2, transform: tempTransform }
      ]
    },
    {
      key: 'soil_moisture',
      title: 'Soil Moisture',
      unit: '%',
      series: [
        { id: 'p1', fieldKey: 'vwcPercent_1', label: 'Probe 1', color: '#48f7f5', probe: 1 },
        { id: 'p2', fieldKey: 'vwcPercent_2', label: 'Probe 2', color: '#c96cfc', probe: 2 }
      ]
    },
    {
      key: 'conductivity',
      title: 'Conductivity',
      unit: conductivityLabel,
      series: [
        { id: 'p1', fieldKey: 'electricalConductivity_1', label: 'Probe 1', color: '#48f7f5', probe: 1, transform: normalizeEc },
        { id: 'p2', fieldKey: 'electricalConductivity_2', label: 'Probe 2', color: '#c96cfc', probe: 2, transform: normalizeEc }
      ]
    },
    {
      key: 'battery_voltage',
      title: 'Battery Voltage',
      unit: voltageLabel,
      series: [{ id: 'battery', fieldKey: 'mVbat', label: 'Battery', color: '#8539e0', transform: voltageTransform }]
    },
    {
      key: 'lux',
      title: 'Lux',
      unit: 'lx',
      series: [{ id: 'lux', fieldKey: 'lux', label: 'Lux', color: '#f4d04b' }]
    },
    {
      key: 'rssi',
      title: 'RSSI',
      unit: 'dBm',
      series: [{ id: 'rssi', fieldKey: 'rssi', label: 'RSSI', color: '#f47568' }]
    }
  ];
}

// Probe-highlight toggle values. 'all' = both probes equal weight;
// 1 / 2 = highlight that probe (the other dims to PROBE_DIM_OPACITY).
const PROBE_DIM_OPACITY = 0.22;

// Convert a hex color to an rgba string with the given alpha. Used to
// dim the non-highlighted probe's line color in multi-series charts.
const dimHexColor = (hex, alpha) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 0xff}, ${(v >> 8) & 0xff}, ${v & 0xff}, ${alpha})`;
};

// Chart panel surface — same gradient + border that sensor-measurements
// uses for its chart panel. Slightly distinct from drfSurfaceSx so the
// chart area visually reads as "data canvas" inside the larger card.
const chartSurfaceSx = {
  backgroundColor: '#07143f',
  backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
  border: '1px solid #0e346a'
};

// Shared chart sx — single hoisted reference shared across all charts.
// Same recipe sensor-measurements.jsx uses, just here for self-
// containment. The line color is interpolated per-chart via a CSS
// variable set on the wrapper Box, so this object stays chart-agnostic.
const chartSx = {
  width: '100%',
  overflow: 'visible',
  '& .MuiChartsSurface-root': { overflow: 'visible' },
  '& .MuiChartsGrid-line': {
    stroke: 'var(--blue)',
    strokeOpacity: 0.38,
    strokeWidth: 0.65
  },
  '& .MuiLineElement-root': {
    strokeWidth: 0.95,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    // Static SVG <filter> reference rather than CSS drop-shadow. The
    // filter defs live in <ChartGlowDefs/>, mounted once at the top
    // of this page's tree. Visually identical to the previous
    // drop-shadow at 8px radius, but the browser compiles the
    // filter once and reuses it across every line stroke rather
    // than recompiling per-element on every paint. Match the
    // sensor-measurements page so both surfaces' chart glows render
    // pixel-identically.
    //
    // The fallback to url(#chart-glow-full) covers chart subtrees
    // that don't set the wrapper-level `--chart-glow-filter`
    // variable. Multi-series charts on this page don't currently
    // need the lite variant, but the same plumbing is available if
    // a future chart wants it.
    filter: 'var(--chart-glow-filter, url(#chart-glow-full))'
  },
  '& .MuiAreaElement-root': { fillOpacity: 0.16 },
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'rgba(232, 232, 232, 0.45)' },
  '& .MuiChartsAxis-tickLabel': { fill: 'var(--green)', fontWeight: 600 },
  '& .MuiChartsAxis-left .MuiChartsAxis-line, & .MuiChartsAxis-bottom .MuiChartsAxis-line': {
    stroke: 'rgba(232, 232, 232, 0.55)'
  },
  '& .MuiChartsAxisHighlight-root': {
    stroke: 'var(--chart-line-color) !important',
    strokeOpacity: 0.75,
    strokeWidth: 1.25
  },
  // Hover highlight dot — the SVG circle MUI x-charts'
  // LineHighlightPlot draws on each line at the cursor's X position
  // (verified against node_modules/@mui/x-charts/LineChart/
  // LineHighlightElement.js — class `MuiHighlightElement-root`,
  // default `r: 5`). It DOES render by default for every line series
  // on hover, but at default fill/stroke it tends to blend into the
  // line itself on a dense chart and reads as invisible —
  // especially in multi-series charts where the user is
  // intentionally focused on one probe and expects the dot to be
  // obvious. The styling below explicitly pins the radius, gives the
  // dot a thin white stroke ring for contrast against the line color
  // beneath it, and applies the same green-glow drop-shadow filter
  // the line itself uses so the dot reads as part of the line's
  // visual language. The per-series CSS variable
  // `--chart-line-color` is set on the chart's wrapper Box, so each
  // chart's dot gets its own glow color automatically.
  '& .MuiHighlightElement-root': {
    r: 5,
    fillOpacity: 1,
    stroke: 'rgba(255, 255, 255, 0.85)',
    strokeWidth: 1.5,
    filter: 'drop-shadow(0 0 6px var(--chart-line-color))'
  },
  background: 'transparent',
  borderRadius: 1
};

// Y-axis tick label formatter — compacts large values (12000 → "12.0k")
// and appends the chart's unit suffix. Curried because MUI x-charts'
// valueFormatter takes a single-arg callback.
const makeYAxisFormatter = (unit) => (value) => {
  if (value === null || value === undefined) return '';
  const compact = Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
  return unit ? `${compact} ${unit}` : compact;
};

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
  const { tempUnit } = displayPrefs;

  // Chart configs derived from preferences. A unit change in Account
  // Settings → Display flips displayPrefs, this useMemo recomputes,
  // and every downstream consumer (chartSeriesByField, the chart
  // renderer, the enlarged-chart lookup, the CSV export) sees the new
  // transforms + unit labels.
  const chartConfigs = useMemo(() => buildWirelessSensorChartConfigs(displayPrefs), [displayPrefs]);

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

  // Probe-highlight toggle for the dual-probe soil charts. 'all' =
  // both lines at full color; 1 / 2 = highlight that probe (the
  // other dims via dimHexColor). Single-line charts (battery / lux /
  // RSSI) ignore this state.
  const [probeHighlight, setProbeHighlight] = useState('all');

  // Currently-enlarged chart key. null = closed; otherwise the
  // config.key of the chart being displayed in the Dialog.
  const [enlargedChartKey, setEnlargedChartKey] = useState(null);
  const enlargedChartConfig = enlargedChartKey ? (chartConfigs.find((c) => c.key === enlargedChartKey) ?? null) : null;

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

  // PheNode + sensor selection. Both start as `undefined` (the
  // "uninitialized" sentinel) so the auto-default effect below can
  // tell the difference between "user hasn't picked yet" and "user
  // explicitly cleared the selection." Mirrors the same pattern used
  // in sections/fleet-overview/sensor-fleet-overview.jsx.
  const [selectedPhenodeId, setSelectedPhenodeId] = useState(undefined);
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
    isValidating: measurementsValidating,
    error: measurementsError
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
  const chartTimes = useMemo(() => {
    if (!measurementRows) return [];
    return measurementRows.map((row) => new Date(row.time));
  }, [measurementRows]);

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
  const chartSeriesByField = useMemo(() => {
    if (!measurementRows) return {};
    const result = {};
    for (const chartConfig of chartConfigs) {
      result[chartConfig.key] = chartConfig.series.map((seriesConfig) => {
        const transform = seriesConfig.transform;
        const values = measurementRows.map((row) => {
          const field = row.fields[seriesConfig.fieldKey];
          if (!field) return null;
          const raw = field.avg;
          if (raw === null || raw === undefined) return null;
          return transform ? transform(raw) : raw;
        });
        return { ...seriesConfig, values };
      });
    }
    return result;
    // `chartConfigs` is included so a unit-preference change re-derives
    // the values arrays through the new transforms.
  }, [measurementRows, chartConfigs]);

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

  // Most-recently-reporting PheNode — same recency-sort with -Infinity
  // fallback used in sensor-fleet-overview.jsx so devices that have
  // never reported sink to the bottom rather than incorrectly winning
  // the recency race.
  //
  // URL sensor's parent PheNode wins over recency: if the user landed
  // here from a fleet-card click, the deep-link target's parent is the
  // PheNode they expect to see selected — promoting it past recency
  // keeps that intent intact even when the parent isn't the most-
  // recently-reporting device on the account.
  const defaultPhenodeId = useMemo(() => {
    if (urlSensorResolution?.phenodeId) return urlSensorResolution.phenodeId;
    if (!devices?.length) return null;
    const byRecency = [...devices].sort((a, b) => {
      const aTime = a.last_measurement_at ? new Date(a.last_measurement_at).getTime() : -Infinity;
      const bTime = b.last_measurement_at ? new Date(b.last_measurement_at).getTime() : -Infinity;
      return bTime - aTime;
    });
    return byRecency[0]?.external_device_id ?? null;
  }, [devices, urlSensorResolution]);

  // FROZEN copy of the recency default — captured once on the first
  // non-null evaluation, then held stable for the rest of the page
  // visit. The local `selectedPhenodeId` state is already sticky
  // (only set when undefined or when the selection vanishes), so SWR
  // polls don't directly shift the user's selection. But the
  // "stale selection" recovery branch below was previously falling
  // back to the LIVE default — meaning if the user's selected PheNode
  // somehow vanished, the page would jump to whatever happens to be
  // most-recent right now. The frozen value gives a more predictable
  // recovery target.
  //
  // Resets on component unmount → remount, so a fresh visit picks up
  // fresh defaults. Matches the requested behavior: "only update to
  // the most-recent when the user leaves the page."
  const [frozenDefaultPhenodeId, setFrozenDefaultPhenodeId] = useState(null);
  useEffect(() => {
    if (defaultPhenodeId && !frozenDefaultPhenodeId) {
      setFrozenDefaultPhenodeId(defaultPhenodeId);
    }
  }, [defaultPhenodeId, frozenDefaultPhenodeId]);

  // Apply the auto-default once on mount, and again if the user's
  // selected PheNode disappears from the fleet (e.g. an SWR
  // revalidation drops it). Same shape as sensor-fleet-overview.
  // Uses the FROZEN default so the recovery path doesn't snap to a
  // different "currently most-recent" PheNode after the user has
  // already been on the page for a while. If the frozen default is
  // also gone, falls back to the live default as a last resort.
  useEffect(() => {
    if (selectedPhenodeId === undefined) {
      if (frozenDefaultPhenodeId) setSelectedPhenodeId(frozenDefaultPhenodeId);
      else if (defaultPhenodeId) setSelectedPhenodeId(defaultPhenodeId);
      return;
    }
    const stillExists = devices?.some((d) => d.external_device_id === selectedPhenodeId);
    if (!stillExists) {
      const frozenStillExists = frozenDefaultPhenodeId && devices?.some((d) => d.external_device_id === frozenDefaultPhenodeId);
      if (frozenStillExists) setSelectedPhenodeId(frozenDefaultPhenodeId);
      else if (defaultPhenodeId) setSelectedPhenodeId(defaultPhenodeId);
    }
  }, [frozenDefaultPhenodeId, defaultPhenodeId, devices, selectedPhenodeId]);

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
  const lastMeasurementsDisplay = activeSensor ? formatLastMeasurement(activeSensor.lastMeasurementAt) : '—';

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
      const { blob, filename } = await downloadWirelessSensorData(
        activeSensor.externalSensorId,
        fromIso,
        toIso,
        accessToken
      );
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
                  setSelectedPhenodeId(newValue?.id ?? null);
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
                  boxShadow: '0 11px 19px 1px #0000002e'
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
                              boxShadow: '0 11px 19px 1px #0000002e'
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
                      Probe-highlight ToggleButtonGroup — affects the
                      three dual-probe charts (Soil Temp / Moisture /
                      Conductivity). 'all' renders both probes at
                      equal weight; 1 / 2 dims the OTHER probe via
                      dimHexColor. Single-line charts (Battery / Lux /
                      RSSI) ignore this setting.
                    */}
                      <ToggleButtonGroup
                        exclusive
                        value={probeHighlight}
                        onChange={(_, next) => {
                          if (next) setProbeHighlight(next);
                        }}
                        size="small"
                        sx={{
                          '& .MuiToggleButton-root': {
                            border: '1px solid var(--reflected-light) !important',
                            color: 'var(--blue)',
                            backgroundColor: 'rgba(0, 20, 61, 0.72)',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            // Tuned to match the time-range dropdown's
                            // visible box size by eye — slightly
                            // tighter than MUI's canonical
                            // size="small" OutlinedInput inset
                            // (8.5px / 14px) because the toggle
                            // buttons' inner text ("Probe 1" /
                            // "Probe 2") visually inflates the box
                            // versus the dropdown's icon + single
                            // label.
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
                        <ToggleButton value="all">Both</ToggleButton>
                        <ToggleButton value={1}>Probe 1</ToggleButton>
                        <ToggleButton value={2}>Probe 2</ToggleButton>
                      </ToggleButtonGroup>

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

                    <Tooltip
                      title={measurementRows?.length ? 'Download CSV for this range' : 'No data to download'}
                      arrow={false}
                      slotProps={tooltipSlotProps}
                    >
                      <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
                        <Button
                          variant="outlined"
                          startIcon={<AntIcon icon={DownloadOutlined} />}
                          disabled={!measurementRows?.length || downloading || !activeSensor?.externalSensorId}
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
                            // Disabled state matches the Download button
                            // in the Data Downloads page (sections/
                            // data-download/data-downloads.jsx:586-593)
                            // so the "no data available" affordance is
                            // consistent across the app's download
                            // surfaces — grey text + grey border on a
                            // flat dark-navy fill, no hover brightening.
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
                Chart grid. Six charts in a 1-/2-/3-column responsive
                grid (row layout) or single column (column layout).
                Each chart renders an MUI LineChart with one or two
                series, error / loading / empty branches, and a
                per-chart enlarge button. Mirrors the rendering
                pattern in sensor-measurements.jsx — only the series
                build (multi-line + probe dimming) differs.
              */}
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns:
                      chartLayout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr'
                  }}
                >
                  {chartConfigs.map((config) => {
                    const seriesList = chartSeriesByField[config.key] ?? [];
                    // Aggregate non-null values across all series in the
                    // chart so the Y-axis padding scales correctly even
                    // when one probe ranges differently from the other.
                    const numericValues = seriesList.flatMap((s) =>
                      s.values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v))
                    );
                    const hasData = chartTimes.length > 0 && numericValues.length > 0;
                    const minVal = hasData ? Math.min(...numericValues) : 0;
                    const maxVal = hasData ? Math.max(...numericValues) : 1;
                    const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

                    // Use the first series' color as the chart's "glow"
                    // CSS variable so the hover-line + drop-shadow stay
                    // consistent within a chart (multi-series charts
                    // pick probe 1's teal; single-series use their own).
                    const glowColor = seriesList[0]?.color ?? '#48f7f5';

                    return (
                      <Box
                        key={config.key}
                        style={{ '--chart-line-color': glowColor }}
                        sx={{
                          borderRadius: 1,
                          p: { xs: 0.45, sm: 0.65 },
                          minHeight: { xs: 265, sm: 268 },
                          display: 'flex',
                          flexDirection: 'column',
                          ...reflectedCardChromeSx,
                          ...chartSurfaceSx,
                          border: '1px solid #0e346a'
                        }}
                      >
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                          <Typography variant="subtitle1" sx={{ color: 'var(--blue)', ml: 1.25 }}>
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
                              onClick={() => setEnlargedChartKey(config.key)}
                              sx={{ color: 'var(--blue)', '&:hover': { color: 'var(--green)' } }}
                            >
                              <AntIcon icon={ZoomInOutlined} />
                            </IconButton>
                          </Tooltip>
                        </Stack>

                        {measurementsError && !measurementRows ? (
                          <Box
                            sx={{
                              flex: 1,
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
                            sx={{
                              flex: 1,
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--blue)',
                              fontSize: '0.85rem'
                            }}
                          >
                            <CircularProgress size={20} sx={{ color: 'var(--green)' }} />
                            <Box component="span">Loading chart data…</Box>
                          </Stack>
                        ) : !hasData ? (
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
                          <LineChart
                            xAxis={[
                              {
                                id: `${config.key}-x`,
                                scaleType: 'time',
                                data: chartTimes,
                                tickNumber: axisTickNumberFor(axisFormat),
                                tickInterval: xAxisTicks,
                                min: chartTimes[0],
                                max: chartTimes[chartTimes.length - 1],
                                domainLimit: 'strict',
                                tickLabelStyle: { fontSize: 11, fill: 'var(--green)' },
                                valueFormatter: (value, context) =>
                                  context?.location === 'tooltip' ? formatTooltipDate(value) : formatAxisTick(value, axisFormat)
                              }
                            ]}
                            yAxis={[
                              {
                                id: `${config.key}-y`,
                                min: minVal - pad,
                                max: maxVal + pad,
                                width: 56,
                                tickLabelStyle: { fontSize: 11, fill: 'var(--green)' },
                                valueFormatter: makeYAxisFormatter(config.unit)
                              }
                            ]}
                            series={seriesList.map((s) => {
                              // Apply probe-highlight dimming. If a
                              // probe is selected and this series is
                              // for the OTHER probe, render with a
                              // translucent color so it visually
                              // recedes. Single-line series (no
                              // `probe` field) are unaffected.
                              const isDimmed = probeHighlight !== 'all' && s.probe != null && s.probe !== probeHighlight;
                              const seriesColor = isDimmed ? dimHexColor(s.color, PROBE_DIM_OPACITY) : s.color;
                              // Area fill rule:
                              //   - Single-line chart                → fill (canonical look)
                              //   - Multi-series, Both mode          → no fill (overlap looks muddy)
                              //   - Multi-series, P1 / P2 highlighted → fill the HIGHLIGHTED series only
                              //
                              // The third branch fixes the missing
                              // hover-dot: MUI x-charts' closest-point
                              // marker only registers when the cursor
                              // is on the line or over an area fill.
                              // Without a fill, multi-series charts
                              // give the hover only a 1px line target,
                              // so the dot effectively never appears.
                              // Enabling the fill on whichever probe
                              // the user just highlighted gives the
                              // hover a wide surface to work with —
                              // matching the dot behavior the
                              // single-line + sensor-measurements
                              // charts already have.
                              const isHighlightedSole = probeHighlight !== 'all' && s.probe === probeHighlight;
                              const showArea = seriesList.length === 1 || isHighlightedSole;
                              return {
                                id: `${config.key}-${s.id}`,
                                label: s.label,
                                data: s.values,
                                color: seriesColor,
                                area: showArea,
                                showMark: false,
                                curve: 'linear',
                                connectNulls: true,
                                valueFormatter: (value) =>
                                  value === null || value === undefined
                                    ? null
                                    : `${Number(value).toFixed(2)}${config.unit ? ` ${config.unit}` : ''}`
                              };
                            })}
                            grid={{ horizontal: true, vertical: true }}
                            height={chartLayout === 'row' ? 228 : 258}
                            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                            hideLegend={seriesList.length === 1}
                            slotProps={{
                              legend: {
                                direction: 'horizontal',
                                position: { vertical: 'top', horizontal: 'middle' },
                                sx: {
                                  '& .MuiChartsLegend-mark': { rx: 2, ry: 2 },
                                  '& .MuiChartsLegend-label': { fill: 'var(--green)', fontSize: 11 }
                                }
                              }
                            }}
                            sx={chartSx}
                          />
                        )}
                      </Box>
                    );
                  })}
                </Box>
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

        {/*
        Enlarge Dialog — renders the user-selected chart at full
        Dialog width. Mirrors the sensor-measurements panel's enlarge
        affordance so both charts surfaces feel like one product.
        Data flows from the same useWirelessSensorMeasurements hook,
        so a fetch that updates the grid also updates this dialog.
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
              const seriesList = chartSeriesByField[config.key] ?? [];
              const numericValues = seriesList.flatMap((s) => s.values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v)));
              const hasData = chartTimes.length > 0 && numericValues.length > 0;
              const minVal = hasData ? Math.min(...numericValues) : 0;
              const maxVal = hasData ? Math.max(...numericValues) : 1;
              const pad = Math.max(0.1, (maxVal - minVal) * 0.04);
              const glowColor = seriesList[0]?.color ?? '#48f7f5';
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
                        <IconButton
                          aria-label="close enlarged chart"
                          onClick={() => setEnlargedChartKey(null)}
                          sx={{ color: 'var(--blue)' }}
                        >
                          <AntIcon icon={CloseOutlined} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </DialogTitle>
                  <DialogContent sx={{ pt: 1.5, pb: 2.5 }}>
                    <Box
                      style={{ '--chart-line-color': glowColor }}
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
                        <LineChart
                          xAxis={[
                            {
                              id: `${config.key}-x-enlarged`,
                              scaleType: 'time',
                              data: chartTimes,
                              tickNumber: axisTickNumberFor(axisFormat),
                              tickInterval: xAxisTicks,
                              min: chartTimes[0],
                              max: chartTimes[chartTimes.length - 1],
                              domainLimit: 'strict',
                              tickLabelStyle: { fontSize: 12, fill: 'var(--green)' },
                              valueFormatter: (value, context) =>
                                context?.location === 'tooltip' ? formatTooltipDate(value) : formatAxisTick(value, axisFormat)
                            }
                          ]}
                          yAxis={[
                            {
                              id: `${config.key}-y-enlarged`,
                              min: minVal - pad,
                              max: maxVal + pad,
                              width: 64,
                              tickLabelStyle: { fontSize: 12, fill: 'var(--green)' },
                              valueFormatter: makeYAxisFormatter(config.unit)
                            }
                          ]}
                          series={seriesList.map((s) => {
                            const isDimmed = probeHighlight !== 'all' && s.probe != null && s.probe !== probeHighlight;
                            const seriesColor = isDimmed ? dimHexColor(s.color, PROBE_DIM_OPACITY) : s.color;
                            // Same area-on-highlight rule as the grid
                            // chart above — fill the highlighted probe
                            // so the closest-point hover dot has a
                            // wide surface to register against.
                            const isHighlightedSole = probeHighlight !== 'all' && s.probe === probeHighlight;
                            const showArea = seriesList.length === 1 || isHighlightedSole;
                            return {
                              id: `${config.key}-${s.id}-enlarged`,
                              label: s.label,
                              data: s.values,
                              color: seriesColor,
                              area: showArea,
                              showMark: false,
                              curve: 'linear',
                              connectNulls: true,
                              valueFormatter: (value) =>
                                value === null || value === undefined
                                  ? null
                                  : `${Number(value).toFixed(2)}${config.unit ? ` ${config.unit}` : ''}`
                            };
                          })}
                          grid={{ horizontal: true, vertical: true }}
                          height={500}
                          margin={{ top: 12, right: 12, bottom: 4, left: 4 }}
                          hideLegend={seriesList.length === 1}
                          slotProps={{
                            legend: {
                              direction: 'horizontal',
                              position: { vertical: 'top', horizontal: 'middle' },
                              sx: {
                                '& .MuiChartsLegend-mark': { rx: 2, ry: 2 },
                                '& .MuiChartsLegend-label': { fill: 'var(--green)', fontSize: 12 }
                              }
                            }
                          }}
                          sx={chartSx}
                        />
                      )}
                    </Box>
                  </DialogContent>
                </>
              );
            })()}
        </Dialog>
      </MainCard>
    </>
  );
}
