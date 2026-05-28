// =============================================================================
// normalizeMeasurementRow — shared row normalizer for the measurement hooks.
// =============================================================================
//
// Both `useDeviceMeasurements` and `useWirelessSensorMeasurements` previously
// kept a hand-maintained allow-list of field names (`KNOWN_DEVICE_FIELDS` /
// `KNOWN_WIRELESS_SENSOR_FIELDS`) and silently dropped any key the list didn't
// mention. That is what caused the soil/lightning/secondary-temp regression
// after the backend added new extractors — the API ships the field, the hook
// throws it away.
//
// New rule: the backend's response is the source of truth. The frontend asks
// for specific fields via the `fields=` query-param projection; whatever the
// backend chooses to return for those fields is exactly what we surface to
// the chart layer. Adding a measurement end-to-end is now one change in
// `_DEVICE_FIELD_EXTRACTORS` / `_WIRELESS_FIELD_KEYS` server-side — no
// frontend mirror to update.
//
// Canonical row shape returned to the chart layer:
//
//   { time: string, fields: { <name>: { min, max, avg } } }
//
// Backend row shapes this collapses (the backend never mixes the two within a
// single response):
//
//   raw:      row[field]                          (flat numeric value)
//   bucketed: row[`${field}_min/_max/_avg`]       (suffixed numeric values)

// Row-level metadata keys that are NEVER measurement fields. Any other key
// (with or without a bucket suffix) is treated as a measurement value.
const ROW_METADATA_KEYS = new Set(['time', 'latitude', 'longitude']);

// Matches a bucket-suffixed key and captures the base field name.
// `temperature_avg` → base `temperature`; `wind_speed_min` → base `wind_speed`.
const BUCKET_SUFFIX_RE = /^(.+)_(min|max|avg)$/;

export function normalizeMeasurementRow(row) {
  const fields = {};
  const handledBases = new Set();

  // Pass 1: bucketed triples. We only emit the field when at least one of
  // min/max/avg is non-null — an all-null triple is an empty bucket, and
  // dropping it lets the chart layer iterate keys that actually have data
  // (no defensive null-checks scattered through every consumer).
  for (const key of Object.keys(row)) {
    if (ROW_METADATA_KEYS.has(key)) continue;
    const m = BUCKET_SUFFIX_RE.exec(key);
    if (!m) continue;
    const base = m[1];
    if (ROW_METADATA_KEYS.has(base)) continue; // e.g. a hypothetical `latitude_min` — guard anyway
    if (handledBases.has(base)) continue;
    handledBases.add(base);
    const min = row[`${base}_min`] ?? null;
    const max = row[`${base}_max`] ?? null;
    const avg = row[`${base}_avg`] ?? null;
    if (min === null && max === null && avg === null) continue;
    fields[base] = { min, max, avg };
  }

  // Pass 2: raw scalars — every remaining numeric key that isn't part of a
  // bucketed triple or row metadata. min === max === avg renders the chart's
  // area-fill (which expects all three) as a degenerate band that overlays
  // the line exactly — visually identical to a plain line, which is what the
  // raw mode should look like.
  for (const key of Object.keys(row)) {
    if (ROW_METADATA_KEYS.has(key)) continue;
    if (BUCKET_SUFFIX_RE.test(key)) continue;
    if (handledBases.has(key)) continue;
    const v = row[key];
    if (typeof v !== 'number') continue; // skip non-numeric (status strings, etc.) defensively
    fields[key] = { min: v, max: v, avg: v };
  }

  return { time: row.time, fields };
}
