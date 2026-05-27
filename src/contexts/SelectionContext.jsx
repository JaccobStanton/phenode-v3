import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import useMyDevices from 'hooks/data/useMyDevices';
import { LOGOUT_EVENT } from 'contexts/AuthContext';

/**
 * Cross-page device selection — the single source of truth for which PheNode
 * the dashboard is scoped to. Lives above the routed pages (mounted in
 * layout/Dashboard) so the selection survives in-app navigation and only
 * resets on logout.
 *
 * Two pieces of state drive the effective selection:
 *
 *   1. explicitPheNodeId — set when the user *actively* picks a device:
 *      clicking a fleet-overview card, choosing from a dropdown, or landing
 *      via a deep link (?device=/?sensor=). Once set it is the answer
 *      everywhere and never changes on its own. Persisted to sessionStorage
 *      so a hard refresh keeps the pick.
 *
 *   2. frozenRecencyPheNodeId — a SNAPSHOT of the most-recently-reporting
 *      device, captured exactly once the first time the device list loads
 *      and then held for the rest of the session (also sessionStorage-backed,
 *      so a refresh doesn't re-capture a newer winner). This is the fallback
 *      when the user hasn't explicitly chosen anything.
 *
 * Effective selection = explicit (if it still exists) → frozen recency →
 * live recency (only as a last resort before the freeze captures). Because
 * BOTH inputs are frozen at the session level, the selection can never shift
 * under the user — not during the 60s SWR poll while they sit on a page, and
 * not in the gap between navigating from one page to the next. It changes
 * only when the user picks something new, and reverts to "most recent" at the
 * next login.
 *
 * Why this replaces the per-page freeze the pages used to do individually:
 * that freeze reset on every component unmount (i.e. every navigation), so a
 * device that reported in the gap between two page loads could swap the
 * selection out from under the user mid-navigation. Hoisting the freeze to
 * this session-scoped provider fixes that class of bug for good.
 */

const SelectionContext = createContext(null);

// sessionStorage keys — sessionStorage (not localStorage) is deliberate: the
// selection should live for the browser session and clear when the tab
// closes, matching "sticks until they log out." We also clear these
// explicitly on LOGOUT_EVENT below so an in-place logout (no tab close) still
// resets to most-recent on the next login.
const EXPLICIT_KEY = 'phenode.selection.explicitPheNodeId';
const FROZEN_RECENCY_KEY = 'phenode.selection.frozenRecencyPheNodeId';

// Safe sessionStorage helpers — storage can be unavailable (privacy mode,
// SSR, blocked cookies). On failure we degrade to in-memory-only state for
// the current page rather than throwing.
function readStored(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // ignore — in-memory state below is still authoritative for this page.
  }
}

// Most-recently-reporting device id. Same -Infinity-fallback recency sort the
// fleet views and the per-page defaults used, so the device surfaced here is
// the same one that sits at the top of the fleet list.
function pickRecencyWinner(devices) {
  if (!devices?.length) return null;
  const byRecency = [...devices].sort((a, b) => {
    const aTime = a.last_measurement_at ? new Date(a.last_measurement_at).getTime() : -Infinity;
    const bTime = b.last_measurement_at ? new Date(b.last_measurement_at).getTime() : -Infinity;
    return bTime - aTime;
  });
  return byRecency[0]?.external_device_id ?? null;
}

export function SelectionProvider({ children }) {
  // The device list drives the recency default. useMyDevices is SWR-cached
  // and deduped, so the pages calling it too don't trigger extra requests.
  const { devices } = useMyDevices();

  // Initialize from sessionStorage so a hard refresh restores the session's
  // selection synchronously on first paint (no flicker through the recency
  // default before the stored value loads).
  const [explicitPheNodeId, setExplicitPheNodeId] = useState(() => readStored(EXPLICIT_KEY));
  const [frozenRecencyPheNodeId, setFrozenRecencyPheNodeId] = useState(() => readStored(FROZEN_RECENCY_KEY));

  // Sensor sub-selection + time range stay available on the context for the
  // pages that share them; sensor selection is otherwise scoped per-page.
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [timeRange, setTimeRange] = useState('Last 24 hours');

  const liveRecencyId = useMemo(() => pickRecencyWinner(devices), [devices]);

  // Capture the recency winner exactly once per session. The `!frozenRecency`
  // guard means a later poll that crowns a different "most recent" device
  // can't overwrite the frozen value — that's what keeps the fallback stable
  // across both polls and page switches.
  useEffect(() => {
    if (!liveRecencyId || frozenRecencyPheNodeId) return;
    setFrozenRecencyPheNodeId(liveRecencyId);
    writeStored(FROZEN_RECENCY_KEY, liveRecencyId);
  }, [liveRecencyId, frozenRecencyPheNodeId]);

  const deviceExists = useCallback((id) => Boolean(id) && Boolean(devices?.some((d) => d.external_device_id === id)), [devices]);

  // Resolve the effective selection. While devices are still loading we trust
  // the persisted ids (can't disprove them yet) so the page doesn't flash a
  // different device on first paint. Once loaded, an explicit pick that no
  // longer exists (device removed) gracefully falls through to recency rather
  // than stranding the dropdowns on a phantom id.
  const selectedPheNodeId = useMemo(() => {
    if (explicitPheNodeId) {
      if (!devices) return explicitPheNodeId;
      if (deviceExists(explicitPheNodeId)) return explicitPheNodeId;
    }
    if (frozenRecencyPheNodeId) {
      if (!devices) return frozenRecencyPheNodeId;
      if (deviceExists(frozenRecencyPheNodeId)) return frozenRecencyPheNodeId;
    }
    return liveRecencyId;
  }, [explicitPheNodeId, frozenRecencyPheNodeId, liveRecencyId, devices, deviceExists]);

  // Record an explicit user pick. Pass null to clear back to the recency
  // default (e.g. the user empties a dropdown). React bails on a no-op
  // setState when the id is unchanged, so callers can fire this freely (the
  // deep-link bridges re-assert the URL value on every render).
  const selectPheNode = useCallback((id) => {
    const next = id ?? null;
    setExplicitPheNodeId(next);
    writeStored(EXPLICIT_KEY, next);
  }, []);

  // Reset on logout. AuthContext dispatches LOGOUT_EVENT *before* clearing
  // tokens (same hook SWRProvider uses to wipe its cache), so we clear both
  // the in-memory state and the persisted keys here — the next login then
  // re-captures whichever device is most-recent at that moment.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onLogout = () => {
      setExplicitPheNodeId(null);
      setFrozenRecencyPheNodeId(null);
      setSelectedSensor(null);
      writeStored(EXPLICIT_KEY, null);
      writeStored(FROZEN_RECENCY_KEY, null);
    };
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, []);

  const value = useMemo(
    () => ({
      selectedPheNodeId,
      isExplicitSelection: Boolean(explicitPheNodeId),
      selectPheNode,
      selectedSensor,
      setSelectedSensor,
      timeRange,
      setTimeRange
    }),
    [selectedPheNodeId, explicitPheNodeId, selectPheNode, selectedSensor, timeRange]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/**
 * Read or write the shared device selection. Returns `null` when used outside
 * a provider (tests, Storybook), so consumers should optional-chain or guard.
 */
export function useSelection() {
  return useContext(SelectionContext);
}
