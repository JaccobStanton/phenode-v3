// Mock fleet data — both PheNode-level rows and wireless-sensor-level rows.
// Today these are static; once the API is wired they'll be replaced by hook output.

export const phenodeFleetRows = [
  {
    siteName: 'Shakoor Lab 020',
    lastMeasurements: '3/5/2026, 12:13:44 PM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '51.98°F' },
      { label: "Today's Rainfall", value: '0 mm/hr' },
      { label: 'Wind Speed:', value: 'N/A' },
      { label: 'Battery:', value: '99.29%' }
    ]
  },
  {
    siteName: 'Danforth Field Research',
    lastMeasurements: '3/5/2026, 12:08:29 PM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '52.70°F' },
      { label: "Today's Rainfall:", value: '24.5 mm/hr' },
      { label: 'Wind Speed:', value: '0.88 mph' },
      { label: 'Battery:', value: '100%' }
    ]
  },
  {
    siteName: 'Danforth Prairie',
    lastMeasurements: '3/5/2026, 11:52:01 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '50.54°F' },
      { label: "Today's Rainfall:", value: '28 mm/hr' },
      { label: 'Wind Speed:', value: 'N/A' },
      { label: 'Battery:', value: '99.43%' }
    ]
  },
  {
    siteName: 'Clemson PDREC',
    lastMeasurements: '3/5/2026, 10:48:24 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '69.26°F' },
      { label: "Today's Rainfall:", value: '0 mm/hr' },
      { label: 'Wind Speed:', value: '2.51 mph' },
      { label: 'Battery:', value: '99.43%' }
    ]
  },
  {
    siteName: 'Shakoor Lab 017',
    lastMeasurements: '3/5/2026, 10:12:08 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '55.12°F' },
      { label: "Today's Rainfall:", value: '5 mm/hr' },
      { label: 'Wind Speed:', value: '1.21 mph' },
      { label: 'Battery:', value: '98.87%' }
    ]
  }
];

export const sensorFleetRows = [
  {
    siteName: 'WS-1234567',
    lastMeasurements: '3/5/2026, 12:13:44 PM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '51.98°F' },
      { label: "Today's Rainfall", value: '0 mm/hr' },
      { label: 'Wind Speed:', value: 'N/A' },
      { label: 'Battery:', value: '99.29%' }
    ]
  },
  {
    siteName: 'WS-1112131415',
    lastMeasurements: '3/5/2026, 12:08:29 PM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '52.70°F' },
      { label: "Today's Rainfall:", value: '24.5 mm/hr' },
      { label: 'Wind Speed:', value: '0.88 mph' },
      { label: 'Battery:', value: '100%' }
    ]
  },
  {
    siteName: 'WS-12345674',
    lastMeasurements: '3/5/2026, 11:52:01 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '50.54°F' },
      { label: "Today's Rainfall:", value: '28 mm/hr' },
      { label: 'Wind Speed:', value: 'N/A' },
      { label: 'Battery:', value: '99.43%' }
    ]
  },
  {
    siteName: 'WS-98765443',
    lastMeasurements: '3/5/2026, 10:48:24 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '69.26°F' },
      { label: "Today's Rainfall:", value: '0 mm/hr' },
      { label: 'Wind Speed:', value: '2.51 mph' },
      { label: 'Battery:', value: '99.43%' }
    ]
  },
  {
    siteName: 'WS-56473892',
    lastMeasurements: '3/5/2026, 10:12:08 AM',
    metrics: [
      { label: 'Health Status:', value: 'Active' },
      { label: 'Temperature:', value: '55.12°F' },
      { label: "Today's Rainfall:", value: '5 mm/hr' },
      { label: 'Wind Speed:', value: '1.21 mph' },
      { label: 'Battery:', value: '98.87%' }
    ]
  }
];
