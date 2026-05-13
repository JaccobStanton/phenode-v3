import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';

import MainCard from 'components/MainCard';
import PhenodeSelector from 'components/PhenodeSelector';
import PheNodeFleetMap from 'sections/sensor-measurements/phenode-fleet-map';
import useAuth from 'hooks/useAuth';
import useMyDevices from 'hooks/data/useMyDevices';
import useDeviceMeasurements from 'hooks/data/useDeviceMeasurements';
import { renameDevice } from 'services/mutations';
import { formatLastMeasurement, formatTemperature, formatTodaysRainfall, formatWindSpeed } from 'utils/transforms/device';
import { CHART_TIME_RANGE_LABELS, DEFAULT_CHART_TIME_RANGE, computeChartWindow, formatAxisTick } from 'utils/chartTimeRanges';
import rainSensorIcon from 'assets/sensor-measurements/Rain.svg';
import tempSensorIcon from 'assets/sensor-measurements/Temp.svg';
import windSensorIcon from 'assets/sensor-measurements/Wind.svg';
import mapIconActive from 'assets/toggle_buttons/Map_Icon_Active.svg';
import mapIconInactive from 'assets/toggle_buttons/Map_Icon_Inactive.svg';
import phenodeFleetIcon from 'assets/drawer-icons/PheNode_Fleet.svg';
import phenodeFleetIconActive from 'assets/drawer-icons/PheNode_Fleet_Active.svg';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import ZoomInOutlined from '@ant-design/icons/ZoomInOutlined';

