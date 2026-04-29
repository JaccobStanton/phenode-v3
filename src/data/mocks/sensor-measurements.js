// Mock sensor measurement series shared between Sensor Network and Sensor Measurements pages.

export const sensorMeasurementCharts = [
  { title: 'Temperature', lineColor: '#48f7f5', data: [48, 52, 58, 63, 67, 73, 78, 82, 79, 75, 81, 86, 83] },
  { title: 'Humidify', lineColor: '#c96cfc', data: [76, 73, 69, 64, 58, 53, 49, 45, 48, 54, 61, 67, 72] },
  { title: 'LUX', lineColor: '#f47568', data: [80, 130, 240, 410, 560, 700, 860, 980, 930, 840, 760, 640, 520] },
  { title: 'Soil Temperature', lineColor: '#940bf4', data: [42, 45, 49, 53, 57, 61, 65, 68, 66, 62, 59, 56, 54] },
  {
    title: 'Electrical Conductivity',
    lineColor: '#f40b8f',
    data: [0.72, 0.8, 0.94, 1.08, 1.2, 1.36, 1.52, 1.67, 1.61, 1.48, 1.34, 1.22, 1.1]
  },
  { title: 'Soil Moisture', lineColor: '#8539e0', data: [19, 22, 27, 33, 38, 45, 51, 57, 53, 47, 41, 36, 32] },
  {
    title: 'Battery Voltage (mV)',
    lineColor: '#0043c2',
    data: [4210, 4207, 4201, 4194, 4186, 4178, 4169, 4160, 4151, 4142, 4133, 4123, 4114]
  }
];

export const soilProbeReadings = {
  'probe-1': [
    { label: 'Soil Temperature', value: '61.84 °F' },
    { label: 'Soil Moisture', value: '42.5 %' },
    { label: 'Soil Salinity', value: '1.83 kPa' }
  ],
  'probe-2': [
    { label: 'Soil Temperature', value: '59.12 °F' },
    { label: 'Soil Moisture', value: '39.8 %' },
    { label: 'Soil Salinity', value: '2.07 kPa' }
  ]
};

export const sensorInfoReadings = [
  { label: 'Sensor ID', value: 'WS-1234568' },
  { label: 'GPS', value: '32 42 23 43, 92 89' },
  { label: 'Altitude', value: '793.95ft' },
  { label: 'Battery', value: '87.52%' },
  { label: 'Probes Connected', value: '2' }
];
