import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import AntIcon from 'components/AntIcon';
import DownloadOutlined from '@ant-design/icons-svg/lib/asn/DownloadOutlined';

import ChartGlowDefs from 'components/ChartGlowDefs';
import MainCard from 'components/MainCard';
import PhenodeSelector from 'components/PhenodeSelector';
import { useSelection } from 'contexts/SelectionContext';
// PheNodeFleetMap is lazy-loaded so the @vis.gl/react-google-maps wrapper
// (and the Google Maps JS API runtime it pulls in at use-time) only
// parses for users who actually open the map view. Most users on this
// page stay in the chart view, so this saves a meaningful chunk of TTI
// on first paint. The conditional render below is wrapped in Suspense
// with a small CircularProgress fallback for the brief moment between
// "user clicked the toggle" and "map chunk has finished parsing."
const PheNodeFleetMap = lazy(() => import('sections/sensor-measurements/phenode-fleet-map'));
// Catalog-driven panel for the Light / Soil / Power & Device / Overview tabs.
// Lazy so its chart-type code (ScatterChart, etc.) only parses when the user
// actually opens a non-Weather tab — the default Weather tab stays in the
// existing (already-loaded) grid.
const MeasurementTabPanel = lazy(() => import('sections/sensor-measurements/MeasurementTabPanel'));
import { buildMeasurementCatalog, TAB_IDS } from 'sections/sensor-measurements/measurementCatalog';
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
  computeAxisTicks,
  computeChartWindow,
  findChartTimeRange,
  pickAxisFormatForRange
} from 'utils/chartTimeRanges';
import rainSensorIcon from 'assets/sensor-measurements/Rain.svg';
import tempSensorIcon from 'assets/sensor-measurements/Temp.svg';
import windSensorIcon from 'assets/sensor-measurements/Wind.svg';
import mapIconActive from 'assets/toggle_buttons/Map_Icon_Active.svg';
import mapIconInactive from 'assets/toggle_buttons/Map_Icon_Inactive.svg';
import phenodeFleetIcon from 'assets/drawer-icons/PheNode_Fleet.svg';
import phenodeFleetIconActive from 'assets/drawer-icons/PheNode_Fleet_Active.svg';
import soilProbeIcon from 'assets/toggle_buttons/Soil_Probe_Icon_Inactive.svg';

import AppstoreOutlined from '@ant-design/icons-svg/lib/asn/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons-svg/lib/asn/ClockCircleOutlined';
import CloudOutlined from '@ant-design/icons-svg/lib/asn/CloudOutlined';

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
// Which chart category tab is active. Omitted from the URL for the default
// (Weather) so the common state keeps a clean URL, mirroring how RANGE_PARAM
// is dropped for the default range.
const TAB_PARAM = 'tab';

