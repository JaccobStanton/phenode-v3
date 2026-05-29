// =============================================================================
// measurementCatalog.js — single source of truth for the tabbed chart layout.
// =============================================================================
//
// This module is intentionally PURE DATA (no JSX, no React, no app imports
// beyond unit conversions): it maps every measurement the dashboard renders
// to (a) the tab it lives on, (b) the backend data source + field name(s)
// that feed it, (c) the unit label + per-point transform that track the
// user's display preferences, (d) the chart type, and (e) whether the field
// is live today or pending a backend change.
//
// Why a standalone catalog rather than extending buildDeviceChartConfigs:
//   The original factory only described DEVICE-level line charts. The tabbed
//   layout spans TWO data sources (device + wireless) and FIVE chart types
//   (line, multi-line, scatter, step, sparkline). Centralizing the whole
//   matrix here means the tab shell, each tab panel, the field projections
//   sent to the SWR hooks, and the backend punch-list all derive from ONE
//   place — change a field name or move a chart between tabs in exactly one
//   spot.
//
// SOURCE-OF-TRUTH for field availability (verified, not assumed):
//   Device time-series fields  → phenodeX/phenode_backend/services/downloads.py:877-919
//                                (_DEVICE_FIELD_EXTRACTORS) + the computed `gdd`
//                                special field at downloads.py:788-874.
//   Wireless time-series fields → phenodeX/phenode_backend/services/downloads.py:1073-1115
//                                (_WIRELESS_FIELD_KEYS).
//   Both endpoints return ALL their defined fields by default and accept a
//   `fields` CSV projection to narrow the payload (routes.py:935-944 device /
//   routes.py:494-498 wireless).
//
// Wiring note: the measurement hooks derive their field list from each
//   response row directly (hooks/data/normalizeMeasurementRow.js), so any
//   key the backend returns through its `fields=` projection reaches the
//   chart layer automatically. Adding a measurement end-to-end is now a
//   single change in `_DEVICE_FIELD_EXTRACTORS` / `_WIRELESS_FIELD_KEYS` —
//   no frontend allow-list to keep in lockstep.
//
// `availability` values:
//   'live'            → field is in the time-series projection today; chart
//                        populates as soon as it's wired.
//   'needs-backend'   → no time-series field exists; the panel renders with a
//                        "sensor not connected / no data" empty state until
//                        the backend adds it.

// ---------------------------------------------------------------------------
// Unit conversions — mirror the helpers in sensor-measurements.jsx so the
// catalog's transforms match what the existing device charts already do.
// Kept local (not imported) so this module has zero coupling to the page.
// ---------------------------------------------------------------------------
const FAHRENHEIT_RATIO = 9 / 5;
const identity = (v) => v;
const cToF = (c) => c * FAHRENHEIT_RATIO + 32;
const msToMph = (ms) => ms * 2.2369362921;
const msToKmh = (ms) => ms * 3.6;
const mmToIn = (mm) => mm * 0.0393700787;
const kpaToHpa = (kpa) => kpa * 10;
const mvToV = (mv) => mv / 1000;
const mToFt = (m) => m * 3.280839895;
const ohmToKohm = (ohm) => ohm / 1000;

// Tab ids — used by the URL ?tab= param and the panel switch. Exported so the
// shell and the deep-link logic share the same vocabulary.
export const TAB_IDS = {
  ALL: 'all',
  WEATHER: 'weather',
  LIGHT: 'light',
  SOIL: 'soil',
  POWER: 'power'
};

// Palette — unified per Jake's chart-color spec (May 2026):
//   • Default single-series line                    → var(--blue) (#1a76e0)
//   • Secondary / overlay line on the same chart    → var(--purple) (#8955e2)
//   • Rain                                          → blue (it IS the default,
//                                                     called out so future
//                                                     edits don't tint it)
//   • Light-family (LUX, PAR, solar radiation,
//     lightning)                                    → yellow ramp
//   • Power-family (battery, solar V, USB V, accel) → var(--red) (#ff484b)
//
// The 4-line soil-profile "depth ramp" stays a blue-shade ramp so shallow →
// deep is still readable on a single chart; the rest of soil is treated as
// primary/secondary (Probe 1 = blue, Probe 2 = purple).
const PRIMARY = 'var(--blue)';
const SECONDARY = 'var(--purple)';
const POWER = 'var(--red)';
const LIGHT_PRIMARY = '#fde047'; // bright yellow — LUX/lightning anchor
const LIGHT_SECONDARY = '#f59e0b'; // amber — pairs with the primary yellow

