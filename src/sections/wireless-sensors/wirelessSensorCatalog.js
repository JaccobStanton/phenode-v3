// =============================================================================
// wirelessSensorCatalog.js — source of truth for the wireless-sensors page's
// categorized chart layout, mirroring measurementCatalog.js on the device side.
// =============================================================================
//
// Every chart in this catalog reads from the wireless time-series endpoint
// (GET /api/wireless-sensors/{external_sensor_id}/sensor-data), so `source` is
// implicit. The wireless page selects N sensors and the panel fans each chart
// out per-sensor at render time — single-series charts become N lines (one
// per sensor), and multi-series charts (soil profile depths, accelerometer
// axes, two-probe soil families) become N × M lines with combined labels.
//
// Field availability is anchored to `_WIRELESS_FIELD_KEYS` in
// phenodeX/phenode_backend/services/downloads.py:1076-1125. Every key listed
// in any chart's `primaryField` / `series[].field` below MUST appear in that
// backend projection — the hooks-side allow-list was retired in the Option C
// refactor (May 28, 2026), so the catalog drives the field projection sent to
// the SWR hook directly.

// ---------------------------------------------------------------------------
// Unit conversions — mirror the helpers in measurementCatalog.js so device
// and wireless charts share the same number-to-display semantics for any
// given user display preference.
// ---------------------------------------------------------------------------
const FAHRENHEIT_RATIO = 9 / 5;
const identity = (v) => v;
const cToF = (c) => c * FAHRENHEIT_RATIO + 32;
const kpaToHpa = (kpa) => kpa * 10;
const mvToV = (mv) => mv / 1000;
const mToFt = (m) => m * 3.280839895;
const ohmToKohm = (ohm) => ohm / 1000;

export const WIRELESS_CATEGORY_IDS = {
  ALL: 'all',
  WEATHER: 'weather',
  LIGHT: 'light',
  SOIL: 'soil',
  POWER: 'power'
};

// Stroke colors — unified per Jake's chart-color spec (May 2026):
//   • Default single-series line                    → var(--blue)
//   • Secondary / overlay line on the same chart    → var(--purple)
//   • Light family (LUX)                            → yellow
//   • Battery / voltage / power charts              → diagnostics-red ramp,
//     anchored on the System Diagnostics battery-voltage red (#f47568)
//   • Accelerometer X / Y / Z                       → blue / purple / green
//
// When multiple sensors are overlaid on the same chart, the panel ignores
// these and uses its own per-sensor palette (so each sensor gets one color
// across every chart). These COLORS apply to the single-sensor render path.
// var(--blue-on-dark) (#4287e8), not var(--blue) (#1a76e0): the darker blue
// washes out against the navy chart background so its glow/area fill was
// invisible. Keep in sync with measurementCatalog.js.
const PRIMARY = 'var(--blue-on-dark)';
const SECONDARY = 'var(--purple)';
const TERTIARY = 'var(--green)';
// Power family — same diagnostics-red ramp as the device catalog so the
// "nice red" carries across every battery/voltage/power chart. Battery
// voltage (most common voltage) = the exact diagnostics red; the others are
// slight variations of it. Keep in sync with measurementCatalog.js.
const POWER_VOLTAGE = '#f47568'; // battery voltage — matches DiagnosticsChartsPanel
const POWER_CHARGE = '#db5347'; // battery charge — deeper red
const POWER_SOLAR = '#ef6253'; // solar voltage — mid red
const POWER_USB = '#f8917f'; // USB voltage — lighter salmon
const LIGHT_PRIMARY = '#fde047'; // bright yellow — LUX anchor

const COLORS = {
  temperatureMcp: PRIMARY,
  temperatureBme: SECONDARY,
  humidity: PRIMARY,
  pressure: PRIMARY,
  gas: PRIMARY,
  lux: LIGHT_PRIMARY,
  altitude: PRIMARY,
  // Accelerometer axes — blue / purple / green so X/Y/Z stay clearly
  // separable (per Jake's spec).
  accelX: PRIMARY, // var(--blue)
  accelY: SECONDARY, // var(--purple)
  accelZ: TERTIARY, // var(--green)
  soilMoisture: PRIMARY,
  soilMoistureSecondary: SECONDARY,
  soilTemp: PRIMARY,
  soilTempSecondary: SECONDARY,
  soilEc: PRIMARY,
  soilEcSecondary: SECONDARY,
  soilMatric: PRIMARY,
  soilMatricSecondary: SECONDARY,
  batteryCharge: POWER_CHARGE,
  batteryVoltage: POWER_VOLTAGE,
  solarVoltage: POWER_SOLAR,
  usbVoltage: POWER_USB,
  // Depth ramp for the 4-line soil-profile charts (shallow → deep). Kept as a
  // blue-shade ramp so all four lines remain visually orderable.
  depth: ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0369a1']
};

