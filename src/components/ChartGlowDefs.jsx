// =============================================================================
// ChartGlowDefs — shared SVG <filter> definitions for chart line glow.
// =============================================================================
//
// Why this is a shared component:
//
//   Multiple chart-rendering pages (sensor-measurements,
//   sensor-network, MeasurementsChartGrid) all use a colored glow
//   around their MUI x-charts line strokes. Implementing this as a
//   per-element CSS `drop-shadow(...)` makes the browser recompile
//   the filter for every line segment on every paint — measurable
//   render cost at high point counts.
//
//   A single <filter id="chart-glow-full"> defined in <defs> gets
//   compiled once by the browser and reused for every element that
//   references it via `filter: url(#chart-glow-full)`. Big paint-time
//   win at scale, and visually identical to drop-shadow at typical
//   blur radii.
//
//   This component owns the canonical filter ids. Any chart page that
//   wants the glow renders <ChartGlowDefs/> once at the top of its
//   tree, then writes `filter: var(--chart-glow-filter,
//   url(#chart-glow-full))` in its sx. The variable indirection lets
//   dense charts opt into the `chart-glow-lite` variant when point
//   density would otherwise make the full-radius glow overlap into
//   noise.
//
// Filter mechanics:
//
//   Both filters blur the SourceGraphic itself (the colored line
//   stroke) then `feMerge` the blurred copy underneath the original.
//   Result: glow inherits the line's stroke color automatically —
//   no per-color filter definitions needed, no flood-color
//   hardcoding. New chart colors work without any change here.
//
//   Filter region is widened 50% beyond the source bounding box so
//   the soft edges of the blur stay inside the clip region. Without
//   this you'd see hard cutoffs at the chart edges where SVG's
//   default 10% filter region clips the falloff.
//
// Mounting rule:
//
//   Each page that uses the glow renders this component ONCE inside
//   its top-level fragment. SVG filter ids resolve document-globally,
//   so a single mounted instance serves every chart on the page
//   (including chart subtrees that mount later, like an enlarged
//   chart Dialog). Two pages can never have it mounted at the same
//   time because they're on different routes.
//
//   `aria-hidden` + zero dimensions + position:absolute keeps the
//   element invisible and out of the accessibility tree.

export default function ChartGlowDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter id="chart-glow-full" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="chart-glow-lite" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