const COLORS = {
  temperature: PRIMARY,
  temperatureSecondary: SECONDARY,
  humidity: PRIMARY,
  pressure: PRIMARY,
  gas: PRIMARY,
  windSpeed: PRIMARY,
  windSpeedSecondary: SECONDARY,
  windDirection: PRIMARY,
  windGust: PRIMARY,
  // Calypso is the secondary source on every wind chart (Atmos = primary blue,
  // Calypso = secondary purple) so the two sources read consistently across
  // wind speed / direction / gust.
  windCalypso: SECONDARY,
  rainfall: PRIMARY,
  rainfallSecondary: SECONDARY,
  gdd: PRIMARY,
  lightning: LIGHT_PRIMARY,
  lux: LIGHT_PRIMARY,
  par: LIGHT_PRIMARY,
  solarRadiation: LIGHT_SECONDARY,
  soilMoisture: PRIMARY,
  soilMoistureSecondary: SECONDARY,
  soilTemp: PRIMARY,
  soilTempSecondary: SECONDARY,
  soilEc: PRIMARY,
  soilEcSecondary: SECONDARY,
  soilMatric: PRIMARY,
  soilMatricSecondary: SECONDARY,
  altitude: PRIMARY,
  // Accelerometer axes — 3 distinct hues from the power family so X/Y/Z stay
  // visually separable while still reading as "power & device" tone.
  accelX: POWER,
  accelY: '#ff8c49', // orange (existing --orange token)
  accelZ: SECONDARY, // purple — contrasts the warm accelX/Y
  batteryCharge: POWER,
  batteryVoltage: POWER,
  solarVoltage: POWER,
  usbVoltage: POWER,
  // Depth ramps for the 4-line soil-profile charts (shallow → deep). Kept as a
  // blue-shade ramp so all four lines remain visually orderable.
  depth: ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0369a1']
};

const DEPTH_LABELS = ['15 cm', '30 cm', '45 cm', '60 cm'];

// ---------------------------------------------------------------------------
// Wind-direction compass labels.
//
// Source of truth: the backend computes a 16-point compass string for each
// wind source and exposes it as a sibling field on the device sensor-data
// rows (downloads.py:1422 — DEVICE_COMPASS_SOURCE_FIELDS):
//   • wind_direction          → wind_direction_compass
//   • atmos_wind_direction    → atmos_wind_direction_compass
//   • calypso_wind_direction  → calypso_wind_direction_compass
//
// The frontend uses those backend strings for the chart's tooltip. The Y-axis
// ticks are anchored to a fixed 8-point compass at 0/45/90/…/315°, so we keep
// a tiny static map for those tick labels and avoid recomputing the full
// 16-point bucket logic on the client.
// ---------------------------------------------------------------------------
const COMPASS_TICKS = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
export const compassTickFormatter = (deg) => {
  if (deg === null || deg === undefined) return '';
  return COMPASS_TICKS[Number(deg)] ?? '';
};

// Resolve the unit-dependent label + transform for the families that respond
// to display preferences. Returns { label, transform }.
function resolveUnit(kind, displayPrefs) {
  switch (kind) {
    case 'temperature': {
      const u = displayPrefs?.tempUnit ?? 'F';
      return u === 'C' ? { label: '°C', transform: identity } : { label: '°F', transform: cToF };
    }
    case 'speed': {
      const u = displayPrefs?.speedUnit ?? 'ms';
      if (u === 'mph') return { label: 'mph', transform: msToMph };
      if (u === 'kmh') return { label: 'km/h', transform: msToKmh };
      return { label: 'm/s', transform: identity };
    }
    case 'pressure': {
      const u = displayPrefs?.pressureUnit ?? 'kpa';
      return u === 'hpa' ? { label: 'hPa', transform: kpaToHpa } : { label: 'kPa', transform: identity };
    }
    case 'rainfall': {
      const u = displayPrefs?.rainUnit ?? 'mm';
      return u === 'in' ? { label: 'in', transform: mmToIn } : { label: 'mm', transform: identity };
    }
    case 'voltage': {
      const u = displayPrefs?.voltageUnit ?? 'mv';
      return u === 'v' ? { label: 'V', transform: mvToV } : { label: 'mV', transform: identity };
    }
    case 'conductivity': {
      // Backend enum is dS/m or mS/cm (user_preferences.py:25). 1 dS/m = 1
      // mS/cm, so the numeric value is identical — only the label differs.
      // Default dS/m to match the backend default.
      const u = displayPrefs?.conductivityUnit ?? 'dsm';
      return u === 'mscm' ? { label: 'mS/cm', transform: identity } : { label: 'dS/m', transform: identity };
    }
    case 'resistance': {
      const u = displayPrefs?.resistanceUnit ?? 'kohm';
      return u === 'ohm' ? { label: 'Ω', transform: identity } : { label: 'kΩ', transform: ohmToKohm };
    }
    case 'acceleration': {
      const u = displayPrefs?.accelerationUnit ?? 'ms2';
      return u === 'g' ? { label: 'g', transform: (ms2) => ms2 / 9.80665 } : { label: 'm/s²', transform: identity };
    }
    case 'altitude': {
      // No dedicated altitude pref; piggy-back on distance (mi→ft, km→m).
      const u = displayPrefs?.distanceUnit ?? 'mi';
      return u === 'km' ? { label: 'm', transform: identity } : { label: 'ft', transform: mToFt };
    }
    default:
      return { label: '', transform: identity };
  }
}

