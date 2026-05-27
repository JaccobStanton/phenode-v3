import { useCallback, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';

import MainCard from 'components/MainCard';
import PhenodeSelector from 'components/PhenodeSelector';
import { useSelection } from 'contexts/SelectionContext';
import useMyDevices from 'hooks/data/useMyDevices';
import useDeviceHealth from 'hooks/data/useDeviceHealth';
import useDeviceMeasurements from 'hooks/data/useDeviceMeasurements';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import useAuth from 'hooks/useAuth';
import { useToast } from 'providers/ToastProvider';
import { downloadDeviceHealthData } from 'services/mutations';
import triggerBlobDownload from 'utils/triggerBlobDownload';
// Colorless wireframe base — the sensor pieces below carry all the color
// (green = Active, purple = Inactive), so the base art stays neutral and only
// the lit/unlit pieces communicate state. Shares the same 390.8 x 253.8
// viewBox as every piece, so the layers still register exactly.
import phenodeDiagram from 'assets/diagnostics/Diagnosics_Wireframe.svg';
import wirelessSensorsDiagram from 'assets/diagrams/Wireless-Sensors.svg';

// Per-sensor diagram pieces. Each sensor has an Active (green) and an
// Inactive (purple) variant exported from the same Illustrator artboard, so
// every file shares the base diagram's viewBox (0 0 390.8 253.8). That shared
// coordinate space is what lets us stack a piece directly over the base art
// and have it register pixel-for-pixel — see the overlay block in the diagram
// card below. The status card for each sensor decides which variant renders.
import rainActive from 'assets/diagnostics/Rain_Active.svg';
import rainInactive from 'assets/diagnostics/Rain_Inactive.svg';
import cameraActive from 'assets/diagnostics/Camera_Active.svg';
import cameraInactive from 'assets/diagnostics/Camera_Inactive.svg';
import solarRadiationActive from 'assets/diagnostics/Solar_Radiation_Active.svg';
import solarRadiationInactive from 'assets/diagnostics/Solar_Radiation_Inactive.svg';
import soilActive from 'assets/diagnostics/Soil_Active.svg';
import soilInactive from 'assets/diagnostics/Soil_Inactive.svg';
import windActive from 'assets/diagnostics/Wind_Active.svg';
import windInactive from 'assets/diagnostics/Wind_Inactive.svg';
import airLightActive from 'assets/diagnostics/WS_Active.svg';
import airLightInactive from 'assets/diagnostics/WS_Inactive.svg';
// Control box is always-on — it has no Inactive variant and isn't tied to a
// status card, so it renders as a permanent lit layer over the base art.
import controlBoxActive from 'assets/diagnostics/Control_Box_Active.svg';

import AntIcon from 'components/AntIcon';
import ClockCircleOutlined from '@ant-design/icons-svg/lib/asn/ClockCircleOutlined';
import AppstoreOutlined from '@ant-design/icons-svg/lib/asn/AppstoreOutlined';
import DownloadOutlined from '@ant-design/icons-svg/lib/asn/DownloadOutlined';
import ZoomInOutlined from '@ant-design/icons-svg/lib/asn/ZoomInOutlined';

import {
  glassSurfaceSx,
  reflectedCardChromeSx,
  drfSurfaceSx,
  orientationButtonSx,
  tooltipSlotProps,
  neonSelectMenuPaperProps
} from 'themes/sx-tokens';
import {
  CHART_TIME_RANGE_LABELS,
  DEFAULT_CHART_TIME_RANGE,
  axisTickNumberFor,
  computeAxisTicks,
  computeChartWindow,
  formatAxisTick,
  formatTooltipDate
} from 'utils/chartTimeRanges';

// System diagnostics uses a slightly different chart surface (gradient + custom border).
const chartSurfaceSx = {
  backgroundColor: '#07143f',
  backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
  border: '1px solid #0e346a'
};

// Module-scope constants - hoisted to avoid being re-created every render.
const signalBarHeights = [12, 18, 24, 30];

const SENSOR_ACTIVE_COLOR = 'var(--green)';
const SENSOR_INACTIVE_COLOR = 'var(--purple)';

// Base definitions for the six sensor status cards. Each carries its diagram
// pieces plus the `healthKeys` to look up in the device's backend-computed
// `sensor_health` map. Status/colors are derived per-render (see
// deriveSensorCards) so the bottom status card and its diagram overlay piece
// always read the same Active/Inactive value.
//
// `sensor_health` (DeviceRead.sensor_health) is a flat { key: "Active" |
// "Not Active" } map the backend builds from the device's latest samples
// (_sensor_health_for_device in api/devices/routes.py). Keys are sensor ids,
// with dedicated `rain_sensor` + `camera` entries; a sensor id that appears
// more than once is suffixed (e.g. teros12_1, teros12_2), so we match a key
// that equals the id OR starts with `${id}_`.
//
// Card → sensor_health key mapping:
//   • Rainfall        → rain_sensor (backend's dedicated rain key)
//   • Camera          → camera (driven by last_image_ts server-side)
//   • Solar Radiation → atmos41 (no dedicated key; the all-in-one station
//                       carries the pyranometer reading)
//   • Soil            → teros12 (+ teros12_1 / teros12_2 when multiple)
//   • Air & Light     → atmos14
//   • Wind            → atmos22 / calypso
const SENSOR_CARDS = [
  { title: 'Rainfall', activeSvg: rainActive, inactiveSvg: rainInactive, healthKeys: ['rain_sensor'] },
  { title: 'Camera', activeSvg: cameraActive, inactiveSvg: cameraInactive, healthKeys: ['camera'] },
  { title: 'Solar Radiation', activeSvg: solarRadiationActive, inactiveSvg: solarRadiationInactive, healthKeys: ['atmos41'] },
  { title: 'Soil', activeSvg: soilActive, inactiveSvg: soilInactive, healthKeys: ['teros12'] },
  { title: 'Air & Light', activeSvg: airLightActive, inactiveSvg: airLightInactive, healthKeys: ['atmos14'] },
  { title: 'Wind', activeSvg: windActive, inactiveSvg: windInactive, healthKeys: ['atmos22', 'calypso'] }
];

// Backend reports exactly "Active" / "Not Active" (_sample_status_to_health).
const HEALTH_ACTIVE = 'Active';

// A card is active when the sensor_health map reports "Active" for any key that
// matches one of its healthKeys (exact id, or `${id}_…` suffixed duplicate).
const sensorHealthActive = (sensorHealth, healthKeys) => {
  if (!sensorHealth) return false;
  return healthKeys.some((prefix) =>
    Object.entries(sensorHealth).some(([key, value]) => (key === prefix || key.startsWith(`${prefix}_`)) && value === HEALTH_ACTIVE)
  );
};

// Resolve render-ready cards (status + colors) from the device's sensor_health.
const deriveSensorCards = (device) => {
  const sensorHealth = device?.sensor_health ?? {};
  return SENSOR_CARDS.map((card) => {
    const status = sensorHealthActive(sensorHealth, card.healthKeys) ? 'Active' : 'Inactive';
    const color = status === 'Active' ? SENSOR_ACTIVE_COLOR : SENSOR_INACTIVE_COLOR;
    return { ...card, status, statusColor: color, notchColor: color };
  });
};

// Shared style for every layer in the diagram stack (the base art plus each
// sensor piece). Because all SVGs share the same viewBox, giving every layer
// the same box and `objectFit: contain` makes them line up exactly. The pieces
// are decorative echoes of the status cards, so they're inert to pointer +
// screen-reader.
const diagramLayerSx = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  pointerEvents: 'none'
};

