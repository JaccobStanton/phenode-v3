import * as yup from 'yup';

// =============================================================================
// Yup runtime validation for the /api/wireless-sensors/my-sensors response.
// =============================================================================
//
// Why a separate schema (mirrors services/schemas/device.js):
//
//   Wireless sensors share the *concept* of a fleet list with PheNodes,
//   but the wire shape is different in two important ways:
//
//   1. The response is wrapped: { success: true, sensors: [...] }
//      — not a bare array like /api/devices/my-devices.
//   2. The fields use camelCase aliases (`_id`, `externalSensorId`,
//      `lastMeasurementAt`, etc.). DeviceRead exposes snake_case;
//      WirelessSensorListItem uses pydantic Field(..., alias=...) on
//      every field (see phenodeX/phenode_backend/schemas/
//      wireless_sensors.py:70-81), and FastAPI's response_model
//      serializes with by_alias=True by default. Confirmed against
//      the existing phenodeX frontend, which reads
//      `sensor.externalSensorId` (phenode_frontend/src/utils/
//      mapSensors.js:7).
//
//   Validating at the boundary is the same defense as for devices:
//   when the backend renames a field we want to fail loudly with
//   a "failed to load fleet" card, not silently render N/A in every
//   slot because we typo'd a key.
//
// What we validate vs. ignore:
//
//   - REQUIRED: id (`_id`), externalSensorId — without these you
//     can't reference the sensor at all.
//   - OPTIONAL summary fields (lastMeasurementAt, healthStatus,
//     batteryPercent, soilMoisture, soilTemperatureC, rssi) and the
//     optional location fields (latitude, longitude) are all
//     `.nullable().optional()` — a freshly provisioned sensor with
//     no measurements yet still validates, and the row transformer's
//     formatters render 'N/A' for missing values. Coordinates are
//     additionally sanitized server-side (Null-Island, out-of-range,
//     and NaN values are nulled before they ever leave the API), so
//     we treat any non-null lat/lng received here as plottable.
//   - Unknown keys pass through (default Yup behavior). The backend
//     can extend the response without breaking us.
//
// Backend reference:
//   phenodeX/phenode_backend/schemas/wireless_sensors.py:70-83
//     (WirelessSensorListItem, WirelessSensorsListResponse)
//   phenodeX/phenode_backend/api/wireless_sensors/routes.py:69-89
//     (_clean_location helper — Null-Island, bounds, NaN guards
//      applied to both list and detail endpoints)
//   phenodeX/phenode_backend/api/wireless_sensors/routes.py:139-240
//     (list route — health_status computed via the configurable
//      DEVICE_LIVE_WINDOW_MINUTES window (default 120 min, routes.py:
//      206-214), the same setting PheNode devices use. Location resolved
//      from latest reading with fallback to the static sensor row, then
//      cleaned)

const wirelessSensorListItemSchema = yup.object({
  // Required identifiers — the backend always populates these.
  // `_id` is the pydantic alias for the integer DB id.
  _id: yup.number().required(),
  externalSensorId: yup.string().required(),

  // 12-char lowercase hex MAC (no separators) — derived server-side from
  // either the externalSensorId (when it follows the WS-<MAC> convention)
  // or from the latest reading's `wirelessDeviceMac` / `mac` field. See
  // phenodeX/phenode_backend/api/wireless_sensors/routes.py:39-57
  // (_mac_from_external_sensor_id / _mac_from_measurements) for the
  // resolution chain. Optional — a freshly-provisioned sensor with no
  // readings yet and a non-WS-prefixed externalSensorId returns null.
  macAddress: yup.string().nullable().optional(),

  // Optional metadata
  label: yup.string().nullable().optional(),

  // Optional summary fields — what the fleet view actually displays.
  // ISO 8601 datetime, omitted if the sensor has never reported.
  lastMeasurementAt: yup.string().nullable().optional(),
  // Computed server-side: "Live" if seen within the configurable
  // DEVICE_LIVE_WINDOW_MINUTES window (default 120 min), else "Offline" —
  // the same window PheNode devices use.
  healthStatus: yup.string().nullable().optional(),
  batteryPercent: yup.number().nullable().optional(),
  soilMoisture: yup.number().nullable().optional(),
  soilTemperatureC: yup.number().nullable().optional(),

  // Location — sanitized server-side via _clean_location (routes.py:69-89)
  // so any non-null value here is safe to plot. Order matches the backend
  // payload ordering (routes.py:184-185, 198-201) for grep parity.
  latitude: yup.number().nullable().optional(),
  longitude: yup.number().nullable().optional(),

  rssi: yup.number().nullable().optional()
});

// The endpoint response is wrapped: { success: true, sensors: [...] }.
// We validate the wrapper too so a 200 with { success: false, ... } or
// a malformed envelope fails at the boundary rather than reaching the
// transformer with `undefined` on .sensors.
const wirelessSensorListResponseSchema = yup.object({
  success: yup.boolean().required(),
  sensors: yup.array().of(wirelessSensorListItemSchema).required()
});

