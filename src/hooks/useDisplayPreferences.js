import { useMemo } from 'react';

import useUserPreferences, { defaultUiPreferences } from 'hooks/data/useUserPreferences';

// =============================================================================
// useDisplayPreferences — display-layer view of the user's saved
// preferences, flat and component-friendly.
// =============================================================================
//
// Wraps useUserPreferences() (the SWR fetch hook) and exposes a flat
// object call sites can destructure without thinking about the
// nested API shape:
//
//   const { tempUnit, speedUnit, timezone } = useDisplayPreferences();
//   formatTemperature(row.temperature_c, tempUnit);
//
// Why this split (hook + utils) instead of one big formatter hook:
//
//   - The conversion / format functions in utils/displayUnits.js are
//     PURE — easy to unit-test, easy to call from non-React code
//     (transformers, CSV exports, server-side rendering).
//   - This hook owns the React-y bits: subscribing to the SWR cache,
//     filling in defaults, returning a memoized object so consumers
//     don't tear down child memos every render.
//   - That separation means a single source of truth for the saved
//     preferences (useUserPreferences) feeds both the Account Settings
//     form (which reads + writes) and every display point in the app
//     (which only reads via this hook).
//
// Defaults match defaultUiPreferences in hooks/data/useUserPreferences.js
// and the backend UiPreferencesUnits Literal defaults
// (phenodeX/phenode_backend/schemas/user_preferences.py:18-27). When the
// SWR fetch is in-flight or fails, this hook returns those defaults so
// no consumer ever gets `undefined` for a unit identifier.

export default function useDisplayPreferences() {
  const { preferences } = useUserPreferences();

  // Memoize so the returned object reference is stable across renders
  // that don't actually change preferences. Without this, every parent
  // re-render would create a fresh object and any consumer with
  // `[displayPrefs]` in a deps array would invalidate downstream
  // memos for no reason.
  return useMemo(() => {
    const ui = preferences?.uiPreferences ?? {};
    const units = {
      ...defaultUiPreferences.units,
      ...(ui.units || {})
    };
    return {
      timezone: ui.timezone ?? null,
      units,
      // Flat aliases — what consumers actually destructure. Keeps the
      // call sites short and lets you grep for "tempUnit" to find
      // every temperature-display point in the app.
      tempUnit: units.temperature,
      speedUnit: units.speed,
      distanceUnit: units.distance,
      pressureUnit: units.pressure,
      rainUnit: units.rainfall,
      voltageUnit: units.voltage,
      conductivityUnit: units.conductivity,
      resistanceUnit: units.resistance,
      accelerationUnit: units.acceleration
    };
  }, [preferences]);
}