const DEPTH_LABELS = ['15 cm', '30 cm', '45 cm', '60 cm'];

function resolveUnit(kind, displayPrefs) {
  switch (kind) {
    case 'temperature': {
      const u = displayPrefs?.tempUnit ?? 'F';
      return u === 'C' ? { label: '°C', transform: identity } : { label: '°F', transform: cToF };
    }
    case 'pressure': {
      const u = displayPrefs?.pressureUnit ?? 'kpa';
      return u === 'hpa' ? { label: 'hPa', transform: kpaToHpa } : { label: 'kPa', transform: identity };
    }
    case 'voltage': {
      const u = displayPrefs?.voltageUnit ?? 'mv';
      return u === 'v' ? { label: 'V', transform: mvToV } : { label: 'mV', transform: identity };
    }
    case 'conductivity': {
      // Backend enum (user_preferences.py:25): dsm | mscm. 1 dS/m = 1 mS/cm.
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
// buildWirelessSensorCatalog(displayPrefs)
// =============================================================================
// Returns the ordered category list. Each entry: { id, label, charts[] }.
// Chart entry shape matches the device-side catalog so MeasurementTabPanel can
// render either kind interchangeably:
//   { key, title, info?, chartType, unit, transform, color?, series?,
//     primaryField?, availability }
//
// `source` is omitted (every wireless catalog chart is implicitly wireless).
// The panel that consumes this catalog passes the wireless hook's rows to
// every chart regardless of declaration.
export function buildWirelessSensorCatalog(displayPrefs) {
  const temp = resolveUnit('temperature', displayPrefs);
  const pressure = resolveUnit('pressure', displayPrefs);
  const voltage = resolveUnit('voltage', displayPrefs);
  const conductivity = resolveUnit('conductivity', displayPrefs);
  const resistance = resolveUnit('resistance', displayPrefs);
  const accel = resolveUnit('acceleration', displayPrefs);
  const altitude = resolveUnit('altitude', displayPrefs);

  // --- WEATHER -------------------------------------------------------------
  const weather = [
    {
      // Ambient temperature has two possible sources: the dedicated
      // high-resolution sensor (when present) and the standard sensor's
      // onboard temperature reading. Render both as series so the panel
      // auto-shows whichever the sensor actually carries —
      // buildMultiSensorLines filters out empty series, so on
      // high-resolution-equipped sensors only that line draws (with the
      // area-glow treatment via the lines.length === 1 rule), on
      // standard-only sensors only the standard line draws, and on the rare
      // sensor with both reporting you get two lines. (Field names below are
      // backend keys and stay as-is; only the user-facing labels are
      // brand-neutral.)
      key: 'temperature_ambient',
      title: 'Ambient Temperature',
      info: 'Onboard ambient temperature — MCP9808 (Primary) with BME688 (Aux) fallback',
      chartType: 'multiline',
      unit: temp.label,
      transform: temp.transform,
      // Per the sensor-hierarchy sheet: MCP9808 = Primary, BME688 = Aux.
      series: [
        { field: 'temperatureMcp9808', label: 'Primary', color: COLORS.temperatureMcp, transform: temp.transform },
        { field: 'temperatureBme', label: 'Aux', color: COLORS.temperatureBme, transform: temp.transform }
      ],
      availability: 'live'
    },
    {
      key: 'humidity_bme',
      title: 'Relative Humidity',
      info: 'Standard relative humidity',
      chartType: 'line',
      primaryField: 'humidityBme',
      unit: '%',
      transform: identity,
      color: COLORS.humidity,
      availability: 'live'
    },
    {
      key: 'pressure_bme',
      title: 'Air Pressure',
      info: 'Standard atmospheric pressure',
      chartType: 'line',
      primaryField: 'pressureBme',
      unit: pressure.label,
      transform: pressure.transform,
      color: COLORS.pressure,
      availability: 'live'
    },
    {
      key: 'gas_resistance',
      title: 'Gas Resistance',
      info: 'Gas-resistance reading — proxy for air-quality VOC load',
      chartType: 'line',
      primaryField: 'gasResistanceBme',
      unit: resistance.label,
      transform: resistance.transform,
      color: COLORS.gas,
      availability: 'live'
    }
  ];

  // --- LIGHT ---------------------------------------------------------------
  const light = [
    {
      key: 'lux',
      title: 'LUX',
      info: 'Illuminance from the wireless sensor’s onboard light probe',
      chartType: 'line',
      primaryField: 'lux',
      unit: 'lx',
      transform: identity,
      color: COLORS.lux,
      availability: 'live'
    }
  ];

  // --- SOIL ----------------------------------------------------------------
  // Two-probe layout (Probe 1 + Probe 2) for the four scalar soil families.
  // Soil-profile charts use the depth-array (sensor1_d1..d4) — those are 4-
  // line multi-series; in multi-sensor overlay they expand to N × 4 lines.
  const soil = [
    {
      key: 'soil_moisture',
      title: 'Soil Moisture (VWC)',
      chartType: 'multiline',
      unit: '%',
      transform: identity,
      series: [
        { field: 'vwcPercent_1', label: 'Probe 1', color: COLORS.soilMoisture },
        { field: 'vwcPercent_2', label: 'Probe 2', color: COLORS.soilMoistureSecondary }
      ],
      availability: 'live'
    },
    {
      key: 'soil_temperature',
      title: 'Soil Temperature',
      chartType: 'multiline',
      unit: temp.label,
      transform: temp.transform,
      series: [
        { field: 'temperatureTeros12_1', label: 'Probe 1', color: COLORS.soilTemp, transform: temp.transform },
        { field: 'temperatureTeros12_2', label: 'Probe 2', color: COLORS.soilTempSecondary, transform: temp.transform }
      ],
      availability: 'live'
    },
    {
      key: 'soil_ec',
      title: 'Soil Electrical Conductivity',
      chartType: 'multiline',
      unit: conductivity.label,
      transform: conductivity.transform,
      series: [
        { field: 'electricalConductivity_1', label: 'Probe 1', color: COLORS.soilEc, transform: conductivity.transform },
        { field: 'electricalConductivity_2', label: 'Probe 2', color: COLORS.soilEcSecondary, transform: conductivity.transform }
      ],
      availability: 'live'
    },
    {
      key: 'soil_matric',
      title: 'Soil Matric Potential',
      info: 'Soil water potential',
      chartType: 'multiline',
      unit: 'kPa',
      transform: identity,
      series: [
        { field: 'matricTeros22_1', label: 'Probe 1', color: COLORS.soilMatric },
        { field: 'matricTeros22_2', label: 'Probe 2', color: COLORS.soilMatricSecondary }
      ],
      availability: 'live'
    },
    {
      key: 'soil_profile_moisture',
      title: 'Soil Profile Moisture',
      info: '4-depth soil moisture profile',
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
      info: '4-depth soil temperature profile',
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
      info: 'Onboard 3-axis accelerometer',
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
      // Same field as battery_voltage; rendered as a separate chart so the
      // user can compare a percent-style view against the raw voltage trace.
      // No true % field exists yet — sources raw mVbat with the voltage unit
      // applied. A future pack-voltage→% mapping can be layered on later.
      key: 'battery_charge',
      title: 'Battery Charge',
      info: 'Sources raw mVbat — there is no separate battery-% telemetry yet',
      chartType: 'line',
      primaryField: 'mVbat',
      unit: voltage.label,
      transform: voltage.transform,
      color: COLORS.batteryCharge,
      availability: 'live'
    },
    {
      key: 'battery_voltage',
      title: 'Battery Voltage',
      chartType: 'line',
      primaryField: 'mVbat',
      unit: voltage.label,
      transform: voltage.transform,
      color: COLORS.batteryVoltage,
      availability: 'live'
    },
    {
      key: 'solar_voltage',
      title: 'Solar Panel Voltage',
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
      chartType: 'line',
      primaryField: 'mVusb',
      unit: voltage.label,
      transform: voltage.transform,
      color: COLORS.usbVoltage,
      availability: 'live'
    }
  ];

  return [
    { id: WIRELESS_CATEGORY_IDS.WEATHER, label: 'Environment', charts: weather },
    { id: WIRELESS_CATEGORY_IDS.LIGHT, label: 'Light', charts: light },
    { id: WIRELESS_CATEGORY_IDS.SOIL, label: 'Soil', charts: soil },
    { id: WIRELESS_CATEGORY_IDS.POWER, label: 'Power & Device', charts: power }
  ];
}

// Per-chart field projection — the wireless SWR hook's `fields=` param. Saves
// payload by asking the backend for only the columns the category renders.
export function wirelessFieldsForCharts(charts) {
  const fields = new Set();
  for (const c of charts ?? []) {
    if (c.availability === 'needs-backend') continue;
    if (Array.isArray(c.series)) {
      c.series.forEach((s) => s.field && fields.add(s.field));
    } else if (c.primaryField) {
      fields.add(c.primaryField);
    }
  }
  return [...fields];
}
