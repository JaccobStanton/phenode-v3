// =============================================================================
// displayUnits — pure conversion + format helpers for the user's
// display preference units.
// =============================================================================
//
// One-stop conversion layer between the canonical units the backend
// returns and the units the user has selected in Account Settings →
// Display.
//
// Convention used throughout this module:
//
//   - `convert*` functions take a NUMBER in the canonical backend unit
//     and return a NUMBER in the target unit. They short-circuit to
//     `null` for `null` / `undefined` / `NaN` so callers don't have to
//     guard.
//
//   - `format*` functions take the same canonical number and return a
//     READY-TO-RENDER STRING (e.g. "74.30°F"). They return 'N/A' for
//     missing data so a card cell never renders an empty space.
//
//   - Every format function accepts an optional `decimals` parameter so
//     a chart axis label (where you want "23°C") and a card cell (where
//     you want "23.45°C") can share the same helper.
//
// Canonical backend units (verified against
// phenodeX/phenode_backend/schemas/devices.py and
// schemas/wireless_sensors.py; and the existing legacy formatters in
// utils/transforms/device.js):
//
//   - temperature_c           → Celsius (°C)
//   - rainfall_today_mm        → millimeters (mm)
//   - rainfall_mm_hr           → millimeters per hour (mm/hr)
//   - wind_speed               → meters per second (m/s)
//                                (per the device.js comment, which
//                                 confirms the chart endpoint emits m/s)
//
// For unit families that don't have a backend field with a unit suffix
// (voltage, conductivity, resistance, acceleration), we assume the
// canonical input matches the user-preference identifier for the SI-
// style choice (V for voltage, dS/m for conductivity, Ω for resistance,
// m/s² for acceleration). When a real sensor reading lands with a
// different storage unit, the call site can pre-convert before calling
// in here.
//
// Unit identifiers match the backend's UiPreferencesUnits enum
// (phenodeX/phenode_backend/schemas/user_preferences.py:18-27) — keep
// any new values aligned with that list.

// ============================================================================
// Internals
// ============================================================================

// `null`-ish guard for everything that flows through here. Callers can
// safely pass any of (null | undefined | NaN | non-finite number) and
// get a sentinel back instead of a downstream "NaN°F" render.
function isMissing(value) {
  return value == null || typeof value !== 'number' || !Number.isFinite(value);
}

function fmt(value, decimals) {
  return typeof decimals === 'number' ? value.toFixed(decimals) : String(value);
}

// ============================================================================
// Temperature   (canonical input: °C)
// ============================================================================

export function convertTemperature(celsius, targetUnit) {
  if (isMissing(celsius)) return null;
  if (targetUnit === 'C') return celsius;
  // Default to Fahrenheit for any unknown / missing target so a typo'd
  // preference doesn't strand the user with a blank value.
  return celsius * (9 / 5) + 32;
}

export function formatTemperature(celsius, targetUnit = 'F', decimals = 2) {
  const v = convertTemperature(celsius, targetUnit);
  if (v == null) return 'N/A';
  return `${fmt(v, decimals)}°${targetUnit === 'C' ? 'C' : 'F'}`;
}

// ============================================================================
// Speed        (canonical input: m/s)
// ============================================================================

export function convertSpeed(metersPerSecond, targetUnit) {
  if (isMissing(metersPerSecond)) return null;
  switch (targetUnit) {
    case 'mph':
      return metersPerSecond * 2.2369362921;
    case 'kmh':
      return metersPerSecond * 3.6;
    case 'ms':
    default:
      return metersPerSecond;
  }
}

export function formatSpeed(metersPerSecond, targetUnit = 'mph', decimals = 2) {
  const v = convertSpeed(metersPerSecond, targetUnit);
  if (v == null) return 'N/A';
  const suffix = targetUnit === 'kmh' ? ' km/h' : targetUnit === 'ms' ? ' m/s' : ' mph';
  return `${fmt(v, decimals)}${suffix}`;
}

// ============================================================================
// Distance     (canonical input: meters)
// ============================================================================

export function convertDistance(meters, targetUnit) {
  if (isMissing(meters)) return null;
  switch (targetUnit) {
    case 'km':
      return meters / 1000;
    case 'mi':
    default:
      return meters / 1609.344;
  }
}

