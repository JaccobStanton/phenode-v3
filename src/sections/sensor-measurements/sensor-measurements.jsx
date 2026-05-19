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

import CloseOutlined from '@ant-design/icons/CloseOutlined';
import DownloadOutlined from '@ant-design/icons/DownloadOutlined';

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
import { renameDevice } from 'services/mutations';
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

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import ZoomInOutlined from '@ant-design/icons/ZoomInOutlined';

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
// CSV download — builds a CSV from the currently-loaded measurement rows
// and triggers a browser download. One row per timestamp, one column per
// chart-configured metric (transformed with each metric's display unit
// so the file matches what the user sees on screen).
// =============================================================================
//
// Why this lives at module scope, not as a hook: the function only reads
// its arguments, has no React-state dependencies, and is invoked exactly
// once per user click. A hook would add ceremony without buying anything.

/**
 * Convert one date to a slug like "2026-03-15" — safe for filenames on
 * every OS. ISO `toISOString()` produces "2026-03-15T14:23:00.000Z" so
 * we lift the YYYY-MM-DD prefix.
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
 * Build a CSV string from the normalized measurement rows. Columns:
 * `time`, then one column per DEVICE_CHART_CONFIGS entry. Values pass
 * through each entry's `transform` (so e.g. temperature exports as °F
 * to match the on-screen chart), and the header carries the metric's
 * display unit in parentheses so the file is self-documenting.
 *
 * Empty cells for rows where that field has no reading.
 */
