import { useState } from 'react';

/**
 * Tiny hook that owns the "sensor info vs soil data" toggle plus the
 * currently-selected soil probe. Replaces the prop-drilling that used to
 * happen between SensorNetwork and MapView.
 *
 *   const info = useInfoCard();
 *   <MapView {...info} />
 */
export default function useInfoCard(initialMode = 'sensor', initialProbe = 'probe-1') {
  const [infoCardMode, setInfoCardMode] = useState(initialMode);
  const [selectedSoilProbe, setSelectedSoilProbe] = useState(initialProbe);

  return {
    infoCardMode,
    setInfoCardMode,
    selectedSoilProbe,
    setSelectedSoilProbe,
    isSoilDataMode: infoCardMode === 'soil',
    toggleMode: () => setInfoCardMode((prev) => (prev === 'soil' ? 'sensor' : 'soil'))
  };
}