import {
  reflectedCardChromeSx,
  orientationButtonSx,
  tooltipSlotProps,
  neonSelectMenuPaperProps,
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

// Search-param name the fleet-overview card click writes to (and that
// this page reads from). Pulling it to a constant keeps the contract
// between the two pages discoverable in one place — if we ever rename
// the param, both sides flip together.
const DEVICE_PARAM = 'device';

// =============================================================================
// DEV-ONLY MOCK NEARBY DEVICES — REMOVE WHEN FLEET HAS MULTIPLE REAL DEVICES
// =============================================================================
//
// Synthesizes 5 fake PheNodes at small lat/lng offsets from the first real
// device with valid coordinates. Lets us exercise the proximity feature
// (radius circle, dim outside-radius pins, fit-to-neighbors, nearby list)
// when the user's account only has one real device.
//
// To disable: flip MOCK_NEARBY_DEVICES_FOR_TESTING to false. To remove
// entirely: delete this constant, makeMockNearbyDevices(), and the
// augmentedDevices useMemo inside SensorMeasurements (search for
// "MOCK_NEARBY_DEVICES_FOR_TESTING").
//
// Caveats while this is on:
//   - The mocks appear in the PheNodeSelector dropdown too. Selecting one
//     will load empty chart data (useDeviceMeasurements 404s on a mock id).
//     The map view is unaffected.
//   - Renaming a mock will hit a backend 404. Don't.
const MOCK_NEARBY_DEVICES_FOR_TESTING = true;

// Fixed "15 minutes before page load" timestamp shared by every mock.
// MUST be computed at module load (not inside makeMockNearbyDevices),
// otherwise every call regenerates timestamps and the augmented devices
// array gets a genuinely-different value on every SWR refresh — defeating
// the compare-based skip in useMyDevices and reintroducing the periodic
// re-render that was the whole reason we wired compare up.
const MOCK_RECENT_ISO = new Date(Date.now() - 15 * 60 * 1000).toISOString();

function makeMockNearbyDevices(reference) {
  if (!reference || typeof reference.latitude !== 'number' || typeof reference.longitude !== 'number') {
    return [];
  }
  const { latitude: lat, longitude: lng } = reference;
  const recentISO = MOCK_RECENT_ISO;
  // Skeleton fields shared by every mock — saves repetition. Each mock
  // overrides label, lat/lng offsets, and a few "varied" metric values.
  const skeleton = {
    organization_id: null,
    timezone: null,
    health: null,
    sensors: null,
    fw_version: 'mock-1.0.0',
    hw_version: 'mock-1',
    created_at: recentISO,
    updated_at: recentISO,
    assigned_user: null,
    wireless_sensors: [],
    virtual_wireless_sensors: []
  };
  // Offsets chosen to span "well inside the 10mi proximity radius" through
  // "well outside" so the proximity feature has both kinds of pins to
  // demonstrate:
  //   FIELD-A:       ~1.5 mi    inside radius
  //   FIELD-B:       ~2.7 mi    inside radius
  //   WEST-RIDGE:    ~6.0 mi    inside radius
  //   NORTH-FIELD:   ~3.4 mi    inside radius
  //   FAR-EAST:     ~19.4 mi    OUTSIDE radius — exercises the dim effect
  // (0.01° latitude ≈ 0.69 mi; longitude scales by cos(lat), but this is
  // close enough for demo data — exact distances render via haversine.)
  return [
    {
      ...skeleton,
      id: 99001,
      external_device_id: 'MOCK-FIELD-A',
      label: 'Field A',
      latitude: lat + 0.02,
      longitude: lng + 0.015,
      last_measurement_at: recentISO,
      health_status: 'Active',
      temperature_c: 22.5,
      rainfall_today_mm: 0.2,
      wind_speed: 4.1,
      battery_percent: 87.5
    },
    {
      ...skeleton,
      id: 99002,
      external_device_id: 'MOCK-FIELD-B',
      label: 'Field B',
      latitude: lat - 0.025,
      longitude: lng + 0.03,
      last_measurement_at: recentISO,
      health_status: 'Active',
      temperature_c: 24.1,
      rainfall_today_mm: 0,
      wind_speed: 6.8,
      battery_percent: 92.0
    },
    {
      ...skeleton,
      id: 99003,
      external_device_id: 'MOCK-WEST-RIDGE',
      label: 'West Ridge',
      latitude: lat + 0.06,
      longitude: lng - 0.05,
      last_measurement_at: recentISO,
      health_status: 'Active',
      temperature_c: 19.8,
      rainfall_today_mm: 1.2,
      wind_speed: 9.4,
      battery_percent: 64.2
    },
    {
      ...skeleton,
      id: 99004,
      external_device_id: 'MOCK-NORTH-FIELD',
      label: 'North Field',
      latitude: lat + 0.05,
      longitude: lng + 0.005,
      last_measurement_at: recentISO,
      health_status: 'Active',
      temperature_c: 21.0,
      rainfall_today_mm: 0,
      wind_speed: 5.5,
      battery_percent: 78.3
    },
    {
      ...skeleton,
      id: 99005,
      external_device_id: 'MOCK-FAR-EAST',
      label: 'Far Eastern Plot',
      latitude: lat + 0.22,
      longitude: lng + 0.18, // ~19mi — OUTSIDE proximity radius
      last_measurement_at: recentISO,
      health_status: 'Offline',
      temperature_c: 18.3,
      rainfall_today_mm: 0.5,
      wind_speed: 2.1,
      battery_percent: 41.8
    }
  ];
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
    filter: 'drop-shadow(0 0 8px var(--chart-line-color))'
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
  const [timeRange, setTimeRange] = useState(DEFAULT_CHART_TIME_RANGE);
  const [chartLayout, setChartLayout] = useState('row');

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
  const { from, to, axisFormat } = useMemo(() => computeChartWindow(timeRange), [timeRange]);

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
  const [isMapView, setIsMapView] = useState(false);
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

  // URL search params drive which PheNode this page is scoped to. URL
  // is the source of truth so deep links from the fleet-overview cards
  // (and bookmarks / shared links) refresh-survive without any local
  // state shimming.
  const [searchParams, setSearchParams] = useSearchParams();
  const deviceFromUrl = searchParams.get(DEVICE_PARAM);

  const { devices: rawDevices, isLoading: devicesLoading, mutate: mutateDevices } = useMyDevices();

  // DEV-ONLY: augment the real device list with mock nearby devices so the
  // proximity feature has something to plot when the account only contains
  // one real PheNode. Disable by flipping MOCK_NEARBY_DEVICES_FOR_TESTING
  // (top of this file) to false, or remove this entire useMemo + the
  // makeMockNearbyDevices function + the constant when done testing.
  //
  // Returns the raw list unchanged when the flag is off, the fleet is
  // empty, or no real device has valid coordinates. The find() picks the
  // first real device with coords so mocks anchor to a known-good
  // position regardless of which device the user has selected.
  const devices = useMemo(() => {
    if (!MOCK_NEARBY_DEVICES_FOR_TESTING) return rawDevices;
    if (!rawDevices?.length) return rawDevices;
    const reference = rawDevices.find((d) => typeof d?.latitude === 'number' && typeof d?.longitude === 'number');
    if (!reference) return rawDevices;
    return [...rawDevices, ...makeMockNearbyDevices(reference)];
  }, [rawDevices]);
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

  // Resolve the active device id, preferring the URL value but falling
  // back to the recency-default. We tolerate a URL value that no
  // longer matches any device (e.g. the user deep-linked an external_id
  // that's since been removed) by treating the unmatched case the same
  // as "no URL value" and falling through to the default.
  const activeDeviceId = useMemo(() => {
    if (deviceFromUrl) {
      const exists = devices?.some((d) => d.external_device_id === deviceFromUrl);
      if (exists) return deviceFromUrl;
    }
    return defaultPhenodeId;
  }, [deviceFromUrl, devices, defaultPhenodeId]);

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
  const {
    rows: measurementRows,
    isLoading: measurementsLoading,
    error: measurementsError,
    mutate: refetchMeasurements
  } = useDeviceMeasurements(activeDeviceId, {
    from,
    to,
    fields: DEVICE_CHART_FIELDS,
    bucket: 'auto'
  });

  // Pre-compute the X-axis timestamp array once per data refresh.
  // Every chart shares this exact array (same X for every metric of
  // the same device, by definition), so building it once at the
  // panel level rather than inside each chart's render saves both
  // memory allocation and re-render churn.
  const chartTimes = useMemo(() => {
    if (!measurementRows) return [];
    return measurementRows.map((row) => new Date(row.time));
  }, [measurementRows]);

  // Per-chart series data. Returns an object keyed by field name with
  // the rendered value array for that field, so the chart loop below
  // is a simple lookup rather than a per-iteration .map() over rows.
  //
  // For raw rows the hook already collapses min/max/avg to a single
  // value (set all three to the raw value), so reading `.avg` works
  // uniformly. Bucketed rows are likewise rendered against `.avg`
  // for the line — future work could add a translucent min/max
  // envelope using the same row data, but the line alone is the
  // baseline a chart layer always supports.
  //
  // `null` values pass through unchanged — MUI x-charts interprets
  // null as a "no data point" gap, so a missing reading shows as a
  // visible break in the line rather than a misleading zero.
  const chartSeriesByField = useMemo(() => {
    if (!measurementRows) return {};
    const seriesMap = {};
    for (const config of DEVICE_CHART_CONFIGS) {
      const transform = config.transform;
      seriesMap[config.key] = measurementRows.map((row) => {
        const field = row.fields[config.key];
        if (!field) return null;
        const raw = field.avg;
        if (raw === null || raw === undefined) return null;
        return transform ? transform(raw) : raw;
      });
    }
    return seriesMap;
  }, [measurementRows]);

  return (
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
            <Box component="span" sx={{ color: 'var(--green)', ml: { xs: 'auto', md: 1.5 }, display: 'inline-block', textAlign: 'right' }}>
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
        Content area — gates on isMapView. When the map toggle is on,
        we render the PheNodeFleetMap (Google Maps view of the fleet)
        instead of the circles + chart panel. We don't unmount the
        regular view by toggling display; we conditionally render the
        whole branch so the chart components don't try to lay out while
        hidden (which causes MUI x-charts to compute size against a
        zero-height box on first reveal).
      */}
      {isMapView ? (
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
          <PheNodeFleetMap
            devices={devices}
            selectedDeviceId={activeDeviceId}
            onSelectDevice={handlePhenodeChange}
            activeDevice={activeDevice}
            onRename={handleRename}
            isLoading={devicesLoading}
          />
        </Box>
      ) : (
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
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
                      <Typography variant="caption" sx={{ color: 'var(--blue)', fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1 }}>
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

          <Box
            sx={{
              borderRadius: 1,
              p: { xs: 1.5, sm: 2 },
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

            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 2 }}>
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
                  MenuProps={{
                    PaperProps: neonSelectMenuPaperProps
                  }}
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
                </Select>
              </FormControl>
              <Tooltip title="Refresh" arrow={false} slotProps={tooltipSlotProps}>
                <IconButton
                  aria-label="refresh sensor charts"
                  // Manual revalidation — bypasses the SWR cache for
                  // the current key, refetches, and surfaces fresh
                  // rows. Useful when the user knows new data is
                  // available out-of-band (e.g., they just triggered
                  // a device reading) and doesn't want to wait for
                  // the 60s poll cycle.
                  onClick={() => refetchMeasurements()}
                  sx={{
                    border: '1px solid var(--reflected-light)',
                    color: 'var(--purple)',
                    backgroundColor: 'rgba(0, 20, 61, 0.72)',
                    boxShadow: '0 11px 19px 1px #0000002e',
                    '&:hover': {
                      borderColor: 'var(--green)',
                      boxShadow: '0 0 7px -5px var(--green)',
                      color: 'var(--green)',
                      textShadow: '0 1px 5px #007bff',
                      backgroundColor: 'rgba(72, 247, 245, 0.08)'
                    }
                  }}
                >
                  <ReloadOutlined />
                </IconButton>
              </Tooltip>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns:
                  chartLayout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr'
              }}
            >
              {DEVICE_CHART_CONFIGS.map((config) => {
                const seriesData = chartSeriesByField[config.key] ?? [];
                // Non-null values present in the series — drives both
                // the empty-state branch and the Y-axis padding math.
                // We compute this once per chart so the min/max scan
                // doesn't run twice.
                const numericValues = seriesData.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
                const hasData = chartTimes.length > 0 && numericValues.length > 0;

                // Y-axis padding — 4% of the range, with a 0.1 floor
                // so a flat series (every value identical) still
                // renders a visible band rather than collapsing the
                // line into the axis. Original mock had the same
                // recipe; kept here verbatim because the visual is
                // tuned to it.
                const minVal = hasData ? Math.min(...numericValues) : 0;
                const maxVal = hasData ? Math.max(...numericValues) : 1;
                const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

                return (
                  <Box
                    key={config.key}
                    // Per-chart CSS variable for the line/glow color.
                    // The shared `chartSx` references this var so we
                    // don't have to build a different sx object per
                    // chart — keeps `chartSx` a single hoisted
                    // reference instead of N reconstructed objects.
                    style={{ '--chart-line-color': config.color }}
                    sx={{
                      borderRadius: 1,
                      p: { xs: 0.45, sm: 0.65 },
                      minHeight: { xs: 260, sm: 286 },
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
                      </Typography>
                      <IconButton aria-label={`zoom ${config.title}`} size="small" sx={{ color: 'var(--blue)' }}>
                        <ZoomInOutlined />
                      </IconButton>
                    </Stack>

                    {/*
                      Three render branches: error → loading → empty →
                      chart. Order matters: an error during a
                      background refresh shouldn't blank a chart that
                      previously had data, but the FIRST fetch failing
                      should surface clearly. We special-case
                      `!measurementRows` (no data yet) so the loading
                      and error states only fire before any data has
                      arrived; once we have rows, we render them even
                      while a poll is in flight (stale-while-revalidate).
                    */}
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
                      <Box
                        sx={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--blue)',
                          fontSize: '0.85rem'
                        }}
                      >
                        Loading…
                      </Box>
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
                            // Time-scale axis — was 'point' (categorical)
                            // in the mock-data version, which meant
                            // evenly-spaced ticks regardless of actual
                            // timestamp gaps. 'time' draws ticks against
                            // real wall-clock positions, so a 6h data
                            // gap reads as a 6h gap visually.
                            id: `${config.key}-x`,
                            scaleType: 'time',
                            data: chartTimes,
                            tickLabelStyle: { fontSize: 11, fill: 'var(--green)' },
                            valueFormatter: (value) => formatAxisTick(value, axisFormat)
                          }
                        ]}
                        yAxis={[
                          {
                            id: `${config.key}-y`,
                            min: minVal - pad,
                            max: maxVal + pad,
                            width: 30,
                            tickLabelStyle: { fill: 'var(--green)' },
                            valueFormatter: makeYAxisFormatter(config.unit)
                          }
                        ]}
                        series={[
                          {
                            id: `${config.key}-line`,
                            data: seriesData,
                            color: config.color,
                            area: true,
                            showMark: false,
                            curve: 'linear',
                            // Tooltip value formatter — pretty-prints
                            // the hover value with the chart's unit
                            // suffix so the user can tell whether they're
                            // looking at "23.5 m/s" vs "23.5 %".
                            valueFormatter: (value) =>
                              value === null || value === undefined
                                ? 'No data'
                                : `${Number(value).toFixed(2)}${config.unit ? ` ${config.unit}` : ''}`
                          }
                        ]}
                        grid={{ horizontal: true, vertical: true }}
                        height={chartLayout === 'row' ? 228 : 258}
                        margin={{ top: 2, right: 16, bottom: 10, left: 10 }}
                        hideLegend
                        sx={chartSx}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}
    </MainCard>
  );
}