// ---------------------------------------------------------------------------
// Live-data helpers.
// ---------------------------------------------------------------------------

// Coerce a backend value to a finite number or null. The health dict + rows
// can carry strings, nulls, or absent keys; everything funnels through here so
// downstream math + formatting only ever see `number | null`.
const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

// Signal bars arrive 0–4 from the backend. Clamp + round defensively so a
// stray 5 or a float still maps to a sane filled-bar count (0 when missing).
const clampBars = (value) => {
  const n = toNumber(value);
  if (n === null) return 0;
  return Math.max(0, Math.min(4, Math.round(n)));
};

const cToF = (celsius) => (celsius * 9) / 5 + 32;
const identity = (v) => v;
const mvToV = (mv) => mv / 1000;
const vToMv = (v) => v * 1000;

// Internal temperature color thresholds are defined in °F (with °C
// equivalents); the band is the same physical temperature regardless of the
// unit the user displays, so we always classify on the °F value.
//   ≤ 75 °F        → green
//   76–120 °F      → orange
//   ≥ 121 °F       → critical
// Missing reading → blue (the page's neutral label color), not a status color.
const tempColorFromF = (tempF) => {
  if (tempF === null) return 'var(--blue)';
  if (tempF <= 75) return 'var(--green)';
  if (tempF <= 120) return 'var(--orange)';
  return 'var(--critical)';
};

