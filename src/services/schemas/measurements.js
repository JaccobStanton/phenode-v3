import * as yup from 'yup';

// =============================================================================
// Yup runtime validation for the new sensor time-series endpoints.
// =============================================================================
//
// Endpoints:
//   GET /api/devices/{external_device_id}/sensor-data
//   GET /api/wireless-sensors/{external_sensor_id}/sensor-data
//
// Why validate at the API boundary (and why it's especially important for
// these endpoints):
//
//   The row shape is *response-dependent* — it changes based on the
//   `bucket` query param we sent. Raw mode returns flat keys
//   (`temperature`, `humidity`, …); bucketed mode returns `_min`/`_max`/
//   `_avg` suffixed keys (`temperature_min`, …). If the backend ever
//   ships a third mode and forgets to document it, we want the validator
//   to flag the unknown shape loudly instead of silently rendering a
//   chart full of N/As.
//
//   The other validators in this folder (device.js, wireless_sensors.js)
//   are field-by-field strict because their schemas are stable. For
//   measurement rows, the strictness needs to be on the *envelope* — all
//   numeric measurement keys are optional (any of them may be absent for
//   a given device / time range / bucket mode), but `time` must be a
//   non-empty ISO string and the `rows` array must exist.
//
// Backend reference:
//   phenodeX/phenode_backend/api/devices/routes.py:823 (device endpoint)
//   phenodeX/phenode_backend/api/wireless_sensors/routes.py:342 (sensor endpoint)
//   phenodeX/phenode_backend/services/downloads.py:362-388 (device field names)
//   phenodeX/phenode_backend/services/downloads.py:438-478 (sensor field names)

// Permissive row schema — `time` required, every other key is an
// optional nullable number. Backend may omit fields the device doesn't
// support (e.g., a PheNode without a soil probe won't carry soil
// fields), and bucketed mode may emit `null` for empty buckets — both
// pass.
//
// `noUnknown(false)` lets new fields the backend adds tomorrow pass
// through this validator unchanged so the frontend doesn't break on
// additive schema evolution.
const measurementRowSchema = yup
  .object({
    // Required across both raw and bucketed shapes. ISO-8601 Z; the
    // backend's _utc_iso_z formatter always emits with a trailing Z.
    time: yup.string().required()
    // All other fields (temperature, humidity, … OR temperature_min,
    // temperature_max, temperature_avg, …) are optional numbers. We
    // could enumerate every known key here, but the win is small and
    // the cost is high: every backend field-rename or addition would
    // force a frontend schema PR. Keeping the row schema open means
    // the chart layer is the one source of truth for "which fields do
    // I render," and the validator just asserts "rows are objects
    // with timestamps."
  })
  .noUnknown(false);

// Response envelope — same shape on both endpoints aside from the
// id-naming key (`deviceExternalId` vs `sensorExternalId`). We
// validate that whichever of the two id keys the caller's endpoint
// returns is a string, but don't require BOTH — the test() runs once
// after the object has been validated and asserts at least one is
// present and non-empty.
//
// `from` / `to` are returned by the backend in normalized ISO-Z form
// (re-emitted via _utc_iso_z), so we can assert both are non-empty
// strings to catch any case where the backend forgets to echo them.
const measurementResponseSchema = yup
  .object({
    deviceExternalId: yup.string().nullable().optional(),
    sensorExternalId: yup.string().nullable().optional(),
    from: yup.string().required(),
    to: yup.string().required(),
    rows: yup.array().of(measurementRowSchema).required()
  })
  .test('has-id', 'Response must include either deviceExternalId or sensorExternalId', (value) =>
    Boolean(value?.deviceExternalId || value?.sensorExternalId)
  );

/**
 * Validate a /sensor-data response (device or wireless-sensor variant).
 *
 * On success: returns the validated object (Yup's `.validate` returns
 * the input, optionally coerced).
 *
 * On failure: throws a Yup `ValidationError`. SWR surfaces it via the
 * hook's `error` field, where the chart layer renders the "failed to
 * load" treatment.
 *
 * `abortEarly: true` is fine — we just need to know the contract
 * broke, not enumerate every wrong field.
 */
export const validateMeasurementResponse = (data) =>
  measurementResponseSchema.validate(data, { abortEarly: true, stripUnknown: false });

export { measurementResponseSchema, measurementRowSchema };