// =============================================================================
// buildMeasurementCatalog(displayPrefs)
// =============================================================================
// Returns the ordered tab list. Each tab: { id, label, source(s), charts[] }.
// Each chart entry shape:
//   {
//     key,            unique id (also the MUI x-charts id suffix root)
//     title,          header text
//     source,         'device' | 'wireless'
//     chartType,      'line' | 'multiline' | 'scatter' | 'step'
//     unit,           Y-axis + tooltip suffix (already unit-resolved)
//     transform,      per-point value transform (already unit-resolved)
//     color,          stroke color (single-series charts)
//     series,         [{ field, label, color, transform? }]  (multi-line/overlay)
//     primaryField,   backend field for the main line
//     secondaryField, optional overlay field (e.g. Atmos vs Calypso)
//     availability,   'live' | 'needs-hook-field' | 'needs-backend'
//     note            short human note for empty-state / tooltip / dev docs
//   }
export function buildMeasurementCatalog(displayPrefs) {
  const temp = resolveUnit('temperature', displayPrefs);
  const speed = resolveUnit('speed', displayPrefs);
  const pressure = resolveUnit('pressure', displayPrefs);
  const rainfall = resolveUnit('rainfall', displayPrefs);
  const voltage = resolveUnit('voltage', displayPrefs);
  const conductivity = resolveUnit('conductivity', displayPrefs);
  const resistance = resolveUnit('resistance', displayPrefs);
  const accel = resolveUnit('acceleration', displayPrefs);
  const altitude = resolveUnit('altitude', displayPrefs);

  // --- WEATHER -------------------------------------------------------------
  const weather = [
    {
      key: 'temperature',
      title: 'Ambient Temperature',
      source: 'device',
      chartType: 'line',
      primaryField: 'temperature',
      unit: temp.label,
      transform: temp.transform,
      color: COLORS.temperature,
      availability: 'live'
    },
    {
      // Atmos 22 secondary temp: backend currently COALESCES all air-temp
      // sources into the single `temperature` field (downloads.py:878), so a
      // distinct secondary line needs a dedicated backend field.
      key: 'temperature_secondary',
      title: 'Ambient Temperature (Atmos 22)',
      source: 'device',
      chartType: 'line',
      primaryField: 'temperature_secondary',
      unit: temp.label,
      transform: temp.transform,
      color: COLORS.temperatureSecondary,
      availability: 'live'
    },
    {
      key: 'humidity',
      title: 'Relative Humidity',
      source: 'device',
      chartType: 'line',
      primaryField: 'humidity',
      unit: '%',
      transform: identity,
      color: COLORS.humidity,
      availability: 'live'
    },
    {
      key: 'pressure',
      title: 'Air Pressure',
      source: 'device',
      chartType: 'line',
      primaryField: 'pressure',
      unit: pressure.label,
      transform: pressure.transform,
      color: COLORS.pressure,
      availability: 'live'
    },
    {
      key: 'gas_resistance',
      title: 'Gas Resistance',
      source: 'device',
      chartType: 'line',
      primaryField: 'gasResistanceBme',
      unit: resistance.label,
      transform: resistance.transform,
      color: COLORS.gas,
      availability: 'live'
    },
    {
      // Wind speed: two distinct sources rendered as two lines (matches the
      // old GUI's "atmos22 + calypso" overlay). `atmos_wind_speed` scans
      // bus1..bus8 only (downloads.py:1125-1135); `calypso_wind_speed` is
      // Calypso-only (downloads.py:1136). Devices with only one source show
      // a single line because buildAlignedSeries filters out empty series.
      key: 'wind_speed',
      title: 'Wind Speed',
      source: 'device',
      chartType: 'multiline',
      unit: speed.label,
      transform: speed.transform,
      series: [
        { field: 'atmos_wind_speed', label: 'Atmos', color: COLORS.windSpeed, transform: speed.transform },
        { field: 'calypso_wind_speed', label: 'Calypso', color: COLORS.windCalypso, transform: speed.transform }
      ],
      availability: 'live'
    },
    {
      // Wind direction: scatter (line wraps badly across the 0°/360° seam).
      // Two series so atmos vs Calypso are visually distinct dots; the panel's
      // scatter branch iterates chart.series the same way the line/multiline
      // branch does.
      key: 'wind_direction',
      title: 'Wind Direction',
      source: 'device',
      chartType: 'scatter',
      // Empty unit so the Y-axis tick reads as a bare compass heading (N, NE,
      // SE, …), not "N °".
      unit: '',
      transform: identity,
      // Y-axis ticks: the 8-point compass at fixed degree positions. The
      // scatter branch in MeasurementTabPanel uses this when present.
      yAxisValueFormatter: compassTickFormatter,
      // Tooltip: read the backend-derived compass string off the same row as
      // the degree value. Sibling-field lookup → no client-side bucketing,
      // so the tooltip can never drift from what the backend reports.
      // Output: "NW (315°)".
      pointValueFormatter: (deg, point) => {
        if (deg === null || deg === undefined || !Number.isFinite(Number(deg))) return null;
        const compass = point?.compass ?? '';
        const rounded = Number(deg).toFixed(0);
        return compass ? `${compass} (${rounded}°)` : `${rounded}°`;
      },
      series: [
        {
          field: 'atmos_wind_direction',
          compassField: 'atmos_wind_direction_compass',
          label: 'Atmos',
          color: COLORS.windDirection
        },
        {
          field: 'calypso_wind_direction',
          compassField: 'calypso_wind_direction_compass',
          label: 'Calypso',
          color: COLORS.windCalypso
        }
      ],
      availability: 'live'
    },
    {
      key: 'wind_gust',
      title: 'Wind Gust',
      source: 'device',
      chartType: 'multiline',
      unit: speed.label,
      transform: speed.transform,
      series: [
        { field: 'atmos_wind_gust', label: 'Atmos', color: COLORS.windGust, transform: speed.transform },
        { field: 'calypso_wind_gust', label: 'Calypso', color: COLORS.windCalypso, transform: speed.transform }
      ],
      availability: 'live'
    },
    {
      // Rainfall: Pronamic is primary; Atmos rain is the secondary overlay.
      key: 'rainfall',
      title: 'Rainfall',
      source: 'device',
      chartType: 'line',
      primaryField: 'rainfall',
      unit: rainfall.label,
      transform: rainfall.transform,
      color: COLORS.rainfall,
      availability: 'live'
    },
    {
      key: 'gdd',
      title: 'Growing Degree Days',
      source: 'device',
      chartType: 'step', // one cumulative value per local day, plotted at the day's last reading
      primaryField: 'gdd',
      // GDD is unitless to the user — the underlying number is in degree-days
      // (°F·day or °C·day depending on the display preference), but per Jake
      // the chart should just label the axis "GDD" rather than expose the
      // unit. The numeric value itself stays as the backend computes it.
      unit: 'GDD',
      transform: identity, // backend computes GDD; do not re-transform here
      color: COLORS.gdd,
      availability: 'live',
      note: 'Backend computes one cumulative GDD value per local day (downloads.py:788-874).'
    },
    {
      key: 'lightning_strikes',
      title: 'Lightning Strikes',
      source: 'device',
      chartType: 'line',
      primaryField: 'lightning_strikes',
      unit: 'count',
      transform: identity,
      color: COLORS.lightning,
      availability: 'live'
    },
    {
      key: 'lightning_distance',
      title: 'Lightning Distance',
      source: 'device',
      chartType: 'line',
      primaryField: 'lightning_strike_distance',
      unit: 'km',
      transform: identity,
      color: COLORS.lightning,
      availability: 'live'
    }
  ];

  // --- LIGHT ---------------------------------------------------------------
  const light = [
    {
      key: 'lux',
      title: 'LUX',
      source: 'device',
      chartType: 'line',
      primaryField: 'lux',
      unit: 'lx',
      transform: identity,
      color: COLORS.lux,
      availability: 'live'
    },
    {
      // PAR/PPFD + Atmos 41 solar radiation share this panel as two lines once
      // the backend exposes them. Neither field exists in a time-series
      // projection today.
      key: 'par_ppfd',
      title: 'PAR',
      info: 'Photosynthetic Photon Flux Density',
      source: 'device',
      chartType: 'multiline',
      unit: 'W/m²',
      transform: identity,
      color: COLORS.par,
      series: [
        { field: 'par_ppfd', label: 'Apogee PAR', color: COLORS.par },
        { field: 'solar_radiation', label: 'Atmos 41 (solar radiation)', color: COLORS.solarRadiation }
      ],
      availability: 'live',
      note: 'Atmos 41 solar_radiation is live (downloads.py:987); Apogee SQ-522 PAR field still pending — the chart shows whichever series has data.'
    }
  ];

  // --- SOIL ----------------------------------------------------------------
  // All wireless. Probe-1 fields are the primary; probe-2 (vwcPercent_2 etc.)
  // can be layered as a second line later if a device has two probes.
  const soil = [
    {
      // Two-probe layout (Probe 1 + Probe 2) — matches the old GUI's "Soil
      // Probe 1&2" panels. Devices with only one probe render a single line
      // because the empty probe's series gets filtered out in buildAlignedSeries.
      key: 'soil_moisture',
      title: 'Soil Moisture (VWC)',
      source: 'device',
      chartType: 'multiline',
      unit: '%',
      transform: identity,
      series: [
        { field: 'soil_moisture_1', label: 'Probe 1', color: COLORS.soilMoisture },
        { field: 'soil_moisture_2', label: 'Probe 2', color: COLORS.soilMoistureSecondary }
      ],
      availability: 'live'
    },
    {
      key: 'soil_temperature',
      title: 'Soil Temperature',
      source: 'device',
      chartType: 'multiline',
      unit: temp.label,
      transform: temp.transform,
      series: [
        { field: 'soil_temperature_1', label: 'Probe 1', color: COLORS.soilTemp, transform: temp.transform },
        { field: 'soil_temperature_2', label: 'Probe 2', color: COLORS.soilTempSecondary, transform: temp.transform }
      ],
      availability: 'live'
    },
    {
      key: 'soil_ec',
      title: 'Soil Electrical Conductivity',
      source: 'device',
      chartType: 'multiline',
      unit: conductivity.label,
      transform: conductivity.transform,
      series: [
        { field: 'soil_ec_1', label: 'Probe 1', color: COLORS.soilEc, transform: conductivity.transform },
        { field: 'soil_ec_2', label: 'Probe 2', color: COLORS.soilEcSecondary, transform: conductivity.transform }
      ],
      availability: 'live'
    },
    {
      key: 'soil_matric',
      title: 'Soil Matric Potential',
      source: 'device',
      chartType: 'multiline',
      unit: 'kPa',
      transform: identity,
      series: [
        { field: 'soil_matric_1', label: 'Probe 1', color: COLORS.soilMatric },
        { field: 'soil_matric_2', label: 'Probe 2', color: COLORS.soilMatricSecondary }
      ],
      availability: 'live'
    },
    {
      key: 'soil_profile_moisture',
      title: 'Soil Profile Moisture',
      source: 'wireless',
      chartType: 'multiline',
      unit: '%',
      transform: identity,
      series: [
        { field: 'sensor1_d1_vwc', label: DEPTH_LABELS[0], color: COLORS.depth[0] },
        { field: 'sensor1_d2_vwc', label: DEPTH_LABELS[1], color: COLORS.depth[1] },
        { field: 'sensor1_d3_vwc', label: DEPTH_LABELS[2], color: COLORS.depth[2] },
        { field: 'sensor1_d4_vwc', label: DEPTH_LABELS[3], color: COLORS.depth[3] }
      ],
      availability: 'live'
    },
    {
      key: 'soil_profile_temperature',
      title: 'Soil Profile Temperature',
      source: 'wireless',
      chartType: 'multiline',
      unit: temp.label,
      transform: temp.transform,
      series: [
        { field: 'sensor1_d1_temp', label: DEPTH_LABELS[0], color: COLORS.depth[0], transform: temp.transform },
        { field: 'sensor1_d2_temp', label: DEPTH_LABELS[1], color: COLORS.depth[1], transform: temp.transform },
        { field: 'sensor1_d3_temp', label: DEPTH_LABELS[2], color: COLORS.depth[2], transform: temp.transform },
        { field: 'sensor1_d4_temp', label: DEPTH_LABELS[3], color: COLORS.depth[3], transform: temp.transform }
      ],
      availability: 'live'
    }
  ];

  // --- POWER & DEVICE ------------------------------------------------------
  const power = [
    {
      key: 'altitude',
      title: 'Altitude',
      source: 'device',
      chartType: 'line',
      primaryField: 'altitude',
      unit: altitude.label,
      transform: altitude.transform,
      color: COLORS.altitude,
      availability: 'live'
    },
    {
      key: 'accelerometer',
      title: 'Accelerometer',
      source: 'device',
      chartType: 'multiline',
      unit: accel.label,
      transform: accel.transform,
      series: [
        { field: 'accelerationX', label: 'X', color: COLORS.accelX, transform: accel.transform },
        { field: 'accelerationY', label: 'Y', color: COLORS.accelY, transform: accel.transform },
        { field: 'accelerationZ', label: 'Z', color: COLORS.accelZ, transform: accel.transform }
      ],
      availability: 'live'
    },
    {
      // Battery charge %: no computed % field exists; per Jake, source the raw
      // battery voltage (mVbat). Shown as voltage until a pack-voltage→% map
      // (or a backend %) is provided.
      key: 'battery_charge',
      title: 'Battery Charge',
      source: 'device',
      chartType: 'line',
      primaryField: 'mVbat',
      unit: voltage.label,
      transform: voltage.transform,
      color: COLORS.batteryCharge,
      availability: 'live',
      note: 'No backend % field; sources raw mVbat. A linear pack-voltage→% mapping can be layered on later.'
    },
    {
      key: 'battery_voltage',
      title: 'Battery Voltage',
      source: 'device',
      chartType: 'line',
      primaryField: 'battery_voltage',
      unit: voltage.label,
      transform: voltage.transform,
      color: COLORS.batteryVoltage,
      availability: 'live'
    },
    {
      key: 'solar_voltage',
      title: 'Solar Panel Voltage',
      source: 'device',
      chartType: 'line',
      primaryField: 'mVsolar',
      unit: voltage.label,
      transform: voltage.transform,
      color: COLORS.solarVoltage,
      availability: 'live'
    },
    {
      key: 'usb_voltage',
      title: 'USB Charger Voltage',
      source: 'device',
      chartType: 'line',
      primaryField: 'mVusb',
      unit: voltage.label,
      transform: voltage.transform,
      color: COLORS.usbVoltage,
      availability: 'live'
    }
  ];

  return [
    { id: TAB_IDS.WEATHER, label: 'Environment', charts: weather },
    { id: TAB_IDS.LIGHT, label: 'Light', charts: light },
    { id: TAB_IDS.SOIL, label: 'Soil', charts: soil },
    { id: TAB_IDS.POWER, label: 'Power & Device', charts: power }
  ];
}

// Per-source field projections for a given tab's chart list — pass to the SWR
// hooks' `fields` option so each tab fetches ONLY the columns it renders
// (smaller payloads; switching tabs fetches less, not more). Skips fields that
// don't exist server-side yet (needs-backend) to avoid noisy 4xx/empty cols.
export function fieldProjectionsForCharts(charts) {
  const device = new Set();
  const wireless = new Set();
  for (const c of charts ?? []) {
    if (c.availability === 'needs-backend') continue;
    const add = c.source === 'wireless' ? (f) => wireless.add(f) : (f) => device.add(f);
    if (Array.isArray(c.series)) {
      c.series.forEach((s) => {
        if (s.field) add(s.field);
        // Sibling fields (e.g. *_wind_direction_compass) — requested alongside
        // the numeric series so the panel can render them in the tooltip.
        if (s.compassField) add(s.compassField);
      });
    } else if (c.primaryField) {
      add(c.primaryField);
      if (c.secondaryField) add(c.secondaryField);
    }
  }
  return { device: [...device], wireless: [...wireless] };
}