// Battery charge color thresholds (percent):
//   0–30   → critical
//   31–60  → orange
//   61–100 → green
const batteryColorFromPct = (pct) => {
  if (pct === null) return 'var(--blue)';
  if (pct <= 30) return 'var(--critical)';
  if (pct <= 60) return 'var(--orange)';
  return 'var(--green)';
};

// Health fields fetched for the time-series charts (subset of the hook's
// KNOWN_HEALTH_FIELDS). `bars`/`wifi_snr`/`wifi_bars` aren't plotted here, so
// we don't request them — keeps the payload lean on long ranges.
const HEALTH_CHART_FIELDS = ['notecard_temp', 'rssi', 'sinr', 'notecard_voltage', 'wifi_rssi'];
// Battery voltage is an *environmental* metric (analog board measurement),
// served by the sensor-data feed — not part of the Notecard health series.
const ENV_CHART_FIELDS = ['battery_voltage'];

// Per-chart configuration for the "Diagnostics Over Time" panel. `source`
// selects which feed the series comes from; `field` is the normalized row key;
// `transform` adapts the raw value to the displayed unit.
//
// NOTE on the two voltages (flagged for confirmation):
//   • "Voltage (mV)" = Notecard supply voltage (`notecard_voltage`). The
//     Notecard reports this in volts, so we ×1000 to render mV as labeled.
//   • "Battery Voltage (mV)" = the analog board battery measurement
//     (`battery_voltage`), already in mV.
// Wi-Fi RSSI renders empty until devices actually report Wi-Fi telemetry
// (backend returns null otherwise).
function buildDiagnosticsChartConfigs(displayPrefs) {
  const tempUnit = displayPrefs?.tempUnit ?? 'F';
  const voltageUnit = displayPrefs?.voltageUnit ?? 'mv';

  const tempTransform = tempUnit === 'C' ? identity : cToF;
  const tempLabel = tempUnit === 'C' ? '°C' : '°F';
  const battVTransform = voltageUnit === 'v' ? mvToV : identity;
  const battVLabel = voltageUnit === 'v' ? 'V' : 'mV';

  return [
    {
      key: 'notecard_temp',
      source: 'health',
      title: `Internal Ambient Temperature (${tempLabel})`,
      color: '#c96cfc',
      unit: tempLabel,
      transform: tempTransform
    },
    { key: 'rssi', source: 'health', title: 'Cellular RSSI', color: '#48f7f5', unit: 'dBm', transform: identity },
    { key: 'sinr', source: 'health', title: 'Cellular SNIR', color: '#7bdff2', unit: 'dB', transform: identity },
    { key: 'notecard_voltage', source: 'health', title: 'Voltage (mV)', color: '#f4d04b', unit: 'mV', transform: vToMv },
    {
      key: 'battery_voltage',
      source: 'env',
      title: `Battery Voltage (${battVLabel})`,
      color: '#f47568',
      unit: battVLabel,
      transform: battVTransform
    },
    { key: 'wifi_rssi', source: 'health', title: 'Wi-Fi RSSI', color: '#8539e0', unit: 'dBm', transform: identity }
  ];
}

// Build a {times, data} pair for one chart from a normalized rows array
// (either feed). Reads the bucket-agnostic `.avg` the hooks produce, applies
// the per-chart transform, and keeps nulls as gaps so an empty bucket reads as
// a break in the line rather than a drop to zero.
const buildChartSeries = (rows, field, transform) => {
  if (!rows) return { times: [], data: [] };
  const times = [];
  const data = [];
  for (const row of rows) {
    const value = toNumber(row.fields?.[field]?.avg);
    times.push(new Date(row.time));
    data.push(value === null ? null : transform ? transform(value) : value);
  }
  return { times, data };
};

