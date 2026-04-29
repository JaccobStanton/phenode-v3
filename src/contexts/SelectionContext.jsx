import { createContext, useContext, useMemo, useState } from 'react';

/**
 * Cross-page selection state — currently selected PheNode, sensor, and time range.
 *
 * When the backend lands and pages start sharing data scope (e.g. picking
 * "PheNode 020" on Sensor Network and navigating to System Diagnostics), this
 * context is the single source of truth. Today consumers can opt-in by reading
 * `useSelection()`; pages that still own their own local state continue to work.
 */

const SelectionContext = createContext(null);

const DEFAULT_SELECTION = {
  selectedPheNode: null,
  selectedSensor: null,
  timeRange: 'Last 24 hours'
};

export function SelectionProvider({ children, initialSelection = DEFAULT_SELECTION }) {
  const [selectedPheNode, setSelectedPheNode] = useState(initialSelection.selectedPheNode);
  const [selectedSensor, setSelectedSensor] = useState(initialSelection.selectedSensor);
  const [timeRange, setTimeRange] = useState(initialSelection.timeRange);

  const value = useMemo(
    () => ({
      selectedPheNode,
      setSelectedPheNode,
      selectedSensor,
      setSelectedSensor,
      timeRange,
      setTimeRange
    }),
    [selectedPheNode, selectedSensor, timeRange]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/**
 * Read or write cross-page selection state. Returns `null` when used outside a
 * provider, so consumers can fall back to local state when desired.
 */
export function useSelection() {
  return useContext(SelectionContext);
}
