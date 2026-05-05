# PheNodeV3 Refactor Report (4/29/26)

Implementation pass over the eight findings from the prior frontend audit. All
changes were limited to `phenodeV3/`. The production build (`vite build`)
completes cleanly after the refactor.

## 1. Centralized neon style tokens (Audit finding #3)

**What changed.** Added `src/themes/sx-tokens.js` exporting the shared `sx`
constants (`glassSurfaceSx`, `reflectedCardChromeSx`, `drfSurfaceSx`,
`chartSurfaceSx`, `neonControlSx`, `drawerNavButtonSurfaceSx`,
`orientationButtonSx`, `neonMenuPaperSx`, `neonMenuItemSx`) plus two new
slot-prop tokens — `tooltipSlotProps` and `neonSelectMenuPaperProps`.

**Where applied.** Replaced the duplicated declarations in eight section files
(`sensor-network`, `multi-sensor-graph`, `map-view`, `imaging`,
`system-diagnostics`, `sensor-measurements`, `data-downloads`,
`download-preferences`). The two fleet-overview pages keep a couple of local
variants intentionally — they use `--box-outline-blue` instead of
`--reflected-light` and a more saturated background, and de-duplication
happens at the component level (see #2).

**Impact.** Visual tweaks now flow from one file. Inline tooltip `slotProps`
objects that were rebuilt every render are now hoisted module-level constants,
so MUI's slot caching is preserved.

## 2. De-duplicated fleet-overview pages (Audit finding #2)

**What changed.** Both `fleet-overview.jsx` and `sensor-fleet-overview.jsx`
were 99% duplicate (~452 lines each). Extracted the shared UI into
`src/sections/fleet-overview/FleetOverviewView.jsx`. The two section files are
now thin wrappers (~16 lines each) that pass title, label, count, search
placeholder, and rows.

**Impact.** Bug fixes / design tweaks now happen once, not twice. The two
pages cannot drift again.

## 3. Mock data moved to `src/data/mocks/` (Audit finding #4a)

**What changed.** Created `src/data/mocks/` with:

- `fleet.js` — `phenodeFleetRows`, `sensorFleetRows`
- `time-ranges.js` — `timeRangeOptions`, `chartTimeLabels`
- `phenode-options.js` — `pheNodeSelectionOptions`, `sensorSelectionOptions`,
  `multiGraphSensorOptions`
- `sensor-measurements.js` — `sensorMeasurementCharts`, `soilProbeReadings`,
  `sensorInfoReadings`

**Where applied.** Updated `sensor-network`, `map-view`, `multi-sensor-graph`,
`system-diagnostics`, `sensor-measurements`, `data-downloads`, and the two
fleet pages to import from `data/mocks/*` instead of declaring local arrays.
Eliminated four-way duplication of `timeRangeOptions` and `chartTimeLabels`.

**Impact.** When the backend is wired up, the mock modules become the swap
target — no UI-file edits needed.

## 4. API services + data hooks (Audit finding #4b)

**What changed.** Mirrored phenodeX's pattern:

- `src/services/fetcher.js` — generic JSON fetcher (with SWR tuple-key
  support) plus `buildUrl(path)` honoring `VITE_API_URL`.
- `src/services/api.js` — typed surface (`fetchPhenodeFleet`,
  `fetchSensorFleet`, `fetchSensorMeasurementCharts`, `fetchSoilProbeReadings`,
  `fetchSensorInfo`) that today returns mock data wrapped in promises so
  consumers stay async-aware.
- `src/hooks/data/useFleet.js` — `useFleet('phenode' | 'sensor')` returning
  `{ data, isLoading, error }`.
- `src/hooks/data/useSensorMeasurements.js` — three hooks
  (`useSensorMeasurementCharts`, `useSensorInfo`, `useSoilProbeReadings`).

**Where applied.** Both fleet-overview wrappers now consume `useFleet` and
pass `isLoading` to the view. When the real API lands, only `services/api.js`
needs to change.

## 5. Split large section components (Audit finding #1)

**What changed.**

- Extracted the `SearchableMultiSelect` component (a multi-select Autocomplete
  with "Select All" affordance and the neon palette baked in) to
  `src/components/inputs/SearchableMultiSelect.jsx`. `multi-sensor-graph` was
  carrying a near-identical inline copy; the section now imports the shared
  component. Slot-prop and chip-styling objects are hoisted to module scope so
  the reference is stable.
- Extracted the small-multiples chart grid to
  `src/sections/wireless-sensors/MeasurementsChartGrid.jsx`. `sensor-network`
  was rendering a ~120-line inline grid every time; the file is now noticeably
  smaller and the chart grid can be reused on other pages later.
- Removed the now-unused imports and local style constants from
  `multi-sensor-graph` and `sensor-network` (`Autocomplete`, `Checkbox`,
  `TextField`, `LineChart`, `ZoomInOutlined`, `chartSurfaceSx`, `SELECT_ALL_LABEL`).

**What was deferred.** The audit's full sketch (orchestrator + 6+ subcomponents
per section file) is a multi-day project. The two highest-leverage extractions
above were taken; future work can chip away at it without changing public API.

