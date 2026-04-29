import { useEffect, useState } from 'react';

import { fetchPhenodeFleet, fetchSensorFleet } from 'services/api';

/**
 * Returns fleet rows for either PheNodes or wireless sensors.
 *
 *   const { data, isLoading, error } = useFleet('phenode');
 *
 * Today this is backed by mock data; once the backend is ready, swap the
 * underlying api.js functions and consumers don't need to change.
 *
 * @param {'phenode'|'sensor'} kind
 */
export default function useFleet(kind = 'phenode') {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const promise = kind === 'sensor' ? fetchSensorFleet() : fetchPhenodeFleet();

    promise
      .then((rows) => {
        if (cancelled) return;
        setData(rows);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind]);

  return { data, isLoading, error };
}
