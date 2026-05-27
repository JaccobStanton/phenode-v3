import useSWR from 'swr';

import useAuth from 'hooks/useAuth';
import API from 'services/endpoints';
import { buildUrl, fetcher } from 'services/fetcher';

// =============================================================================
// useUserPreferences — SWR hook for GET /user-preferences.
// =============================================================================
//
// Returns:
//   {
//     preferences: UserPreferencesRead | undefined,
//     isLoading:   boolean,
//     error:       ApiError | undefined,
//     mutate:      (data?, opts?) => Promise<UserPreferencesRead>,
//   }
//
// Shape of UserPreferencesRead (per phenodeX/phenode_backend/schemas/
// user_preferences.py):
//   {
//     dataDownloadPreferences: {
//       errorValues, blankCells, hyphens, zeroValues, decimalPlaces,
//       dateAndTimeFormat, downsample      // all objects/dicts
//     },
//     uiPreferences: {
//       timezone: string | null,           // null → use device timezone
//       units: {
//         temperature, distance, speed, pressure, rainfall,
//         voltage, conductivity, resistance, acceleration
//       }
//     }
//   }
//
// The backend GET also CREATES a preferences row with defaults if the
// user doesn't have one yet, so this hook always resolves to a usable
// preferences object (no "first-time empty" edge case to handle in the
// view).
//
// Cache key matches the pattern used by useMyDevices: [url, accessToken]
// so logout/login invalidates automatically and two consumers share one
// network request.
//
// We deliberately skip `refreshInterval` here — preferences only change
// when the user saves them via the Account Settings form, and that flow
// already calls `mutate()` directly to refresh. Polling every minute
// would just be churn.

export default function useUserPreferences() {
  const { accessToken, isAuthenticated } = useAuth();

  const swrKey = isAuthenticated && accessToken ? [buildUrl(API.userPreferences.base), accessToken] : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    // Match the structural-equality compare used by useMyDevices so a
    // re-fetch that returns byte-identical data doesn't cascade into
    // every downstream useMemo's deps array. Preferences are a small
    // object — JSON.stringify is cheap.
    compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });

  return { preferences: data, isLoading, error, mutate };
}

// Defaults mirror the backend's UiPreferencesUnits / UiPreferences
// pydantic models. Exported so the form can fall back to these when
// preferences load with partial data, and so the unit `<Select>`
// controls don't bind to `undefined`.
//
// Source: phenodeX/phenode_backend/schemas/user_preferences.py:18-33
export const defaultUiPreferences = {
  timezone: null,
  units: {
    temperature: 'F',
    distance: 'mi',
    speed: 'mph',
    pressure: 'kpa',
    rainfall: 'mm',
    voltage: 'mv',
    conductivity: 'dsm',
    resistance: 'kohm',
    acceleration: 'ms2'
  }
};