## 6. Hoisted local hook to eliminate prop drilling (Audit finding #5)

**What changed.** Added `src/hooks/useInfoCard.js` returning `{ infoCardMode,
setInfoCardMode, selectedSoilProbe, setSelectedSoilProbe, isSoilDataMode,
toggleMode }`. `SensorNetwork` now uses the hook instead of four `useState`
calls.

**Cross-page selection.** Added `src/contexts/SelectionContext.jsx` exposing
`SelectionProvider` and `useSelection()` for `selectedPheNode`,
`selectedSensor`, and `timeRange`. It is opt-in — pages that still own their
own state continue to work — and it's ready to be wired in once two pages
need to share the "selected PheNode" identity.

## 7. Deleted dead / unused code (Audit finding #6)

**Removed:**

- `src/menu-items/page.jsx`
- `src/menu-items/imaging/imaging-tab.jsx`
- `src/menu-items/sensor-measurements/sensor-measurements-tab.jsx`
- `src/menu-items/system-diagnostics/system-diagnostics-tab.jsx`
- `src/menu-items/fleet-overview/fleet-overview-tab.jsx`
- `src/pages/fleet-overview/default.jsx`
- `src/pages/data-download/default.jsx`
- `src/pages/system-diagnostics/default.jsx`
- `src/components/cards/statistics/AnalyticEcommerce.jsx`
- `src/components/table/fixed-header.jsx`
- `src/components/third-party/react-table/{Filter,EmptyTable,TablePagination,CSVExport}.jsx`
- `src/reportWebVitals.js` (and its only caller in `index.jsx`)

**Not removed.** The audit also flagged `src/utils/colorUtils.js` — that one
is in fact imported by `palette.js`, `custom-shadows.jsx`, `IconButton.jsx`,
`SimpleBar.jsx`, and the Button/Tab theme overrides. Restored after the build
caught it. (The audit mis-flagged it; reporting honestly here.)

**Deferred.** The audit's optional cleanup of `src/api/menu.js` (replacing the
SWR-as-fake-API drawer toggle with a context-backed boolean) touches six
layout files and was left for a future PR.

## 8. Performance wins (Audit finding #7)

**What changed.**

- `system-diagnostics.jsx`: hoisted `signalBarHeights`, `sensorStatusCards`,
  `graphCards`, and `chartTimeLabels` from the function body to module scope.
  Removed the now-unused `useMemo` import.
- `sensor-network.jsx`: hoisted `diagramWidthSx` to module scope.
- All `Tooltip slotProps` and `Select MenuProps.PaperProps` objects across the
  app were collapsed onto the shared, hoisted `tooltipSlotProps` /
  `neonSelectMenuPaperProps` constants from `themes/sx-tokens.js`.

**Impact.** Sections no longer create a fresh literal object for tooltip /
menu styling on every render — MUI's slot caching now actually does its job.

## 9. Maintainability nits (Audit finding #8)

- **`package.json`** — renamed from the original template package name to
  `phenode-frontend`, version bumped to `0.1.0`, marked `private: true`,
  description added, and the upstream template's author/homepage block
  removed. Dropped two unused dependencies (`react-router` —
  `react-router-dom` is enough on v7 — and `web-vitals`, which was only
  used by the deleted `reportWebVitals`).
- **`useConfig.js`** — fixed the "must be use inside" → "must be used inside"
  typo in the thrown error.
- **`ConfigContext.jsx`** — renamed the `localStorage` key from
  `mantis-react-free-config` to `phenode-frontend-config`.
- **`AuthLogin.jsx`** — removed the demo email/password initial values
  shipped with the original template; the form now starts empty.
- **`index.jsx`** — removed the dangling CRA-era `reportWebVitals()` call.

## Build verification

`vite build` completes cleanly:

```
✓ built in 6.52s
```

The only build issue encountered was the colorUtils restore noted in #7,
which was fixed before this report was written.

## What was deliberately not done

- Folder casing (PascalCase `layout/Auth` / `layout/Dashboard` vs. kebab-case
  elsewhere) was left as-is. Renaming would break a lot of imports and is
  best handled in its own dedicated PR.
- Replacing `api/menu.js` (the SWR-as-fake-API drawer toggle) with a context.
  The audit marked this optional and it touches six layout files.
- Splitting `imaging.jsx`, `system-diagnostics.jsx`, and `data-downloads.jsx`
  into orchestrator + subcomponents. The most useful pieces
  (`SearchableMultiSelect`, `MeasurementsChartGrid`,
  `FleetOverviewView`) were extracted; the rest is incremental work that
  doesn't block the backend wiring.
