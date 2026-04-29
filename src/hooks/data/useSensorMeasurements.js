import { useEffect, useState } from 'react';

import { fetchSensorMeasurementCharts, fetchSensorInfo, fetchSoilProbeReadings } from 'services/api';

/**
 * Returns the measurement-chart series for the active sensor.
 * Today backed by mock data — swap the underlying api.js call when the
 * backend lands.
 */
export function useSensorMeasurementCharts() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSensorMeasurementCharts()
      .then((charts) => !cancelled && (setData(charts), setError(null)))
      .catch((err) => !cancelled && (setError(err), setData(null)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}

export function useSensorInfo() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSensorInfo()
      .then((info) => !cancelled && (setData(info), setError(null)))
      .catch((err) => !cancelled && (setError(err), setData(null)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}

export function useSoilProbeReadings(probeId = 'probe-1') {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchSoilProbeReadings(probeId)
      .then((readings) => !cancelled && (setData(readings), setError(null)))
      .catch((err) => !cancelled && (setError(err), setData(null)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [probeId]);

  return { data, isLoading, error };
}