// =============================================================================
// WirelessSensorDetail — GET /wireless-sensors/{externalSensorId}
// =============================================================================
//
// Distinct from the list shape because the detail endpoint composes the
// latest sensor reading into nested groups (location with altitude,
// battery with both voltage and percent, two soil-probe slots, gas
// sensor, etc.) — see WirelessSensorDetail in
// phenodeX/phenode_backend/schemas/wireless_sensors.py:118-131 and the
// route handler at phenodeX/phenode_backend/api/wireless_sensors/
// routes.py:243-306.
//
// Why we validate every nested group as `.nullable().optional()`:
//   - A freshly provisioned sensor with no readings yet returns nulls
//     across the board; the route still 200s with the sparse object.
//   - Each formatter on the consumer side renders 'N/A' / '—' for
//     missing values, so the UI degrades gracefully.
//   - Pinning every field as required would make the response break
//     for any sensor that hasn't reported all metric ports yet.
const wirelessSensorLocationSchema = yup
  .object({
    latitude: yup.number().nullable().optional(),
    longitude: yup.number().nullable().optional(),
    altitude: yup.number().nullable().optional()
  })
  .nullable()
  .optional();

const wirelessSensorBatterySchema = yup
  .object({
    batteryVoltage: yup.number().nullable().optional(),
    batteryPercent: yup.number().nullable().optional()
  })
  .nullable()
  .optional();

const wirelessSoilSensorSchema = yup.object({
  soilMoisture: yup.number().nullable().optional(),
  soilTemperature: yup.number().nullable().optional(),
  electricalConductivity: yup.number().nullable().optional(),
  vwc: yup.number().nullable().optional()
});

const wirelessGasSensorSchema = yup
  .object({
    temperature: yup.number().nullable().optional(),
    airPressure: yup.number().nullable().optional(),
    humidity: yup.number().nullable().optional(),
    gasResistance: yup.number().nullable().optional(),
    airQualityIndex: yup.number().nullable().optional(),
    precisionTemperature: yup.number().nullable().optional()
  })
  .nullable()
  .optional();

// soilProbesConnected ships as a flat dict { teros12_1_connected: bool,
// teros12_2_connected: bool } — see _soil_probes_connected in routes.py:
// 92-108. Validated as a plain object so unknown future probe keys pass
// through unmolested.
const soilProbesConnectedSchema = yup
  .object({
    teros12_1_connected: yup.boolean().nullable().optional(),
    teros12_2_connected: yup.boolean().nullable().optional()
  })
  .nullable()
  .optional();

const wirelessSensorDetailSchema = yup.object({
  // Required identifier — the route returns 404 if the sensor doesn't
  // exist, so any successful response will populate this.
  externalSensorId: yup.string().required(),

  // 12-char lowercase hex MAC (no separators) — same resolution chain as
  // the list endpoint (see wirelessSensorListItemSchema's macAddress
  // comment above). Optional for the same reason — a sensor that hasn't
  // reported and doesn't have a WS-<MAC> external id will return null.
  macAddress: yup.string().nullable().optional(),

  label: yup.string().nullable().optional(),
  lastMeasurement: yup.string().nullable().optional(),

  location: wirelessSensorLocationSchema,
  battery: wirelessSensorBatterySchema,
  // soilSensors is always returned as a 2-element array (port 1, port 2)
  // — _soil_sensor_for_port runs for both ports unconditionally and
  // returns a sparse object when no probe is wired. Validated as a
  // plain array so we don't have to assume length here.
  soilSensors: yup.array().of(wirelessSoilSensorSchema).nullable().optional(),
  gasSensor: wirelessGasSensorSchema,
  lux: yup.number().nullable().optional(),
  rssi: yup.number().nullable().optional(),
  snr: yup.number().nullable().optional(),
  soilProbesConnected: soilProbesConnectedSchema
});

const wirelessSensorDetailResponseSchema = yup.object({
  success: yup.boolean().required(),
  sensor: wirelessSensorDetailSchema.required()
});

/**
 * Validate the shape of a /api/wireless-sensors/my-sensors response and
 * return the bare sensors array.
 *
 * Returning the unwrapped array (instead of the full envelope) lets the
 * hook return shape stay parallel with useMyDevices — the container
 * just gets `sensors: WirelessSensorListItem[]` and never has to know
 * the endpoint is wrapped. If the backend ever drops the envelope this
 * is the single line that changes.
 *
 * On success: returns the validated array.
 * On failure: throws a Yup ValidationError; SWR catches it and surfaces
 * via the fleet view's error state.
 */
export const validateSensorListResponse = async (data) => {
  const validated = await wirelessSensorListResponseSchema.validate(data, { abortEarly: true, stripUnknown: false });
  return validated.sensors;
};

/**
 * Validate the shape of a /api/wireless-sensors/{externalSensorId}
 * response and return the bare detail object.
 *
 * Same envelope-unwrap rationale as `validateSensorListResponse` — the
 * hook surface stays free of the `data.sensor` indirection. The
 * returned shape is the WirelessSensorDetail described above.
 */
export const validateSensorDetailResponse = async (data) => {
  const validated = await wirelessSensorDetailResponseSchema.validate(data, { abortEarly: true, stripUnknown: false });
  return validated.sensor;
};

export { wirelessSensorListItemSchema, wirelessSensorListResponseSchema, wirelessSensorDetailSchema, wirelessSensorDetailResponseSchema };