export function formatDistance(meters, targetUnit = 'mi', decimals = 2) {
  const v = convertDistance(meters, targetUnit);
  if (v == null) return 'N/A';
  return `${fmt(v, decimals)} ${targetUnit === 'km' ? 'km' : 'mi'}`;
}

// ============================================================================
// Pressure     (canonical input: kPa)
// ============================================================================

export function convertPressure(kilopascal, targetUnit) {
  if (isMissing(kilopascal)) return null;
  switch (targetUnit) {
    case 'hpa':
      return kilopascal * 10;
    case 'kpa':
    default:
      return kilopascal;
  }
}

export function formatPressure(kilopascal, targetUnit = 'kpa', decimals = 2) {
  const v = convertPressure(kilopascal, targetUnit);
  if (v == null) return 'N/A';
  return `${fmt(v, decimals)} ${targetUnit === 'hpa' ? 'hPa' : 'kPa'}`;
}

// ============================================================================
// Rainfall     (canonical input: mm)
// ============================================================================

export function convertRainfall(millimeters, targetUnit) {
  if (isMissing(millimeters)) return null;
  switch (targetUnit) {
    case 'in':
      return millimeters * 0.0393700787;
    case 'mm':
    default:
      return millimeters;
  }
}

export function formatRainfall(millimeters, targetUnit = 'mm', decimals = 2) {
  const v = convertRainfall(millimeters, targetUnit);
  if (v == null) return 'N/A';
  return `${fmt(v, decimals)} ${targetUnit === 'in' ? 'in' : 'mm'}`;
}

// ============================================================================
// Voltage      (canonical input: volts)
// ============================================================================

export function convertVoltage(volts, targetUnit) {
  if (isMissing(volts)) return null;
  switch (targetUnit) {
    case 'mv':
      return volts * 1000;
    case 'v':
    default:
      return volts;
  }
}

export function formatVoltage(volts, targetUnit = 'mv', decimals = 2) {
  const v = convertVoltage(volts, targetUnit);
  if (v == null) return 'N/A';
  return `${fmt(v, decimals)} ${targetUnit === 'v' ? 'V' : 'mV'}`;
}

// ============================================================================
// Conductivity (canonical input: dS/m)
// ============================================================================
//
// Note: 1 dS/m == 1 mS/cm numerically (the units happen to be equivalent),
// so the conversion is a no-op; only the label changes. Kept as a separate
// function for parity with the other unit families so consumers can call
// the same shape everywhere.

export function convertConductivity(dsm, targetUnit) {
  if (isMissing(dsm)) return null;
  // Both 'dsm' and 'mscm' map to the same numeric value; the difference
  // is purely how we LABEL the value when rendering.
  return dsm;
}

export function formatConductivity(dsm, targetUnit = 'dsm', decimals = 2) {
  const v = convertConductivity(dsm, targetUnit);
  if (v == null) return 'N/A';
  return `${fmt(v, decimals)} ${targetUnit === 'mscm' ? 'mS/cm' : 'dS/m'}`;
}

// ============================================================================
// Resistance   (canonical input: ohms)
// ============================================================================

export function convertResistance(ohms, targetUnit) {
  if (isMissing(ohms)) return null;
  switch (targetUnit) {
    case 'kohm':
      return ohms / 1000;
    case 'ohm':
    default:
      return ohms;
  }
}

export function formatResistance(ohms, targetUnit = 'kohm', decimals = 2) {
  const v = convertResistance(ohms, targetUnit);
  if (v == null) return 'N/A';
  return `${fmt(v, decimals)} ${targetUnit === 'kohm' ? 'kΩ' : 'Ω'}`;
}

// ============================================================================
// Acceleration (canonical input: m/s²)
// ============================================================================

export function convertAcceleration(metersPerSecondSquared, targetUnit) {
  if (isMissing(metersPerSecondSquared)) return null;
  switch (targetUnit) {
    case 'g':
      return metersPerSecondSquared / 9.80665;
    case 'ms2':
    default:
      return metersPerSecondSquared;
  }
}

export function formatAcceleration(metersPerSecondSquared, targetUnit = 'ms2', decimals = 2) {
  const v = convertAcceleration(metersPerSecondSquared, targetUnit);
  if (v == null) return 'N/A';
  return `${fmt(v, decimals)} ${targetUnit === 'g' ? 'g' : 'm/s²'}`;
}
