import * as yup from 'yup';

// =============================================================================
// Yup runtime validation for the /api/devices/my-devices response.
// =============================================================================
//
// Why validate at the API boundary instead of trusting backend types:
//
//   The backend can ship a breaking change (rename a field, drop a required
//   field, change a type) that compiles cleanly on its side and ours, then
//   silently corrupts the UI — `device.label` becomes undefined and we
//   render "siteName: ''" everywhere. By validating the response shape
//   here, that kind of drift fails LOUDLY: the hook throws, SWR puts the
//   error in `error`, and the fleet view shows a clear "failed to load"
//   instead of empty cards full of N/A.
//
//   This is one of those defenses you don't notice working until the day
//   it catches a backend rename in staging at 2am instead of in prod at
//   noon.
//
// What we validate vs. ignore:
//
//   - REQUIRED fields are required in Yup too. Missing/null on these is
//     a contract violation — fail.
//   - OPTIONAL/NULLABLE fields use `.nullable().optional()` so backend
//     either-omitting or sending null both pass.
//   - UNKNOWN keys pass through unmolested. Yup's default behavior is
//     additive-friendly, which means the backend can add new fields
//     without breaking us.
//
// Backend reference:
//   phenodeX/phenode_backend/schemas/devices.py:31-49 (DeviceRead)
//   phenodeX/phenode_backend/api/devices/routes.py:38 (response_model)

const assignedUserSchema = yup
  .object({
    id: yup.number().required(),
    email: yup.string().required(),
    full_name: yup.string().nullable().optional()
  })
  .nullable()
  .optional();

const wirelessSensorReadSchema = yup.object({
  id: yup.number().required(),
  external_sensor_id: yup.string().required(),
  label: yup.string().nullable().optional()
});

const deviceReadSchema = yup.object({
  // Required (per DeviceBase + DeviceRead — these are the fields the
  // backend will always populate, verified against devices.py:7-15 and
  // devices.py:31-37).
  id: yup.number().required(),
  external_device_id: yup.string().required(),
  created_at: yup.string().required(),
  updated_at: yup.string().required(),

  // Optional metadata
  label: yup.string().nullable().optional(),
  organization_id: yup.number().nullable().optional(),
  latitude: yup.number().nullable().optional(),
  longitude: yup.number().nullable().optional(),
  timezone: yup.string().nullable().optional(),
  health: yup.object().nullable().optional(),
  sensors: yup.array().nullable().optional(),
  fw_version: yup.string().nullable().optional(),
  hw_version: yup.string().nullable().optional(),

  // Optional summary fields — these are what the fleet view actually
  // displays. If they go missing the row degrades gracefully (the
  // transformer's formatters return 'N/A'), but their presence in
  // shape matters.
  last_measurement_at: yup.string().nullable().optional(),
  health_status: yup.string().nullable().optional(),
  temperature_c: yup.number().nullable().optional(),
  rainfall_mm_hr: yup.number().nullable().optional(),
  rainfall_today_mm: yup.number().nullable().optional(),
  wind_speed: yup.number().nullable().optional(),
  battery_percent: yup.number().nullable().optional(),

  assigned_user: assignedUserSchema,
  wireless_sensors: yup.array().of(wirelessSensorReadSchema).nullable().optional()
});

const deviceListSchema = yup.array().of(deviceReadSchema).required();

/**
 * Validate the shape of a /api/devices/my-devices response.
 *
 * On success: returns the validated array (Yup's `validate` returns
 * the input value, optionally coerced).
 * On failure: throws a Yup `ValidationError` whose message names the
 * offending field — surfaces nicely in SWR's `error` field.
 *
 * `abortEarly: true` is fine here: we just need to know the contract
 * is broken; we don't need a full inventory of every wrong field.
 */
export const validateDeviceListResponse = (data) => deviceListSchema.validate(data, { abortEarly: true, stripUnknown: false });

export { deviceReadSchema, deviceListSchema };
