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
//     batteryPercent, soilMoisture, soilTemperatureC, rssi) are all
//     `.nullable().optional()` — a freshly provisioned sensor with
//     no measurements yet still validates, and the row transformer's
//     formatters render 'N/A' for missing values.
//   - Unknown keys pass through (default Yup behavior). The backend
//     can extend the response without breaking us.
//
// Backend reference:
//   phenodeX/phenode_backend/schemas/wireless_sensors.py:70-81
//     (WirelessSensorListItem, WirelessSensorsListResponse)
//   phenodeX/phenode_backend/api/wireless_sensors/routes.py:138-190
//     (route handler — health_status computed via 30-min cutoff to
//      match the device convention)

const wirelessSensorListItemSchema = yup.object({
  // Required identifiers — the backend always populates these.
  // `_id` is the pydantic alias for the integer DB id.
  _id: yup.number().required(),
  externalSensorId: yup.string().required(),

  // Optional metadata
  label: yup.string().nullable().optional(),

  // Optional summary fields — what the fleet view actually displays.
  // ISO 8601 datetime, omitted if the sensor has never reported.
  lastMeasurementAt: yup.string().nullable().optional(),
  // Computed server-side: "Live" if seen within 30 min, else "Offline".
  healthStatus: yup.string().nullable().optional(),
  batteryPercent: yup.number().nullable().optional(),
  soilMoisture: yup.number().nullable().optional(),
  soilTemperatureC: yup.number().nullable().optional(),
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

export { wirelessSensorListItemSchema, wirelessSensorListResponseSchema };
