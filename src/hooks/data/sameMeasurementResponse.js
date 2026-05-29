// =============================================================================
// sameMeasurementResponse — cheap structural-equality check for the
// time-series chart hooks (useDeviceMeasurements, useDeviceHealth,
// useWirelessSensorMeasurements, useMultiWirelessSensorMeasurements).
// =============================================================================
//
// Why this exists:
//
//   All four chart hooks pass a `compare` function to useSWR so that a
//   byte-identical 60s background poll doesn't kick a re-render through
//   the chart subtree. The previous implementation was:
//
//     compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
//
//   That's the cheapest deep-equality check in plain JS *to write*, but
//   it's the most expensive *to run* on these payloads. A "Last 5 years"
//   sensor_data response with daily buckets returns ~1,825 rows; each row
//   carries a JSONB measurements object that can be 30+ fields. Stringify-
//   ing both sides means walking every key of every row twice, allocating
//   hundreds of KB of strings, then string-comparing them. On the main
//   thread. Every 60 seconds.
//
//   For time-series sensor data we don't need a deep walk to know whether
//   two responses are the same. Sensor readings are immutable once
//   written, the backend echoes the request `from`/`to` envelope, and the
//   rows are sorted chronologically. So three constant-time checks give
//   us a strong identity signal:
//
//     1. Same envelope:   a.from === b.from && a.to === b.to
//     2. Same row count:  a.rows.length === b.rows.length
//     3. Same endpoints:  a.rows[0].time === b.rows[0].time
//                      && a.rows[last].time === b.rows[last].time
//
//   If all three pass, the responses are the same data; if any fails,
//   they're different. The check is O(1) regardless of payload size.
//
// Edge cases:
//
//   - Either side null/undefined → reference-equal only. Two undefineds
//     are equal; one undefined and one populated isn't. (SWR uses `===`
//     internally first, so this branch is only hit when at least one
//     side is a real response object.)
//
//   - Empty rows arrays → same envelope + zero rows on both sides is
//     equal. No first/last lookup needed.
//
//   - When could this give a false positive? Only if the backend returned
//     a response with the same envelope, same row count, and the same
//     first/last row times, but different intermediate values. For
//     append-only sensor data with bucket aggregation, that doesn't
//     happen: matching length + matching endpoint timestamps means the
//     same buckets means the same values. The risk would be if someone
//     re-aggregated historical data in place — at which point the cache
//     would be incorrect anyway and the user would need to refresh.
//
// =============================================================================

/**
 * Compare two single-source measurement responses ({rows, from, to}).
 *
 * @param {object|null|undefined} a
 * @param {object|null|undefined} b
 * @returns {boolean} true when the two responses represent the same data
 */
export function sameSingleMeasurementResponse(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.from !== b.from || a.to !== b.to) return false;
  const ar = a.rows;
  const br = b.rows;
  if (ar === br) return true;
  if (!ar || !br) return false;
  if (ar.length !== br.length) return false;
  if (ar.length === 0) return true;
  const lastIdx = ar.length - 1;
  return ar[0]?.time === br[0]?.time && ar[lastIdx]?.time === br[lastIdx]?.time;
}

/**
 * Compare two multi-sensor measurement responses — a record keyed by
 * sensor id whose values are either a single-source response or an
 * `{ __error }` sentinel from a per-sensor failure.
 *
 * Equality requires: same key set, and for every key, either both error
 * sentinels with the same `__error` value, or both single-source
 * responses that pass `sameSingleMeasurementResponse`.
 *
 * @param {Record<string, object>|null|undefined} a
 * @param {Record<string, object>|null|undefined} b
 * @returns {boolean}
 */
export function sameMultiMeasurementResponse(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in b)) return false;
    const av = a[k];
    const bv = b[k];
    const aErr = av?.__error;
    const bErr = bv?.__error;
    if (aErr || bErr) {
      // Error sentinels — compare the error reference. SWR's compare is
      // about "is this a re-render worth firing"; if the error shape
      // changed at all (different message, different code), the chart
      // layer should see it.
      if (aErr !== bErr) return false;
      continue;
    }
    if (!sameSingleMeasurementResponse(av, bv)) return false;
  }
  return true;
}