function buildMeasurementsCsv(rows) {
  const headerCells = ['time'];
  for (const config of DEVICE_CHART_CONFIGS) {
    headerCells.push(config.unit ? `${config.key} (${config.unit})` : config.key);
  }
  const lines = [headerCells.join(',')];
  for (const row of rows) {
    const cells = [row.time];
    for (const config of DEVICE_CHART_CONFIGS) {
      const field = row.fields[config.key];
      const raw = field?.avg;
      if (raw === null || raw === undefined) {
        cells.push('');
      } else {
        const value = config.transform ? config.transform(raw) : raw;
        // Round to 4 decimals to keep file size sane; raw numbers can
        // be 15+ significant digits (JS doubles) which is more
        // precision than a sensor actually delivers.
        cells.push(Number.isFinite(value) ? value.toFixed(4).replace(/\.?0+$/, '') : '');
      }
    }
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

/**
 * Trigger a CSV download in the browser. Builds an anchor element with
 * an object URL, clicks it, then revokes the URL. The anchor is
 * appended to + removed from the DOM so Firefox honors the click
 * (Firefox is stricter about detached anchors than Chrome/Safari).
 */
function downloadMeasurementsCsv({ rows, deviceLabel, from, to }) {
  if (!rows?.length) return;
  const csv = buildMeasurementsCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deviceLabelToFilenameSlug(deviceLabel)}_${dateToFilenameSlug(from)}_${dateToFilenameSlug(to)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Conversion ratio for °C → °F. Local consts (not magic numbers in the
// transform) make the intent obvious at the call site.
const FAHRENHEIT_RATIO = 9 / 5;

// Per-chart configuration for the device-level chart panel. One entry =
// one rendered chart card. Hoisted to module scope so the array isn't
// rebuilt on every render — without this hoist the .map() below would
// allocate a new array (and therefore new chart configs) on every
// parent re-render, which prevents MUI's internal memoization from
// short-circuiting the chart-render work.
//
// Schema:
//   key:    Field name on the response row (matches the canonical
//           list in services/downloads.py _DEVICE_FIELD_EXTRACTORS).
//   title:  Header text shown above the chart.
//   color:  Stroke + area-fill color, picked from the existing
//           sensor-measurements palette for visual continuity.
//   unit:   Unit suffix appended to Y-axis tick labels and tooltip
//           values.
//   transform: Optional value transform (e.g., °C → °F). Kept at the
//              chart-config layer rather than the hook so the hook
//              stays display-agnostic — a future "show °C" toggle
//              would only need to flip this function.
//   yAxisFormat: Optional override for the Y-axis number formatter.
//
// Why six charts (not the seven the original mock had):
//   The dropped mock charts (Soil Temperature, Electrical Conductivity,
//   Soil Moisture, LUX) are all wireless-sensor metrics, not device-
//   level metrics. They'll come back when the wireless-sensor variant
//   of this page exists — at which point they'll feed off the
//   parallel /api/wireless-sensors/{id}/sensor-data endpoint and the
//   wireless-sensor field vocabulary (vwcPercent_1,
//   electricalConductivity_1, lux, etc.).
const DEVICE_CHART_CONFIGS = [
  {
    key: 'temperature',
    title: 'Temperature',
    color: '#48f7f5',
    unit: '°F',
    // Backend emits °C; existing fleet card convention is °F.
    transform: (celsius) => celsius * FAHRENHEIT_RATIO + 32
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
    unit: 'kPa'
  },
  {
    key: 'wind_speed',
    title: 'Wind Speed',
    color: '#f4d04b',
    unit: 'm/s'
  },
  {
    key: 'rainfall',
    title: 'Rainfall',
    color: '#0043c2',
    unit: 'mm'
  },
  {
    key: 'battery_voltage',
    title: 'Battery Voltage',
    color: '#8539e0',
    unit: 'mV'
  }
];

// Field key list passed to the SWR hook as the `fields` projection.
// Pre-extracted from DEVICE_CHART_CONFIGS so the hook only ships back
// the columns we actually render — bandwidth saving that compounds at
// long time ranges.
const DEVICE_CHART_FIELDS = DEVICE_CHART_CONFIGS.map((c) => c.key);

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
    // `drop-shadow(...)` per element. Two reasons:
    //
    //   1. drop-shadow on every line stroke triggers a separate raster
    //      pass per element. For a 24-hour range that's ~288 segments
    //      × 6 charts = ~1,700 filter operations every paint. A static
    //      <filter> in <defs> is compiled once and reused, which lets
    //      the browser amortize the cost across all references.
    //
    //   2. Each chart's wrapper sets `--chart-glow-filter` based on
    //      its current point count (full glow ≤500 points; lite glow
    //      above that — see useLiteGlow in the panel below). The CSS
    //      variable indirection means the same chartSx rule serves
    //      both cases without branching on JS.
    //
    // The fallback to url(#chart-glow-full) keeps charts rendered
    // outside the panel (e.g., the enlarged Dialog) on the full-glow
    // path when no wrapper-level variable is set.
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
//   - config: comes from the module-level DEVICE_CHART_CONFIGS array,
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
function buildCircleMetrics(device) {
  return [
    {
      id: 'metric-1',
      icon: tempSensorIcon,
      iconAlt: 'Temperature sensor icon',
      value: formatTemperature(device?.temperature_c),
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
      value: formatTodaysRainfall(device?.rainfall_today_mm),
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
      value: formatWindSpeed(device?.wind_speed),
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
  // device. useMemo so the array reference is stable across renders
  // when activeDevice hasn't changed — prevents the .map() below from
  // remounting <Box> children unnecessarily.
  const circleMetrics = useMemo(() => buildCircleMetrics(activeDevice), [activeDevice]);

  // Formatted "Last Measurements Taken" string for the page header.
  // Uses the shared transform (returns "Never" for null,
  // "Unknown" for an unparseable string) so this page surfaces the
  // same vocabulary as the fleet cards.
  const lastMeasurementsDisplay = activeDevice ? formatLastMeasurement(activeDevice.last_measurement_at) : '—';

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
  // the enlarged target's config.key from DEVICE_CHART_CONFIGS.
  const [enlargedChartKey, setEnlargedChartKey] = useState(null);
  const enlargedChartConfig = enlargedChartKey ? (DEVICE_CHART_CONFIGS.find((c) => c.key === enlargedChartKey) ?? null) : null;

  // Pre-compute the X-axis timestamp array once per data refresh.
  // Every chart shares this exact array (same X for every metric of
  // the same device, by definition), so building it once at the
  // panel level rather than inside each chart's render saves both
  // memory allocation and re-render churn.
  const chartTimes = useMemo(() => {
    if (!measurementRows) return [];
    return measurementRows.map((row) => new Date(row.time));
  }, [measurementRows]);

  // Glow intensity selector — picks the chart-stroke filter once at the
  // panel level since point counts move together (all six charts share
  // chartTimes by definition). When the user selects a long time range
  // and the backend's auto-bucketing returns lots of buckets, switch to
  // the lite glow: the full 8px blur is visually unnecessary at high
  // line density (the glow on individual segments overlaps with itself)
  // AND it's a measurable paint-cost win. Threshold of 500 points is
  // calibrated to the typical break-even where the glow stops adding
  // perceptible visual richness.
  //
  // The variable name `--chart-glow-filter` is what `chartSx` reads via
  // `filter: var(--chart-glow-filter, url(#chart-glow-full))`. Setting
  // it on the chart wrapper Box scopes the choice per chart-card —
  // although in practice all six pick the same value since they share
  // the data shape.
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
    for (const config of DEVICE_CHART_CONFIGS) {
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
  }, [measurementRows]);

  return (
    <>
      {/*
        Hidden SVG with the chart glow filters.

        Rendered at the page level (not inside each chart's own SVG)
        because MUI x-charts owns the chart SVG's <defs> and we can't
        inject our filters there. The browser's SVG filter resolver
        looks up `url(#id)` across all SVGs in the same document, so
        a single hidden SVG here serves every chart on the page —
        including the enlarged dialog chart that mounts later.

        Two filters with progressively softer parameters:

          chart-glow-full ─ stdDeviation 4 (≈ drop-shadow 0 0 8px).
                            Default for charts with ≤500 data points.
                            Produces the rich glow the visual spec
                            calls for at typical point density.
          chart-glow-lite ─ stdDeviation 1 (≈ drop-shadow 0 0 2px).
                            Drastically reduced — used when the chart
                            has >500 points and the high line density
                            already overlaps individual glows enough
                            that the heavy blur stops adding richness.
                            Significant paint-cost reduction.

        Both filters blur the SourceGraphic itself (the line stroke,
        which already carries its color), then merge the blurred copy
        as the glow layer underneath the original line. This means
        the glow inherits the line's stroke color automatically — no
        per-color filter definitions, no flood-color hardcoding.

        Filter region is 100% larger than the bounding box to keep
        the soft edges of the blur inside the clip region; otherwise
        you'd see hard cutoffs at the chart edges where the blur was
        clipped by the default 10% filter region.
      */}
      <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <filter id="chart-glow-full" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="chart-glow-lite" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
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
                        sx={{
                          color: 'var(--green)',
                          lineHeight: 1,
                          fontWeight: 300,
                          fontSize: { xs: '3.2rem', sm: '3.4rem', md: '3.7rem' },
                          textShadow: '0 1px 9px #1a75e0c9'
                        }}
                      >
                        {metric.value}
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        sx={{ color: 'var(--blue)', textAlign: 'center', fontSize: { xs: '1rem', sm: '1.05rem' } }}
                      >
                        {metric.label}
                      </Typography>
                      {metric.gustLabel && metric.gustValue && (
                        <Typography variant="subtitle2" sx={{ textAlign: 'center', color: 'var(--blue)' }}>
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
                  <AppstoreOutlined />
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
                          <ClockCircleOutlined style={{ color: 'var(--blue)' }} />
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
                      startIcon={<DownloadOutlined />}
                      disabled={!measurementRows?.length}
                      onClick={() =>
                        downloadMeasurementsCsv({
                          rows: measurementRows,
                          deviceLabel: activeDevice?.label || activeDevice?.external_device_id,
                          from,
                          to
                        })
                      }
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
                      Download CSV
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
              {DEVICE_CHART_CONFIGS.map((config) => {
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
                          // Click opens a themed Dialog with the same
                          // chart rendered at full Dialog width. The
                          // single Dialog instance lives at the end of
                          // this component and switches its content
                          // based on enlargedChartKey.
                          onClick={() => setEnlargedChartKey(config.key)}
                          sx={{ color: 'var(--blue)', '&:hover': { color: 'var(--green)' } }}
                        >
                          <ZoomInOutlined />
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
                        <CloseOutlined />
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