// Small inline sun glyph for the Light category (the icon set has no Sun).
// Strokes with currentColor so the wrapper's color drives it.
function SunGlyph() {
  return (
    <svg
      width="17"
      height="17"
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

// Icon for a given chart category, used in the category selector trigger and
// menu rows. Light → sun, Weather → cloud, Soil → soil-probe asset, Power →
// PheNode fleet asset.
function categoryIcon(tabId) {
  switch (tabId) {
    case TAB_IDS.ALL:
      return <AntIcon icon={AppstoreOutlined} style={{ color: 'var(--blue)' }} />;
    case TAB_IDS.WEATHER:
      return <AntIcon icon={CloudOutlined} style={{ color: 'var(--blue)' }} />;
    case TAB_IDS.LIGHT:
      return <SunGlyph />;
    case TAB_IDS.SOIL:
      return <Box component="img" src={soilProbeIcon} alt="" sx={{ width: 18, height: 18 }} />;
    case TAB_IDS.POWER:
      return <Box component="img" src={phenodeFleetIcon} alt="" sx={{ width: 18, height: 18 }} />;
    default:
      return <AntIcon icon={AppstoreOutlined} style={{ color: 'var(--blue)' }} />;
  }
}

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

// Field key list passed to the SWR hook as the `fields` projection.
// The fieldKey set never changes with user preferences (we always need
// the same raw columns from the API; only the display conversion + unit
// label vary), so this stays a module constant.
// Field projection for the top-level device fetch. Feeds the Download button's
// enable check, the selection-loading indicator, AND the snapshot-circle KPIs
// (humidity / gust / wind direction values come from here, not DeviceRead — see
// buildCircleMetrics + the `latestValues` memo below).
const DEVICE_CHART_FIELDS = [
  'temperature',
  'temperature_mcp9808',
  'temperature_bme',
  'humidity',
  'humidity_bme',
  'pressure',
  'wind_speed',
  'wind_direction',
  'wind_gust',
  'rainfall',
  'battery_voltage'
];

// 16-point compass abbreviations + full names for the wind direction circle.
// Index = round(deg/22.5) % 16. Two parallel arrays kept in lockstep so the
// circle can render the short label and a themed tooltip can show the long.
const COMPASS_POINTS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const COMPASS_LABELS_16 = [
  'North',
  'North-Northeast',
  'Northeast',
  'East-Northeast',
  'East',
  'East-Southeast',
  'Southeast',
  'South-Southeast',
  'South',
  'South-Southwest',
  'Southwest',
  'West-Southwest',
  'West',
  'West-Northwest',
  'Northwest',
  'North-Northwest'
];
function compassIndex(degrees) {
  if (degrees === null || degrees === undefined || !Number.isFinite(Number(degrees))) return null;
  const normalized = ((Number(degrees) % 360) + 360) % 360;
  return Math.round(normalized / 22.5) % 16;
}
function formatWindDirection(degrees) {
  const idx = compassIndex(degrees);
  return idx === null ? '—' : COMPASS_POINTS_16[idx];
}
function formatWindDirectionFull(degrees) {
  const idx = compassIndex(degrees);
  return idx === null ? null : COMPASS_LABELS_16[idx];
}
// Build the three "current value" circles from a single DeviceRead. The
// values use the same formatters the fleet-overview cards use, so the
// number the user clicked on the fleet card visually matches the number
// they land on here. Humidity (circle 1 sub-label), Gust (circle 3 sub-label)
// and Wind direction (circle 3 caption) aren't surfaced by the DeviceRead
// summary, and even fields that ARE on DeviceRead (temperature_c, wind_speed)
// are stale or null on some devices. So the circles prefer the latest non-null
// reading from the time-series fetch (`latest`), falling back to DeviceRead
// where available. That way the snapshot matches what the chart line ends on.
//
// `device` may be null/undefined while the hook is still loading or the fleet
// is empty — each formatter returns "N/A" for missing inputs, so we don't
// need additional guards here. `displayPrefs` is the memoized object from
// useDisplayPreferences(). `latest` is the per-field latest-value object
// computed in the component from measurementRows (empty when no data).

// =============================================================================
// computeCircleValueScale — graceful font-size shrink for long readings.
// =============================================================================
//
// The circles render their main value (e.g., "65.66°F") at a large display
// fontSize tuned to look prominent against the surrounding labels. Typical
// readings — 5-7 digit numerics plus a short unit — fit the ~250 px content
// width of the 315 px circle comfortably. But the design has to handle
// outliers gracefully:
//
//   "65.66°F"      ─  7 chars  ✓ comfortable
//   "62.75 mm"     ─  8 chars  ✓ comfortable
//   "100.00 mph"   ─ 10 chars  → wraps to a second line at full size
//   "-9999.00 m/s" ─ 12 chars  → wraps badly (real error state from sensors
//                                  that report -9999 as a no-data sentinel)
//
// A wrap looks bad on the dashboard because it pushes the label and sub-label
// down asymmetrically and breaks visual rhythm between the three circles.
// Scaling the font down for longer strings keeps the value on one line and
// keeps the layout stable.
//
// Formula: full size up to 8 chars, then `Math.max(0.6, 8 / length)`. The
// 0.6 floor keeps even worst-case (20-char) strings legible — below that
// the text becomes too small to read at a glance.
//
//   length ≤ 8 → 1.00 (no scaling, full design size)
//   length = 9 → 0.89
//   length = 10 → 0.80
//   length = 11 → 0.73
//   length = 12 → 0.67
//   length = 14 → 0.60 (floor)
//
// Applied as a CSS custom property `--value-scale` on the Typography's
// style prop; the sx fontSize uses `calc(...rem * var(--value-scale, 1))`
// per breakpoint so the responsive sizes scale together.
function computeCircleValueScale(text) {
  const length = String(text ?? '').length;
  if (length <= 8) return 1;
  return Math.max(0.6, 8 / length);
}

function buildCircleMetrics(device, displayPrefs, latest) {
  const tempUnit = displayPrefs?.tempUnit ?? 'F';
  const speedUnit = displayPrefs?.speedUnit ?? 'ms';
  const rainUnit = displayPrefs?.rainUnit ?? 'mm';

  // Latest > DeviceRead fallback. Backend ships temperature in °C and wind
  // speed in m/s; the format helpers take the raw unit and the user's display
  // pref so this stays a pure pass-through.
  const tempC = latest?.temperature_mcp9808 ?? latest?.temperature_bme ?? latest?.temperature ?? device?.temperature_c;
  const humidity = latest?.humidity_bme ?? latest?.humidity;
  const windSpeedMs = latest?.wind_speed ?? device?.wind_speed;
  const windGustMs = latest?.wind_gust;
  const windDirDeg = latest?.wind_direction;

  return [
    {
      id: 'metric-1',
      icon: tempSensorIcon,
      iconAlt: 'Temperature sensor icon',
      value: formatTemperature(tempC, tempUnit),
      label: 'Current Air Temperature',
      gustLabel: 'Humidity:',
      gustValue: humidity == null ? 'N/A' : `${Math.round(humidity)}%`
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
      direction: formatWindDirection(windDirDeg),
      // Full compass name for the hover tooltip (e.g., "West-Northwest" for
      // "WNW"). Null when degrees are unknown — tooltip suppressed in that case.
      directionFull: formatWindDirectionFull(windDirDeg),
      value: formatWindSpeed(windSpeedMs, speedUnit),
      label: 'Current Windspeed',
      gustLabel: 'Gust:',
      gustValue: windGustMs == null ? 'N/A' : formatWindSpeed(windGustMs, speedUnit)
    }
  ];
}

// Shared sx for the toolbar's 3-button filter toggles (device source + soil
// probe) so both look identical. Mobile: each toggle's buttons stretch full
// width; desktop: hug content. The wrapping Stack handles row/column layout.
const filterToggleSx = {
  width: { xs: '100%', sm: 'auto' },
  '& .MuiToggleButton-root': {
    flex: { xs: 1, sm: '0 0 auto' },
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
};

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
  const tabFromUrl = searchParams.get(TAB_PARAM);

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

  // Active chart-category tab, resolved from the URL with a defensive
  // fallback to Weather for a missing/garbage ?tab= value.
  const activeTab = useMemo(() => {
    const ids = Object.values(TAB_IDS);
    return tabFromUrl && ids.includes(tabFromUrl) ? tabFromUrl : TAB_IDS.WEATHER;
  }, [tabFromUrl]);
  const setActiveTab = useCallback(
    (nextTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab && nextTab !== TAB_IDS.WEATHER) {
          next.set(TAB_PARAM, nextTab);
        } else {
          next.delete(TAB_PARAM);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const [chartLayout, setChartLayout] = useState('row');

  // Soil-probe filter for the two-probe soil charts (Both / Probe 1 / Probe 2).
  // Mirrors the wireless Sensor Network panel. Only surfaced on the All and
  // Soil tabs (the only ones with probe-keyed charts); the value is preserved
  // across tab switches so flipping away and back restores the user's pick.
  const [selectedProbe, setSelectedProbe] = useState('both');
  const showProbeToggle = activeTab === TAB_IDS.ALL || activeTab === TAB_IDS.SOIL;

  // Device-source filter (Both / Primary / Alternate) for the multi-sensor
  // charts that overlay a primary + alternate source (temperature, wind
  // speed/direction/gust). Surfaced on All, Environment, and Light — the same
  // 3-button control as the soil-probe toggle; single-source charts ignore it.
  const [selectedSource, setSelectedSource] = useState('both');
  // Shown on All + Environment only — the Light charts are all single-source,
  // so the Both/Primary/Alternate toggle has nothing to filter there.
  const showSourceToggle = activeTab === TAB_IDS.ALL || activeTab === TAB_IDS.WEATHER;

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
  const mapToggleTooltip = isMapView ? 'Base Station Measurements' : 'Map View';

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

  // Cross-page device selection. The session-scoped SelectionContext now
  // owns BOTH the explicit pick and the frozen most-recent fallback (it used
  // to be a per-page freeze here, which reset on every navigation and let a
  // device that reported mid-navigation swap the selection out from under the
  // user). The page renders from `selectedPheNodeId`; the URL `?device=` is
  // kept as a deep-link entry point + shareable mirror, not an independent
  // source of truth.
  const { selectedPheNodeId, selectPheNode } = useSelection() ?? {};

  // Deep-link bridge — a valid `?device=` is treated as an explicit pick and
  // pushed into the shared selection, so a fleet-card click / shared URL /
  // back-button navigation drives the same session selection every other
  // page reads. selectPheNode no-ops when the id is unchanged (React bails on
  // an equal setState), so re-running this on every render is cheap.
  useEffect(() => {
    if (!devices || !deviceFromUrl) return;
    const exists = devices.some((d) => d.external_device_id === deviceFromUrl);
    if (exists) selectPheNode?.(deviceFromUrl);
  }, [devices, deviceFromUrl, selectPheNode]);

  // The active device id is simply the shared selection.
  const activeDeviceId = selectedPheNodeId ?? null;

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
      // Record the explicit pick in the shared selection first so it sticks
      // app-wide (every page + a hard refresh) regardless of the URL...
      selectPheNode?.(nextDeviceId ?? null);
      // ...then mirror it to the URL so the selection stays shareable and the
      // back button walks between previously-selected devices.
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
    [setSearchParams, selectPheNode]
  );

  // The three circles' content is fully derived from the active
  // device + the user's display-unit preferences. useMemo so the array
  // reference is stable across renders when neither input has changed
  // — prevents the .map() below from remounting <Box> children
  // unnecessarily. `displayPrefs` is memoized inside the hook so a
  // re-render of this parent without a preference change doesn't
  // bust the memo.
  const displayPrefs = useDisplayPreferences();

  // Full tabbed catalog (Weather/Light/Soil/Power + Overview). Unit-resolved
  // from displayPrefs so a unit change re-derives every tab's labels and
  // transforms in lockstep with the Weather grid above.
  const measurementCatalog = useMemo(() => buildMeasurementCatalog(displayPrefs), [displayPrefs]);

  // Primary wireless sensor for this PheNode — the Soil / Light / Power tabs
  // read from it. The "primary" is the device's VIRTUAL wireless mapping
  // (device_virtual_wireless_sensors), set by a super admin in the Admin Panel
  // → Device Management → "Set Primary Sensor". DeviceRead carries
  // virtual_wireless_sensors[] of { id, external_sensor_id, label }
  // (backend api/devices/routes.py:354,511; passes through the device yup
  // schema's stripUnknown:false). When no primary is set this is null, and
  // MeasurementTabPanel renders its "no linked wireless sensor" empty state —
  // so the charts show NO wireless data until a primary is explicitly chosen.
  //
  // NOTE: this intentionally does NOT fall back to wireless_sensors[0] (the
  // first physically-linked sensor). Physical links alone must not surface
  // wireless data on the device charts — only the chosen primary does.
  const activeWirelessSensorId = activeDevice?.virtual_wireless_sensors?.[0]?.external_sensor_id ?? null;

  // Charts for the currently-active tab. Every tab — including Weather — now
  // renders through the single catalog-driven MeasurementTabPanel, so the
  // whole page uses one renderer + one grid per tab.
  // 'all' is the synthetic flat-list view — concat every category's charts so
  // the panel renders the union in one grid. Field projection (the SWR
  // hook's `fields=` param) is computed from this same array, so picking
  // 'All' costs one fetch carrying every catalog field instead of N tabs'
  // worth of separate fetches.
  const activeTabCharts = useMemo(() => {
    if (activeTab === TAB_IDS.ALL) {
      return measurementCatalog.flatMap((t) => t.charts ?? []);
    }
    return measurementCatalog.find((t) => t.id === activeTab)?.charts ?? [];
  }, [activeTab, measurementCatalog]);

  // Formatted "Last Measurements Taken" string for the page header.
  // Uses the shared transform (returns "Never" for null,
  // "Unknown" for an unparseable string) so this page surfaces the
  // same vocabulary as the fleet cards.
  const lastMeasurementsDisplay = activeDevice ? formatLastMeasurement(activeDevice.last_measurement_at, displayPrefs.timezone) : '—';

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
      const { blob, filename } = await downloadDeviceSensorData(activeDevice.external_device_id, fromIso, toIso, accessToken);
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
    isValidating: measurementsValidating
  } = useDeviceMeasurements(activeDeviceId, {
    from,
    to,
    fields: DEVICE_CHART_FIELDS,
    bucket: 'auto'
  });

  // Latest non-null value per field — feeds the snapshot KPI circles below so
  // they reflect what the chart line ends on, not the (often stale or missing)
  // DeviceRead summary. Walks rows in reverse and grabs the first non-null
  // `avg` for each field name encountered. Memoized on measurementRows so a
  // 60s background poll only re-derives when data actually changed.
  const latestValues = useMemo(() => {
    if (!measurementRows?.length) return {};
    const result = {};
    for (let i = measurementRows.length - 1; i >= 0; i--) {
      const fields = measurementRows[i].fields ?? {};
      for (const key of Object.keys(fields)) {
        if (result[key] !== undefined) continue;
        const v = fields[key]?.avg;
        if (v !== null && v !== undefined) result[key] = v;
      }
    }
    return result;
  }, [measurementRows]);

  const circleMetrics = useMemo(
    () => buildCircleMetrics(activeDevice, displayPrefs, latestValues),
    [activeDevice, displayPrefs, latestValues]
  );

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
              Base Station Measurements
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
                  boxShadow: '0 11px 19px 1px #0000002e',
                  '&:hover': { borderColor: 'var(--green)' }
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
                        <Tooltip
                          // Themed tooltip — uses the same slotProps shape every
                          // other affordance on this page (map toggle, enlarge,
                          // info icons) so the compass-name hover reads as part
                          // of the same control family.
                          title={metric.directionFull || ''}
                          disableHoverListener={!metric.directionFull}
                          arrow={false}
                          slotProps={tooltipSlotProps}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'var(--blue)',
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              lineHeight: 1,
                              // Belt-and-braces: the formatter already returns
                              // uppercase, but the CSS guarantees the abbreviation
                              // never renders lowercase if the source ever changes.
                              textTransform: 'uppercase',
                              cursor: metric.directionFull ? 'help' : 'default'
                            }}
                          >
                            {metric.direction}
                          </Typography>
                        </Tooltip>
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
                        // Length-aware font-size scale. The CSS
                        // variable `--value-scale` multiplies into the
                        // breakpoint fontSize values below so a long
                        // reading (e.g. "-9999.00 m/s") shrinks to
                        // fit on one line, while typical readings
                        // (e.g. "65.66°F") stay at the full design
                        // size. See computeCircleValueScale at module
                        // scope for the formula + thresholds.
                        //
                        // `whiteSpace: 'nowrap'` is the safety net —
                        // if a value ever exceeds what the scale can
                        // accommodate (>20 chars, scale floor 0.6),
                        // the text stays on one line and the circle's
                        // overflow:hidden quietly clips rather than
                        // pushing the label and sub-label down. In
                        // practice the scale always handles real-world
                        // readings; this is just a belt-and-braces
                        // guard against a malformed value upstream.
                        style={{ '--value-scale': computeCircleValueScale(metric.value) }}
                        sx={{
                          color: 'var(--green)',
                          lineHeight: 1,
                          fontWeight: 300,
                          fontSize: {
                            xs: 'calc(3.2rem * var(--value-scale, 1))',
                            sm: 'calc(3.4rem * var(--value-scale, 1))',
                            md: 'calc(3.7rem * var(--value-scale, 1))'
                          },
                          whiteSpace: 'nowrap',
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

              {/*
                Title-row corner control. On desktop (md+) this slot
                holds the orientation toggle; on mobile (xs) it holds
                the CSV download IconButton instead.
                  - Orientation is meaningless on mobile (the chart
                    grid already renders a single column at xs), so the
                    row/column swap carries no information.
                  - Download IS meaningful on mobile, and the toolbar
                    version below would otherwise crowd the category
                    Select on a narrow viewport. Hoisting it up here
                    clears the toolbar and keeps the affordance one
                    tap away.
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
                title={measurementRows?.length ? 'Download data for this time period' : 'No data to download'}
                arrow={false}
                slotProps={tooltipSlotProps}
              >
                {/* Span wrapper keeps the tooltip working while the
                    button is disabled. */}
                <Box component="span" sx={{ display: { xs: 'inline-flex', md: 'none' }, flexShrink: 0 }}>
                  <IconButton
                    aria-label="download csv for this range"
                    onClick={handleDownload}
                    disabled={!measurementRows?.length || downloading || !activeDevice}
                    sx={{
                      color: 'var(--blue)',
                      border: '1px solid var(--reflected-light)',
                      borderRadius: 1,
                      backgroundColor: 'var(--drf)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      '&:hover': { color: 'var(--green)', borderColor: 'var(--green)', backgroundColor: 'var(--drf)' }
                    }}
                  >
                    {downloading ? <CircularProgress size={16} sx={{ color: 'var(--green)' }} /> : <AntIcon icon={DownloadOutlined} />}
                  </IconButton>
                </Box>
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

                  {/* Category selector — the 4 chart categories collapsed into
                      one dropdown next to the time-range control. Click rolls
                      the options out; choosing one closes it. Mirrors the
                      time-range Select styling for a consistent control family. */}
                  <FormControl
                    size="small"
                    sx={{ minWidth: { xs: 0, sm: 200 }, width: { xs: '100%', sm: 200 }, flex: { xs: 1, sm: '0 0 auto' } }}
                  >
                    <Select
                      value={activeTab}
                      onChange={(event) => setActiveTab(event.target.value)}
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
                            {selected === TAB_IDS.ALL
                              ? 'All'
                              : (measurementCatalog.find((tab) => tab.id === selected)?.label ?? 'Category')}
                          </Box>
                        </Stack>
                      )}
                    >
                      {measurementCatalog.map((tab) => (
                        <MenuItem
                          key={tab.id}
                          value={tab.id}
                          sx={{
                            color: 'var(--green)',
                            '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' },
                            '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.18)' }
                          }}
                        >
                          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', mr: 1 }}>
                            {categoryIcon(tab.id)}
                          </Box>
                          {tab.label}
                        </MenuItem>
                      ))}
                      <MenuItem
                        key={TAB_IDS.ALL}
                        value={TAB_IDS.ALL}
                        sx={{
                          color: 'var(--green)',
                          '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' },
                          '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.18)' }
                        }}
                      >
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', mr: 1 }}>
                          {categoryIcon(TAB_IDS.ALL)}
                        </Box>
                        All
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {/* Download CSV — sits next to the category dropdown
                      on desktop. Hidden on xs because the title-row
                      Stack above hosts a mirror of this button for
                      mobile (where the toolbar version would crowd the
                      category Select). Hiding via display rather than
                      unmounting keeps focus tied to a stable node if
                      the viewport resizes mid-session. */}
                  <Tooltip
                    title={measurementRows?.length ? 'Download data for this time period' : 'No data to download'}
                    arrow={false}
                    slotProps={tooltipSlotProps}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline-flex' }, flexShrink: 0 }}>
                      <IconButton
                        aria-label="download csv for this range"
                        onClick={handleDownload}
                        disabled={!measurementRows?.length || downloading || !activeDevice}
                        sx={{
                          color: 'var(--blue)',
                          border: '1px solid var(--reflected-light)',
                          borderRadius: 1,
                          backgroundColor: 'var(--drf)',
                          boxShadow: '0 11px 19px 1px #0000002e',
                          '&:hover': { color: 'var(--green)', borderColor: 'var(--green)', backgroundColor: 'var(--drf)' }
                        }}
                      >
                        {downloading ? <CircularProgress size={16} sx={{ color: 'var(--green)' }} /> : <AntIcon icon={DownloadOutlined} />}
                      </IconButton>
                    </Box>
                  </Tooltip>

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
                  Filter toggles — device source (Both/Primary/Alternate)
                  and/or soil probe (Both/Probe 1/Probe 2), depending on the
                  active tab. Wrapped in one Stack so on desktop they sit at
                  the right edge with the source toggle LEFT of the soil toggle
                  and a small gap; on mobile they stack full-width, source
                  ABOVE soil. MeasurementTabPanel does the actual filtering.
                */}
                {(showSourceToggle || showProbeToggle) && (
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, width: { xs: '100%', sm: 'auto' } }}
                  >
                    {showSourceToggle && (
                      <Stack spacing={0.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                        {/* "Device:" / "Soil:" captions only when BOTH toggles
                            are shown (the All tab) — they disambiguate the two
                            otherwise-identical controls. On single-toggle tabs
                            the label is unnecessary and omitted. */}
                        {showSourceToggle && showProbeToggle && (
                          <Typography sx={{ color: 'var(--blue)', fontSize: '0.72rem', fontWeight: 600, lineHeight: 1 }}>
                            Device:
                          </Typography>
                        )}
                        <ToggleButtonGroup
                          exclusive
                          value={selectedSource}
                          onChange={(_, next) => {
                            if (next != null) setSelectedSource(next);
                          }}
                          size="small"
                          aria-label="sensor source filter"
                          sx={filterToggleSx}
                        >
                          <ToggleButton value="both">Both</ToggleButton>
                          <ToggleButton value="primary">Primary</ToggleButton>
                          <ToggleButton value="alternate">Alternate</ToggleButton>
                          {/* Aux only isolates the temperature chart's BME688
                              line; charts without an Aux series ignore it. */}
                          <ToggleButton value="aux">Aux</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                    )}
                    {showProbeToggle && (
                      <Stack spacing={0.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                        {showSourceToggle && showProbeToggle && (
                          <Typography sx={{ color: 'var(--blue)', fontSize: '0.72rem', fontWeight: 600, lineHeight: 1 }}>Soil:</Typography>
                        )}
                        <ToggleButtonGroup
                          exclusive
                          value={selectedProbe}
                          onChange={(_, next) => {
                            if (next != null) setSelectedProbe(next);
                          }}
                          size="small"
                          aria-label="soil probe filter"
                          sx={filterToggleSx}
                        >
                          <ToggleButton value="both">Both</ToggleButton>
                          <ToggleButton value="1">Probe 1</ToggleButton>
                          <ToggleButton value="2">Probe 2</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                    )}
                  </Stack>
                )}
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
            {/* Every tab renders through the single catalog-driven panel, which
                owns its own device/wireless fetching + loading / empty / error
                states. Only the active tab is mounted. */}
            <Suspense
              fallback={
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ minHeight: { xs: 320, md: 380 }, alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}
                  role="status"
                  aria-live="polite"
                >
                  <CircularProgress size={22} sx={{ color: 'var(--green)' }} />
                  <Box component="span">Loading…</Box>
                </Stack>
              }
            >
              <MeasurementTabPanel
                charts={activeTabCharts}
                deviceId={activeDeviceId}
                wirelessSensorId={activeWirelessSensorId}
                from={from}
                to={to}
                axisFormat={axisFormat}
                xAxisTicks={xAxisTicks}
                layout={chartLayout}
                selectedProbe={selectedProbe}
                selectedSource={selectedSource}
              />
            </Suspense>
          </Box>
        </Box>
      </MainCard>
    </>
  );
}