// Compact Y-axis tick formatter — thousands → "1.5k", with the unit appended.
const makeYAxisFormatter = (unit) => (value) => {
  if (value === null || value === undefined) return '';
  const compact = Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`;
  return unit ? `${compact} ${unit}` : compact;
};

export default function SystemDiagnostics() {
  const [timeRange, setTimeRange] = useState(DEFAULT_CHART_TIME_RANGE);
  const [chartLayout, setChartLayout] = useState('row');
  const chartHeight = chartLayout === 'row' ? 228 : 258;

  // PheNode selection is shared app-wide via SelectionContext, so the device
  // chosen here (or on any other page) stays put until the user changes it or
  // logs out. The shared PhenodeSelector takes the raw device list and the
  // selected id directly, so the page no longer pre-shapes an options array.
  const { devices, isLoading: devicesLoading } = useMyDevices();
  const { selectedPheNodeId, selectPheNode } = useSelection() ?? {};
  const displayPrefs = useDisplayPreferences();

  // The selected DeviceRead drives the current-value snapshot (the right-hand
  // bars/temp/battery card + the MAC line). Its `health` JSONB holds the most
  // recent Notecard telemetry regardless of the chart time range, so the
  // snapshot stays meaningful even when the chosen graph window is empty.
  const selectedDevice = useMemo(
    () => (devices ?? []).find((d) => d.external_device_id === selectedPheNodeId) ?? null,
    [devices, selectedPheNodeId]
  );
  const health = selectedDevice?.health ?? {};

  // Wireless sensors connected to this PheNode — the count surfaced in the
  // left card. `wireless_sensors` is the device's paired-sensor list on
  // DeviceRead (validated in services/schemas/device.js).
  const wirelessSensorCount = selectedDevice?.wireless_sensors?.length ?? 0;

  // The six sensor status cards, with Active/Inactive read from the backend's
  // `sensor_health` map on the selected device. This single derived array feeds
  // BOTH the diagram overlay pieces and the bottom status cards, so they always
  // agree.
  const sensorCards = useMemo(() => deriveSensorCards(selectedDevice), [selectedDevice]);

  // Snapshot derivations. Ingestion only captures cellular health, so
  // `wifi_bars` is virtually always absent → clampBars returns 0 (empty bars),
  // which is the correct "no Wi-Fi telemetry" presentation.
  const cellularBars = clampBars(health.bars);
  const wifiBars = clampBars(health.wifi_bars);

  // Internal temperature comes from the Notecard's own `temp` (°C). Color is
  // classified on the °F value; the displayed string follows the user's unit.
  const internalTempC = toNumber(health.temp);
  const internalTempF = internalTempC === null ? null : cToF(internalTempC);
  const internalTempColor = tempColorFromF(internalTempF);
  const internalTempDisplay =
    internalTempC === null ? 'N/A' : displayPrefs.tempUnit === 'C' ? `${internalTempC.toFixed(2)}°C` : `${internalTempF.toFixed(2)}°F`;

  // Battery charge percent is computed server-side from the analog board
  // voltage and shipped on DeviceRead.
  const batteryPct = toNumber(selectedDevice?.battery_percent);
  const batteryColor = batteryColorFromPct(batteryPct);
  const batteryDisplay = batteryPct === null ? 'N/A' : `${batteryPct.toFixed(2)}%`;

  // The MAC address shown above the diagram IS the device's external id (the
  // "sensor id" surfaced on the fleet overview), so it tracks the selection.
  const macAddress = selectedPheNodeId || '—';

  // Last reading timestamp for the header — live off the selected device.
  const lastMeasurement = selectedDevice?.last_measurement_at;
  const lastMeasurementDisplay = lastMeasurement ? new Date(lastMeasurement).toLocaleString() : '—';

  // Chart time window. computeChartWindow maps the selected label to a
  // [from, to] Date pair + an axis-format hint; the hooks floor from/to to the
  // minute for their SWR keys, so a re-render within the same minute reuses the
  // cache instead of refetching.
  const { from, to, axisFormat } = useMemo(() => computeChartWindow(timeRange), [timeRange]);
  const xAxisTicks = useMemo(() => computeAxisTicks(from, to, axisFormat), [from, to, axisFormat]);

  // Two feeds back the six charts: the Notecard health series and the
  // environmental series (battery voltage only). `bucket: 'auto'` lets the
  // backend pick raw vs aggregated based on the window width.
  const { rows: healthRows } = useDeviceHealth(selectedPheNodeId, { from, to, fields: HEALTH_CHART_FIELDS, bucket: 'auto' });
  const { rows: envRows } = useDeviceMeasurements(selectedPheNodeId, { from, to, fields: ENV_CHART_FIELDS, bucket: 'auto' });

  const chartConfigs = useMemo(() => buildDiagnosticsChartConfigs(displayPrefs), [displayPrefs]);

  // Diagnostics CSV download — mirrors the sensor-measurements Download button.
  // Pulls the Notecard health series for the active [from, to] window; the
  // backend applies the user's saved data-download preferences before
  // responding. (The charts auto-refresh on their own 60s SWR poll, so no
  // manual refresh control is needed.)
  const { accessToken } = useAuth();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const handleDownloadDiagnostics = useCallback(async () => {
    if (!selectedPheNodeId || downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadDeviceHealthData(selectedPheNodeId, from.toISOString(), to.toISOString(), accessToken);
      const label = (selectedDevice?.label || selectedPheNodeId).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'phenode';
      const extMatch = filename ? /\.([a-z0-9]+)$/i.exec(filename) : null;
      const ext = extMatch ? extMatch[1].toLowerCase() : 'csv';
      triggerBlobDownload(blob, `${label}_diagnostics.${ext}`);
      toast.success('Download started.');
    } catch (err) {
      if (err?.status === 404) {
        toast.error('No diagnostics data found in this date range.');
      } else {
        toast.error("Couldn't generate the download. Please try again.");
      }
    } finally {
      setDownloading(false);
    }
  }, [selectedPheNodeId, selectedDevice, from, to, accessToken, downloading, toast]);

  return (
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
            Diagnostics
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
              {lastMeasurementDisplay}
            </Box>
          </Typography>
        </Stack>
      </Box>

      {/*
        PheNode picker row — lifted out of the diagram card and back up to the
        top-left, directly under the title divider, so this page's device
        dropdown sits in the same spot (and uses the same shared
        PhenodeSelector chrome) as imaging / sensor-measurements. It still
        drives the app-wide SelectionContext, so the choice persists across
        pages. `label={null}` because the "Diagnostics" title above already
        provides the context.
      */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 1.5, sm: 2 } }}>
        <Stack direction="row" sx={{ justifyContent: 'flex-start', alignItems: 'center', gap: 1 }}>
          <PhenodeSelector
            devices={devices}
            selectedDeviceId={selectedPheNodeId}
            onChange={(id) => selectPheNode?.(id ?? null)}
            isLoading={devicesLoading}
            label={null}
          />
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, pt: 0 }}>
        <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
          <Grid size={{ xs: 12, lg: 2 }}>
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 1,
                minHeight: { xs: 180, md: 320 },
                height: '100%',
                ...drfSurfaceSx,
                ...reflectedCardChromeSx
              }}
            >
              <Stack sx={{ height: '100%' }} spacing={1.5}>
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: 120,
                      minHeight: 60,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#00143642',
                      borderStyle: 'none none solid',
                      borderWidth: '1px 1px 2px',
                      borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
                      boxShadow: 'inset 1px 4px 5px #0003'
                    }}
                  >
                    <Typography variant="h3" sx={{ color: 'var(--green)', lineHeight: 1 }}>
                      {wirelessSensorCount}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1 }}>
                  <Typography variant="h5" sx={{ color: 'var(--blue)', textAlign: 'center' }}>
                    Wireless Sensors Connected to this PheNode
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box
                    component="img"
                    src={wirelessSensorsDiagram}
                    alt="Wireless sensors icon"
                    sx={{ width: { xs: 84, sm: 96, md: 104 }, height: 'auto', objectFit: 'contain' }}
                  />
                </Box>
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 8 }} sx={{ order: { xs: -1, sm: -1, md: 0 } }}>
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 1,
                minHeight: { xs: 220, md: 320 },
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...drfSurfaceSx,
                ...reflectedCardChromeSx
              }}
            >
              <Stack spacing={1.25} sx={{ width: '100%', height: '100%' }}>
                {/*
                  MAC address — now centered above the diagram. It used to
                  share this row with the device dropdown; with the dropdown
                  lifted up to the page header, the MAC stands on its own and
                  reads centered over the SVG. (sm+ only — the xs layout keeps
                  the dedicated mobile MAC line below the diagram.)
                */}
                <Typography
                  variant="body1"
                  sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'center', fontWeight: 600, width: '100%' }}
                >
                  <Box component="span" sx={{ color: 'var(--blue)' }}>
                    [ MAC ADDR:
                  </Box>{' '}
                  <Box component="span" sx={{ color: 'var(--green)', textShadow: '0 1px 9px #1a75e0c9' }}>
                    {macAddress}
                  </Box>{' '}
                  <Box component="span" sx={{ color: 'var(--blue)' }}>
                    ]
                  </Box>
                </Typography>

                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {/*
                    Diagram stack. The sizing/transform that used to live on
                    the <img> now lives on this relative wrapper, and an
                    explicit aspectRatio (the SVGs' 390.8 x 253.8 viewBox)
                    gives it a definite height. The base art and every sensor
                    piece are absolutely-positioned children filling the
                    wrapper with the same objectFit, so they all share one box
                    and register exactly. Moving the transform up here keeps
                    every layer shifted together.
                  */}
                  <Box
                    sx={{
                      position: 'relative',
                      width: { xs: '90%', sm: '88%', md: '88%', lg: '92%', xl: '94%' },
                      aspectRatio: '390.8 / 253.8',
                      maxHeight: { md: 390, lg: 490, xl: 590 },
                      transform: { xs: 'translateX(20px)', md: 'translateX(12px)', xl: 'translateX(42px)' }
                    }}
                  >
                    <Box component="img" src={phenodeDiagram} alt="Phenode system diagram" sx={diagramLayerSx} />
                    {/* Always-active control box — no state toggle, drawn over the base art. */}
                    <Box component="img" src={controlBoxActive} alt="" aria-hidden="true" sx={diagramLayerSx} />
                    {sensorCards.map((card) => (
                      <Box
                        key={`${card.title}-layer`}
                        component="img"
                        src={card.status === 'Active' ? card.activeSvg : card.inactiveSvg}
                        alt=""
                        aria-hidden="true"
                        sx={diagramLayerSx}
                      />
                    ))}
                  </Box>
                </Box>

                <Typography
                  variant="body1"
                  sx={{ display: { xs: 'block', sm: 'none' }, textAlign: 'center', fontWeight: 600, mt: 2.25, width: '100%' }}
                >
                  <Box component="span" sx={{ color: 'var(--blue)' }}>
                    [ MAC ADDR:
                  </Box>{' '}
                  <Box component="span" sx={{ color: 'var(--green)', textShadow: '0 1px 9px #1a75e0c9' }}>
                    {macAddress}
                  </Box>{' '}
                  <Box component="span" sx={{ color: 'var(--blue)' }}>
                    ]
                  </Box>
                </Typography>
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 2 }}>
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 1,
                minHeight: { xs: 180, md: 320 },
                height: '100%',
                ...drfSurfaceSx,
                ...reflectedCardChromeSx
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: '1fr' },
                  gridTemplateRows: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                  gap: 1.5
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', mb: 1, textAlign: 'center' }}>
                    Cellular:
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-end' }}>
                    {signalBarHeights.map((barHeight, i) => (
                      <Box
                        key={`cell-${barHeight}`}
                        sx={{
                          width: 10,
                          height: barHeight,
                          // Fill the first `cellularBars` (0–4) bars; the rest read empty.
                          backgroundColor: i < cellularBars ? 'var(--green)' : 'transparent',
                          border: '1px solid var(--reflected-light)',
                          borderRadius: 0,
                          outlineOffset: '0px',
                          outline: '3px #e8e8e8',
                          // Lit bars get the full glow; empty bars keep a subtle, low-alpha
                          // glow so a 0-bar group is still visible instead of vanishing.
                          boxShadow: i < cellularBars ? '0 0 10px 1px #1a75e0db' : '0 0 4px 0 #1a75e040'
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', mb: 1, textAlign: 'center' }}>
                    WiFi:
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-end' }}>
                    {signalBarHeights.map((barHeight, i) => (
                      <Box
                        key={`wifi-${barHeight}`}
                        sx={{
                          width: 10,
                          height: barHeight,
                          // Fill the first `wifiBars` (0–4) bars. Wi-Fi telemetry is
                          // typically absent → 0 bars (all empty) until devices report it.
                          backgroundColor: i < wifiBars ? 'var(--green)' : 'transparent',
                          border: '1px solid var(--reflected-light)',
                          borderRadius: 0,
                          outlineOffset: '0px',
                          outline: '3px #e8e8e8',
                          // Lit bars get the full glow; empty bars keep a subtle, low-alpha
                          // glow so an all-empty Wi-Fi group is still visible.
                          boxShadow: i < wifiBars ? '0 0 10px 1px #1a75e0db' : '0 0 4px 0 #1a75e040'
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', textAlign: 'center' }}>
                    Battery Charge:
                  </Typography>
                  <Typography variant="subtitle1" sx={{ color: batteryColor, mt: 0.5, textAlign: 'center' }}>
                    {batteryDisplay}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'var(--blue)', textAlign: 'center' }}>
                    Internal Temperature:
                  </Typography>
                  <Typography variant="subtitle1" sx={{ color: internalTempColor, mt: 0.5, textAlign: 'center' }}>
                    {internalTempDisplay}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...drfSurfaceSx, ...reflectedCardChromeSx }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(3, minmax(0, 1fr))',
                    md: 'repeat(6, minmax(0, 1fr))'
                  },
                  gap: 1.5
                }}
              >
                {sensorCards.map((card) => (
                  <Box
                    key={card.title}
                    sx={{
                      minHeight: { xs: 96, sm: 110 },
                      borderRadius: 1,
                      px: 1.25,
                      py: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: 0.5,
                      ...drfSurfaceSx,
                      ...reflectedCardChromeSx
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 5,
                        borderRadius: 1,
                        mb: 0.75,
                        backgroundColor: card.notchColor,
                        boxShadow: `0 0 8px 1px ${card.notchColor}`
                      }}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateY(4px)' }}>
                      <Typography variant="h5" sx={{ color: 'var(--blue)', textAlign: 'center', mb: 0.75 }}>
                        {card.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body1" sx={{ color: 'var(--blue)' }}>
                          Sensor Status:
                        </Typography>
                        <Typography variant="body1" sx={{ color: card.statusColor }}>
                          {card.status}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box
              sx={{
                borderRadius: 1,
                p: { xs: 1.5, sm: 2 },
                ...drfSurfaceSx,
                ...reflectedCardChromeSx,
                boxShadow: '0 14px 26px rgba(1, 13, 50, 1)'
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                  Diagnostics Over Time
                </Typography>
                <Tooltip title="Orientation" arrow={false} slotProps={tooltipSlotProps}>
                  <IconButton
                    aria-label="toggle chart layout"
                    onClick={() => setChartLayout((prev) => (prev === 'column' ? 'row' : 'column'))}
                    sx={orientationButtonSx}
                  >
                    <AntIcon icon={AppstoreOutlined} />
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
                    sx={{
                      color: 'var(--green)',
                      border: '1px solid var(--reflected-light)',
                      borderRadius: 1,
                      backgroundColor: 'var(--drf)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '& .MuiSelect-icon': { color: 'var(--blue)' }
                    }}
                    MenuProps={{
                      PaperProps: neonSelectMenuPaperProps
                    }}
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
                  </Select>
                </FormControl>
                <Tooltip title="Download diagnostics CSV" arrow={false} slotProps={tooltipSlotProps}>
                  <span>
                    <IconButton
                      aria-label="download diagnostics data"
                      onClick={handleDownloadDiagnostics}
                      disabled={downloading || !selectedPheNodeId}
                      sx={{
                        border: '1px solid var(--reflected-light)',
                        color: 'var(--purple)',
                        backgroundColor: 'rgba(0, 20, 61, 0.72)',
                        boxShadow: '0 11px 19px 1px #0000002e',
                        '&.Mui-disabled': { opacity: 0.5, color: 'var(--purple)' },
                        '&:hover': {
                          borderColor: 'var(--green)',
                          boxShadow: '0 0 7px -5px var(--green)',
                          color: 'var(--green)',
                          textShadow: '0 1px 5px #007bff',
                          backgroundColor: 'rgba(72, 247, 245, 0.08)'
                        }
                      }}
                    >
                      <AntIcon icon={DownloadOutlined} />
                    </IconButton>
                  </span>
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
                {chartConfigs.map((cfg) => {
                  // Each chart pulls from the feed named by its config: the
                  // Notecard health series or the environmental series.
                  const rows = cfg.source === 'health' ? healthRows : envRows;
                  const { times, data } = buildChartSeries(rows, cfg.key, cfg.transform);
                  const finite = data.filter((v) => v !== null && Number.isFinite(v));
                  const hasData = finite.length > 0;
                  const minVal = hasData ? Math.min(...finite) : 0;
                  const maxVal = hasData ? Math.max(...finite) : 1;
                  const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

                  // Empty-state copy distinguishes "still loading" from "the
                  // range has no rows" from the Wi-Fi-specific "telemetry not
                  // reported" case, so an always-empty Wi-Fi chart reads as
                  // expected rather than broken.
                  const emptyMessage =
                    rows === undefined ? 'Loading…' : cfg.key === 'wifi_rssi' ? 'Awaiting Wi-Fi telemetry' : 'No data for this range';

                  return (
                    <Box
                      key={cfg.key}
                      sx={{
                        borderRadius: 1,
                        p: { xs: 0.45, sm: 0.65 },
                        minHeight: { xs: 260, sm: 286 },
                        display: 'flex',
                        flexDirection: 'column',
                        ...reflectedCardChromeSx,
                        ...chartSurfaceSx
                      }}
                    >
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                        <Typography variant="subtitle1" sx={{ color: 'var(--blue)', ml: 1.25 }}>
                          {cfg.title}
                        </Typography>
                        <IconButton aria-label={`zoom ${cfg.title}`} size="small" sx={{ color: 'var(--blue)' }}>
                          <AntIcon icon={ZoomInOutlined} />
                        </IconButton>
                      </Stack>

                      {hasData ? (
                        <LineChart
                          xAxis={[
                            {
                              id: `${cfg.key}-x`,
                              scaleType: 'time',
                              data: times,
                              tickNumber: axisTickNumberFor(axisFormat),
                              tickInterval: xAxisTicks,
                              tickLabelStyle: { fontSize: 11, fill: 'var(--green)' },
                              valueFormatter: (value, context) =>
                                context?.location === 'tooltip' ? formatTooltipDate(value) : formatAxisTick(value, axisFormat)
                            }
                          ]}
                          yAxis={[
                            {
                              id: `${cfg.key}-y`,
                              min: minVal - pad,
                              max: maxVal + pad,
                              width: 38,
                              tickLabelStyle: { fill: 'var(--green)' },
                              valueFormatter: makeYAxisFormatter(cfg.unit)
                            }
                          ]}
                          series={[
                            {
                              id: `${cfg.key}-line`,
                              data,
                              color: cfg.color,
                              area: true,
                              showMark: false,
                              curve: 'linear',
                              connectNulls: true,
                              valueFormatter: (value) =>
                                value === null || value === undefined
                                  ? 'No data'
                                  : `${Number(value).toFixed(2)}${cfg.unit ? ` ${cfg.unit}` : ''}`
                            }
                          ]}
                          grid={{ horizontal: true, vertical: true }}
                          height={chartHeight}
                          margin={{ top: 2, right: 16, bottom: 10, left: 10 }}
                          hideLegend
                          sx={{
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
                              filter: `drop-shadow(0 0 8px ${cfg.color})`
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
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            flex: 1,
                            minHeight: chartHeight,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            px: 2
                          }}
                        >
                          <Typography variant="body2" sx={{ color: 'var(--blue)', opacity: 0.85 }}>
                            {emptyMessage}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </MainCard>
  );
}
