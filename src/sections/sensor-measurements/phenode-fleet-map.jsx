import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, InfoWindow, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import AntIcon from 'components/AntIcon';
import AimOutlined from '@ant-design/icons-svg/lib/asn/AimOutlined';

import ConfirmRenameModal from 'components/ConfirmRenameModal';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import { useToast } from 'providers/ToastProvider';
import { glassSurfaceSx, reflectedCardChromeSx } from 'themes/sx-tokens';
import {
  formatBatteryPercent,
  formatLastMeasurement,
  formatTemperature,
  formatTodaysRainfall,
  formatWindSpeed
} from 'utils/transforms/device';

// =============================================================================
// PheNodeFleetMap — Google Maps view of the user's PheNode fleet plus the
// supporting PheNode-info and rename surfaces below it.
// =============================================================================
//
// Renders three stacked sections:
//
//   1. THE MAP — Google Maps embed (via @vis.gl/react-google-maps). One pin
//      per PheNode that has both `latitude` and `longitude` on its DeviceRead.
//      Clicking a pin invokes `onSelectDevice(externalDeviceId)`, which the
//      page wires to its URL-driven device selection (`handlePhenodeChange`).
//
//   2. PHENODE INFORMATION CARD — the active PheNode's identifying readings
//      derived directly from its DeviceRead: external_device_id, latitude,
//      longitude, last_measurement_at, battery_percent, and the count of
//      paired wireless sensors. Each value uses the existing project
//      formatters (formatLastMeasurement, formatBatteryPercent) so the
//      vocabulary matches what users see elsewhere in the dashboard
//      ("Never" for an un-reported device, "N/A" for missing battery, etc.).
//
//   3. RENAME CARD — TextField + button for renaming the active PheNode.
//      Visual only for V1, matching the placeholder's behavior.
//
// MAP STYLING — two toggleable visual modes (neon is the default):
//
//   - "neon" (default) → mapTypeId="roadmap" + `styles={NEON_MAP_STYLE}`.
//     Dark navy roadmap with neon-teal labels and roads, hiding POIs and
//     transit. Matches the dashboard's neon-on-navy aesthetic. The custom
//     toggle buttons (top-right) wear the project's neon chrome.
//   - "satellite"      → mapTypeId="hybrid", no custom styles. Real
//     satellite imagery with road/place labels. The custom toggle buttons
//     revert to Google's default white-chip styling so they read as
//     foreign UI against Google's tiles — a deliberate choice to match the
//     ToS-mandated bottom-right attribution's appearance, which we can't
//     restyle (Google Maps Platform ToS forbid altering attribution).
//
// Google's satellite/hybrid tiles can't be restyled (their ToS prohibits
// it), so the neon style necessarily switches the base type to `roadmap`.
//
// MARKER PULSE — two markers per device:
//
//   - A "halo" marker underneath whose scale + opacity animate via
//     setInterval to produce an expanding-and-fading radar-pulse ring.
//   - A "core" marker on top: solid teal (or orange when selected) circle
//     with a stroke, representing the device location itself. Static, so
//     clicks land on a stable target.
//
//   Why not <AdvancedMarker> + CSS animation: AdvancedMarker requires a
//   Map ID to be provisioned, and Map IDs flip the map to vector mode,
//   which DISABLES the `styles` array that powers our neon mode. We'd
//   have to choose: CSS-pulse OR inline neon styles. The two-marker +
//   setInterval approach gives us both at the cost of a small JS tick
//   loop. If we later provision a Map ID and configure neon via cloud-
//   based styles, this can be migrated to <AdvancedMarker> with proper
//   CSS animation in a single-file change.
//
// Failure modes handled for the map block (per
// feedback_showcase_pages_surface_assumptions — components are responsible
// for their own defensive defaults):
//   - VITE_APP_GOOGLE_MAPS_API_KEY missing/blank  → "Map unavailable" card
//   - `devices` still loading                     → spinner card
//   - Fleet is empty                              → "No PheNodes" card
//   - Every device is missing lat or lng          → "No location data" card
//   - Some devices missing lat/lng                → plot the rest, surface
//                                                   a small "N hidden" badge
//
// Backend contract: `latitude` and `longitude` on DeviceRead are sanitized
// server-side (Null-Island, NaN, out-of-range coords return null). So any
// non-null pair received here is safe to pass directly to Google Maps.

const API_KEY = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY;

// Geographic center of the contiguous US — only ever visible to a user
// for the brief moment between map mount and FitBoundsController's first
// run.
const FALLBACK_CENTER = { lat: 39.8283, lng: -98.5795 };
const FALLBACK_ZOOM = 4;

// Zoom level for a fleet of exactly one device. fitBounds() doesn't behave
// usefully with a degenerate single-point bounding box, so we set zoom
// explicitly.
const SINGLE_DEVICE_ZOOM = 14;

// Closer zoom applied when the user double-clicks anywhere on the
// map (including on a pin). Lets them shortcut past the default
// fleet-wide zoom without using the +/- controls.
const PIN_DBLCLICK_ZOOM = 17;

// Map area responsive heights. Bumped over the placeholder's values so the
// map has more vertical real estate — users want to see geographic context,
// not a sliver.
const MAP_HEIGHT_SX = { xs: 320, sm: 400, md: 460, lg: 510 };

// SVG path for a circle centered at origin. Hand-written rather than using
// `google.maps.SymbolPath.CIRCLE` because that enum needs the Maps library
// loaded at icon-definition time, which would force us to construct icons
// inside an effect — unnecessary complexity for a static shape.
const CIRCLE_PATH = 'M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0';

// Solid "core" marker — the device's actual location indicator. Static
// (doesn't pulse). The blue stroke gives a project-themed ring around the
// teal fill, matching the page's blue+teal palette.
const CORE_UNSELECTED_ICON = {
  path: CIRCLE_PATH,
  scale: 0.9, // small enough to read as a precise location dot, not a blob
  fillColor: '#48f7f5', // var(--green) — neon teal
  fillOpacity: 1,
  strokeColor: '#1a75e0', // var(--blue) — slim themed ring
  strokeWeight: 2.5,
  strokeOpacity: 0.9
};

// Selected core uses INVERTED colors of the unselected: blue fill with a
// teal stroke, larger overall. Both palettes (teal #48f7f5 and blue
// #1a75e0) come from the project's CSS variables, so selection swaps
// roles between the two without leaving the green/blue color space.
const CORE_SELECTED_ICON = {
  path: CIRCLE_PATH,
  scale: 1.4, // ~55% larger than unselected so selection is unambiguous
  fillColor: '#1a75e0', // var(--blue) — inverted from unselected
  fillOpacity: 1,
  strokeColor: '#48f7f5', // var(--green) — bright teal ring on the selected pin
  strokeWeight: 2.5
};

// Halo base config. Animates in usePulse: `scale` grows from this value
// up to (base + grow), while `fillOpacity` fades to near zero, producing
// a radar-pulse effect underneath the static core marker. Scaled down to
// match the smaller core pins.
const HALO_BASE_SCALE = 1.05;
const HALO_BASE_OPACITY = 0.55;
const HALO_GROW = 1.8; // additive growth across one pulse cycle

// Both halo colors stay inside the project's green/blue palette. The halo
// is the inverted color of the core it surrounds: an unselected device
// (teal core) gets a blue halo, and a selected device (blue core) gets a
// teal halo. The contrast makes both states pulse distinctly without
// either leaving the green/blue color space.
const HALO_UNSELECTED_FILL = '#1a75e0'; // var(--blue) — under teal cores
const HALO_SELECTED_FILL = '#48f7f5'; // var(--green) — under blue cores

// Neon-on-navy roadmap style for the "neon" toggle. Applies to the roadmap
// base only (Google doesn't allow restyling satellite imagery). Palette
// chosen to match the rest of the dashboard's CSS variables.
const NEON_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#001a44' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#001a44' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#48f7f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#48f7f5' }, { weight: 0.6 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#1a75e0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#48f7f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#002a66' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#001a44' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#48f7f5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#003a8a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#48f7f5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000a1f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#48f7f5' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#001633' }] }
];

// Google Maps ControlPosition enum value for the right edge anchored to the
// bottom. Hardcoded as the numeric constant (rather than
// `google.maps.ControlPosition.RIGHT_BOTTOM`) because the enum is only
// available after the Maps library loads, which would force us to build
// the option objects inside an effect. The enum has been stable for years
// and is documented at:
//   https://developers.google.com/maps/documentation/javascript/reference/control#ControlPosition
const RIGHT_BOTTOM_POSITION = 9;

// Themed CSS for Google's own controls (fullscreen, zoom buttons). Applied
// conditionally — only in NEON mode (see the outer Box sx below). In
// satellite mode the controls render with Google's default white-chip
// styling so they sit naturally alongside the bottom-right attribution
// (which we can't restyle per Google Maps Platform's ToS, and any attempt
// to do so puts the API key at risk of suspension).
//
// Selectors target Google's stable class names. They've been consistent
// for years but are technically Google-owned; if Google rebrands these,
// the controls will revert to default styling (not break the map).
// Build the map's CSS-override sx in one shot, with selector keys merged
// rather than spread across two constants. The earlier attempt split
// these into GOOGLE_CONTROL_THEME_SX (neon-only) + INFO_WINDOW_LAYOUT_SX
// (always) and spread both — but object spread is shallow, so when both
// constants defined rules under the SAME selector key (e.g.
// '& .gm-style-iw'), the second spread completely overwrote the first.
// That silently dropped the InfoWindow background-color rule in neon
// mode, making the hover card render with Google's default white speech
// bubble. Doing the merge per-selector here avoids the footgun.
//
// Always-applied (both modes):
//   - InfoWindow padding / max-width zeroed so the React Box inside is
//     the only thing controlling the card's geometry.
//   - Google's auto-rendered close-X hidden (hover open/close make it
//     redundant, and it also caused a small left-right asymmetry in the
//     content area).
//
// Neon-only (skipped in satellite, where Google's defaults read well
// next to the un-styleable ToS-protected attribution):
//   - Fullscreen / zoom controls get the dark navy chip treatment +
//     neon-teal-tinted icons.
//   - InfoWindow chrome gets the dark navy background, reflected-light
//     border, and matching tip color so it visually integrates with the
//     rest of the dashboard.
function buildMapControlsSx(isNeon) {
  return {
    '& .gm-style-iw, & .gm-style-iw-c': {
      padding: '0 !important',
      maxWidth: 'none !important',
      ...(isNeon
        ? {
            backgroundColor: 'rgba(0, 17, 48, 0.94) !important',
            border: '1px solid var(--reflected-light) !important',
            boxShadow: '0 11px 19px 1px #0000002e !important'
          }
        : {})
    },
    '& .gm-style-iw-d': {
      overflow: 'visible !important',
      padding: '0 !important',
      ...(isNeon ? { backgroundColor: 'transparent !important' } : {})
    },
    '& .gm-style-iw button.gm-ui-hover-effect': {
      display: 'none !important'
    },
    ...(isNeon
      ? {
          '& .gm-fullscreen-control, & .gm-bundled-control button, & .gm-style-mtc-bbw button': {
            backgroundColor: 'rgba(0, 17, 48, 0.86) !important',
            border: '1px solid var(--reflected-light) !important',
            borderRadius: '4px !important',
            boxShadow: '0 11px 19px 1px #0000002e !important'
          },
          // Tint the icons inside the controls (fullscreen arrows, +/-
          // zoom glyphs) to read as neon teal against the dark backing.
          // Filters are blunt but Google ships the icons as raster
          // <img>s without exposing CSS color hooks.
          '& .gm-fullscreen-control img, & .gm-bundled-control img': {
            filter: 'invert(0.85) sepia(1) saturate(8) hue-rotate(140deg) brightness(1.4)'
          },
          '& .gm-style-iw-tc::after': {
            background: 'rgba(0, 17, 48, 0.94) !important'
          }
        }
      : {})
  };
}

// =============================================================================
// PROXIMITY FEATURE — constants + helpers
// =============================================================================
//
// One toggle, four coordinated effects. When the user clicks the "Nearby"
// button in the map chrome:
//   (1) A translucent circle is drawn around the selected device.
//   (2) Pins outside the radius dim to PROXIMITY_DIM_OPACITY so the
//       in-radius cluster reads at a glance.
//   (3) The camera fits to the selected + nearby pins ONCE on toggle-on
//       (then user pan/zoom is preserved — see ProximityFitController).
//   (4) A "Nearby PheNodes" card slides in under the info+rename grid
//       listing the neighbors sorted by distance, each clickable.
//
// Radius is fixed at 10 miles for V1. The constant lives here so making
// it configurable later means swapping this for a state-driven value and
// adding a small selector — no surgery on the rendering code.

const PROXIMITY_RADIUS_MILES = 10;
const PROXIMITY_RADIUS_METERS = PROXIMITY_RADIUS_MILES * 1609.344;

// Page size for the "Nearby PheNodes" card. When the neighbor list has
// more than this many entries, a pagination control appears below the
// grid and the list shows one page at a time. Below the threshold the
// full list renders without pagination so short lists don't add the
// extra control chrome unnecessarily.
const NEARBY_PAGE_SIZE = 27;

// Themed pagination sx — mirror of paginationSx in
// sections/fleet-overview/FleetOverviewView.jsx so the Nearby card's
// pager reads as the same control vocabulary the fleet-list tables
// use. Duplicated rather than imported because the two surfaces don't
// share a common dependency and the rule set is small enough that
// extracting it into a shared module would be more friction than the
// duplication. If a third pager ever lands, hoist into themes/.
const nearbyPaginationSx = {
  '& .MuiPaginationItem-root': {
    color: 'var(--blue)',
    border: '1px solid var(--reflected-light)',
    backgroundColor: 'rgba(0, 17, 48, 0.03)',
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
    boxShadow: '0 11px 19px 1px #0000002e',
    transition: 'color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease',
    '&:hover': {
      color: 'var(--green)',
      borderColor: 'var(--green)',
      backgroundColor: 'rgba(72, 247, 245, 0.08)'
    }
  },
  '& .MuiPaginationItem-root.Mui-selected': {
    color: 'var(--green)',
    borderColor: 'var(--green)',
    backgroundColor: 'rgba(72, 247, 245, 0.15)',
    '&:hover': {
      backgroundColor: 'rgba(72, 247, 245, 0.22)'
    }
  },
  '& .MuiPaginationItem-ellipsis': {
    color: 'var(--blue)',
    border: 'none',
    backgroundColor: 'transparent',
    boxShadow: 'none'
  }
};

// Opacity for pins outside the proximity radius. Low enough that they
// visually recede behind the in-radius cluster, high enough that they're
// still legible if the user wants to see the whole fleet at a glance.
const PROXIMITY_DIM_OPACITY = 0.18;

// Solid background for the floating map controls (title overlay,
// Proximity button, Neon/Satellite toggle). Matches the visual weight of
// the page-level "Map" toggle button above the map by being fully opaque
// — not the see-through glass surface used elsewhere in the page chrome.
// Two variants because the floating controls need to read well over both
// the dark neon map AND the satellite imagery; mid-opacity glass that
// looked fine over the neon map would disappear over a bright satellite
// background.
const FLOAT_CHIP_NEON_SX = {
  // Fully opaque (no alpha) so the chip never reads as see-through over
  // the underlying map. Solid hex rather than rgba(..., 1) keeps the
  // intent explicit at a glance.
  backgroundColor: '#000d29',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};
const FLOAT_CHIP_SATELLITE_SX = {
  backgroundColor: '#ffffff',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

// Format a decimal lat/lng pair as "dd.dddd°N, dd.dddd°W" with
// hemisphere indicators. Used by the hover-summary InfoWindow's GPS
// footer — compact + readable. Returns '—' for missing inputs so the
// caller doesn't need a null check around the call site.
function formatLatLngWithHemisphere(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '—';
  const latHemi = lat >= 0 ? 'N' : 'S';
  const lngHemi = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latHemi}, ${Math.abs(lng).toFixed(4)}°${lngHemi}`;
}

// Predicate for "this device can be plotted." Lat/lng are nullable in the
// schema (a freshly-provisioned PheNode that's never reported has neither).
// We require BOTH because plotting with only one is meaningless.
function hasValidLocation(device) {
  return typeof device?.latitude === 'number' && typeof device?.longitude === 'number';
}

// Great-circle distance between two lat/lng pairs in miles, via the
// haversine formula. Used by the proximity feature to (a) filter the
// fleet to "within N miles of the selected device" and (b) sort the
// resulting list nearest-first.
//
// We use a sphere approximation rather than Vincenty (which accounts for
// Earth's oblateness). At PheNode-fleet scales (typically tens to hundreds
// of miles), haversine's worst-case error is ~0.5% — far smaller than
// the precision of consumer GPS fixes, which is what we're measuring
// against. No external dependency, no API call, no projection setup.
function haversineDistanceMiles(lat1, lng1, lat2, lng2) {
  const EARTH_RADIUS_MILES = 3958.8;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

// Imperative Google Maps Circle overlay for the proximity feature.
//
// Rendered only when proximity is active and a device is selected. Built
// once per (lat, lng, radius, themed) signature, torn down on unmount /
// any of those changing. Primitive props rather than an object so the
// effect doesn't recreate the circle on every render due to fresh
// {lat, lng} object identity.
//
// clickable: false ensures the circle never intercepts pin clicks —
// users should be able to click any pin inside the radius without the
// overlay swallowing the event.
function ProximityCircle({ lat, lng, radiusMeters, themed }) {
  const map = useMap();
  const maps = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !maps || lat == null || lng == null) return undefined;
    // Satellite tiles vary in color (greens, browns, blues) so we use a
    // saturated amber that pops against every base imagery type. The
    // neon mode keeps teal because the dark navy roadmap is uniform and
    // a teal stroke reads as "in-theme."
    const isSatellite = themed === 'satellite';
    const strokeColor = isSatellite ? '#fdd835' : '#48f7f5';
    const circle = new maps.Circle({
      strokeColor,
      // Bump opacity + weight in satellite so the line punches through
      // varied imagery; neon's uniform dark base lets us stay subtle.
      strokeOpacity: isSatellite ? 0.95 : 0.65,
      strokeWeight: isSatellite ? 2.5 : 1.5,
      fillColor: strokeColor,
      fillOpacity: isSatellite ? 0.12 : 0.08,
      map,
      center: { lat, lng },
      radius: radiusMeters,
      clickable: false
    });
    return () => circle.setMap(null);
  }, [map, maps, lat, lng, radiusMeters, themed]);

  return null;
}

// One-shot camera fit when proximity is first turned ON. After the
// initial fit the user is free to pan/zoom; we don't refit on every
// neighbor-list change because that would yank them around constantly
// as they explore. Tracks `active`'s previous value with a ref so the
// fit fires exactly once per off→on transition.
function ProximityFitController({ active, lat, lng, neighborCoords }) {
  const map = useMap();
  // 'core' library — see the FitBoundsController comment for why this
  // is 'core' and not 'maps'.
  const core = useMapsLibrary('core');
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (!map || !core) return;
    const justActivated = active && !wasActiveRef.current;
    wasActiveRef.current = active;
    if (!justActivated) return;
    if (lat == null || lng == null) return;
    const bounds = new core.LatLngBounds();
    bounds.extend({ lat, lng });
    neighborCoords.forEach((c) => bounds.extend(c));
    // If there are no neighbors, the bounds is just the single point —
    // fitBounds on a degenerate bounding box stays at minZoom, so set
    // an explicit zoom in that case for usable scale.
    if (neighborCoords.length === 0) {
      map.setCenter({ lat, lng });
      map.setZoom(SINGLE_DEVICE_ZOOM);
    } else {
      map.fitBounds(bounds, 80);
    }
  }, [active, map, core, lat, lng, neighborCoords]);

  return null;
}

// Project the active DeviceRead into the {label, value} shape the info-card
// grid renders. Each row degrades gracefully when the underlying field is
// missing — '—' for unset coordinates / identifiers, the formatters'
// "Never" / "N/A" for absent measurement metadata. This means a freshly
// provisioned device with no readings yet still produces a sane card
// without conditional rendering at the call site.
//
// Coordinates are rendered to 5 decimal places (~1 meter precision at the
// equator). That's enough for "here's where the device sits" without
// implying false precision from the server's raw floats.
//
// Field choices vs. the original mock:
//   - "Sensor ID"        → "Device ID"          (PheNode vocabulary)
//   - "GPS"              → split into "Latitude" + "Longitude" (per user feedback)
//   - "Altitude"         → dropped — not on the DeviceRead schema. Replaced
//                          with "Last Seen" (formatLastMeasurement) which
//                          is the more useful "is this device alive" signal.
//   - "Battery"          → unchanged label, real `battery_percent` value
//   - "Probes Connected" → "Wireless Sensors" — closer to the actual data
//                          (DeviceRead.wireless_sensors is the array of
//                          paired wireless devices, of which soil probes
//                          are one category).
// `timezone` (IANA zone string or null/undefined for browser-local) is
// passed through so the "Last Seen" row renders in the user's saved
// Display preference timezone, matching the fleet cards.
function buildPheNodeReadings(device, timezone) {
  return [
    { label: 'Device ID:', value: device?.external_device_id ?? '—' },
    { label: 'Latitude:', value: typeof device?.latitude === 'number' ? device.latitude.toFixed(5) : '—' },
    { label: 'Longitude:', value: typeof device?.longitude === 'number' ? device.longitude.toFixed(5) : '—' },
    { label: 'Last Seen:', value: formatLastMeasurement(device?.last_measurement_at, timezone) },
    { label: 'Battery:', value: formatBatteryPercent(device?.battery_percent) },
    { label: 'Wireless Sensors:', value: device?.wireless_sensors?.length ?? 0 }
  ];
}

// usePulse — returns a value in [0, 1) that loops monotonically over `period`
// ms. Drives the halo marker's scale + opacity animation.
//
// Throttled to ~20fps via setInterval rather than RAF. Two reasons:
//   1. Marker setIcon calls are expensive (each one reaches into Google's
//      imperative API and triggers an internal redraw). 60fps × 2N markers
//      becomes wasteful for fleets of any size. 20fps is plenty smooth
//      for a slow breathing pulse.
//   2. setInterval pauses naturally when the tab is backgrounded, which is
//      the right behavior for a "this is alive" affordance.
function usePulse(period = 1500, fps = 20) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const intervalMs = 1000 / fps;
    const step = intervalMs / period;
    const id = setInterval(() => {
      setT((prev) => (prev + step) % 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [period, fps]);
  return t;
}

// PulsingHalos — renders the breathing halo rings in ISOLATION so the
// ~20fps usePulse state update re-renders ONLY this leaf, not the whole map
// (APIProvider, <Map>, every core marker, the InfoWindow). That per-frame
// re-render of the entire tree was the cause of the map "flashing /
// reloading". `targets` is a stable array the parent memoizes WITHOUT the
// pulse value: `{ key, lat, lng, fill, zIndex }` per halo.
function PulsingHalos({ targets }) {
  const pulseT = usePulse();
  if (!targets.length) return null;
  const scale = HALO_BASE_SCALE + pulseT * HALO_GROW;
  const fillOpacity = HALO_BASE_OPACITY * (1 - pulseT);
  return (
    <>
      {targets.map((t) => (
        <Marker
          key={t.key}
          position={{ lat: t.lat, lng: t.lng }}
          clickable={false}
          zIndex={t.zIndex}
          icon={{
            path: CIRCLE_PATH,
            scale,
            fillColor: t.fill,
            fillOpacity,
            strokeColor: t.fill,
            strokeOpacity: fillOpacity * 0.6,
            strokeWeight: 1
          }}
        />
      ))}
    </>
  );
}

// Camera controller for "follow the selected device." Pans the map to
// whatever PheNode is currently selected, but ONLY when the selection
// actually changes (not on every render — the pulse animation re-renders
// this component ~20 times per second, and we can't pan that often).
//
// The first run is skipped so the FitBoundsController gets to set up the
// initial fleet view before we yank the camera onto a single device.
// Subsequent selection changes (dropdown picks, deep links, pin clicks
// from elsewhere in the page) pan smoothly via map.panTo(). We preserve
// the user's current zoom level deliberately — they may have zoomed out
// to see the fleet, and forcing a zoom-in on every selection would be
// disorienting.
function SelectionCameraController({ devices, selectedDeviceId }) {
  const map = useMap();
  const previousIdRef = useRef(undefined);

  useEffect(() => {
    if (!map) return;
    // First run — let FitBoundsController do its thing. Record current
    // id as the baseline so subsequent changes trigger a pan.
    if (previousIdRef.current === undefined) {
      previousIdRef.current = selectedDeviceId;
      return;
    }
    if (selectedDeviceId === previousIdRef.current) return;
    previousIdRef.current = selectedDeviceId;

    if (!selectedDeviceId) return;
    const selected = devices?.find((d) => d.external_device_id === selectedDeviceId);
    if (!selected || !hasValidLocation(selected)) return;

    // panTo (not setCenter) — animated transition, preserves zoom.
    map.panTo({ lat: selected.latitude, lng: selected.longitude });
  }, [map, devices, selectedDeviceId]);

  return null;
}

// Imperative fit-to-bounds controller. Sits inside <Map> so it can use the
// map instance via useMap(). Refits only on count changes — never on every
// render — so user pan/zoom isn't yanked back to the fleet bounds.
function FitBoundsController({ plottable }) {
  const map = useMap();
  // LatLngBounds lives in Google Maps' 'core' library, NOT 'maps'. The
  // 'maps' library exports Map/Circle/Polyline/etc.; 'core' exports
  // LatLng/LatLngBounds/Size/Point. Loading the wrong one returns a
  // module without LatLngBounds, so `new x.LatLngBounds()` throws
  // "not a constructor" at runtime — easy mistake because the legacy
  // google.maps namespace was flat.
  const core = useMapsLibrary('core');
  const lastFitCountRef = useRef(0);

  useEffect(() => {
    if (!map || !core) return;
    if (!plottable.length) return;
    if (plottable.length === lastFitCountRef.current) return;

    if (plottable.length === 1) {
      const d = plottable[0];
      map.setCenter({ lat: d.latitude, lng: d.longitude });
      map.setZoom(SINGLE_DEVICE_ZOOM);
    } else {
      const bounds = new core.LatLngBounds();
      plottable.forEach((d) => bounds.extend({ lat: d.latitude, lng: d.longitude }));
      map.fitBounds(bounds, 60);
    }
    lastFitCountRef.current = plottable.length;
  }, [map, core, plottable]);

  return null;
}

// Shared chrome for the four non-map states (error, loading, empty fleet,
// no-location fleet). Keeps the map frame's outer dimensions consistent
// so the parent layout doesn't reflow when switching between states.
function MessageCard({ children, isError }) {
  return (
    <Box
      sx={{
        // width:100% so the empty/loading state fills the column the same way
        // the live map does — without it the card collapses to less than full
        // width inside the flex/grid parent.
        width: '100%',
        height: MAP_HEIGHT_SX,
        borderRadius: 1,
        border: '1px solid var(--reflected-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...glassSurfaceSx,
        ...reflectedCardChromeSx
      }}
    >
      <Typography
        variant={isError ? 'subtitle1' : 'body1'}
        sx={{
          color: isError ? 'var(--orange)' : 'var(--blue)',
          fontStyle: isError ? 'normal' : 'italic',
          textAlign: 'center',
          px: 2,
          maxWidth: '80%'
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

export default function PheNodeFleetMap({ devices, selectedDeviceId, onSelectDevice, activeDevice, onRename, isLoading }) {
  // mapStyleMode controls which visual mode the map renders in. Defaults
  // to 'neon' per the user's preference. The Satellite/Neon toggle in the
  // top-right of the map flips it.
  const [mapStyleMode, setMapStyleMode] = useState('neon');

  // Rename flow — mirrors the pattern used by FleetOverviewView so the
  // map's rename behaves identically to the fleet card's rename:
  //
  //   renameInput      — TextField's current value (controlled input)
  //   pendingRename    — `null` when no modal is open; otherwise
  //                      `{externalId, oldName, newName}` carrying
  //                      everything ConfirmRenameModal needs. Setting
  //                      this opens the modal; clearing it closes the
  //                      modal. Single piece of state means we can never
  //                      land in a half-open state where open=true but
  //                      no name to render.
  //
  // toast — used to surface the same success / error toasts the fleet
  // overview shows after a rename, so the affordance reads identically
  // across the two pages.
  const [renameInput, setRenameInput] = useState('');
  const [pendingRename, setPendingRename] = useState(null);
  const toast = useToast();
  // Display preferences — drives the hover-tooltip's Temperature /
  // Rainfall / Wind formatting so the map info card honors the user's
  // saved units the same way the fleet cards do.
  const { tempUnit, speedUnit, rainUnit, timezone } = useDisplayPreferences();

  // ID of the device currently under the user's mouse, or null. Drives
  // the themed hover tooltip (InfoWindow) — set from each core marker's
  // onMouseOver, cleared on onMouseOut. Tracking by external_device_id
  // (not by index or by object reference) keeps the lookup stable across
  // SWR refreshes that produce new device-object references.
  const [hoveredDeviceId, setHoveredDeviceId] = useState(null);

  // Map-level dblclick handler for double-click-to-zoom. Pans the
  // camera to the click position and zooms in past the default
  // fleet-fit zoom — fires for double-clicks anywhere on the map,
  // including over a pin (Google's marker layer doesn't swallow the
  // map's dblclick).
  const handleMapDblclick = (event) => {
    const latLng = event?.detail?.latLng ?? event?.latLng;
    if (!latLng) return;
    const map = event?.map;
    if (!map) return;
    map.panTo(latLng);
    const z = map.getZoom() ?? 0;
    if (z < PIN_DBLCLICK_ZOOM) map.setZoom(PIN_DBLCLICK_ZOOM);
  };

  // Proximity feature toggle. When ON, the four-effect hybrid kicks in:
  // radius circle + dim faraway pins + one-shot camera fit + neighbor list.
  // See the PROXIMITY FEATURE block above for the design rationale.
  const [proximityEnabled, setProximityEnabled] = useState(false);

  // Memoize the plottable subset. The fit-bounds controller depends on a
  // stable reference for its count comparison.
  const plottable = useMemo(() => (devices ?? []).filter(hasValidLocation), [devices]);

  // Derive the info-card readings from the active device. Memoized on the
  // device reference so the .map() below doesn't iterate fresh objects on
  // every pulse-driven re-render (~20×/sec).
  const pheNodeReadings = useMemo(() => buildPheNodeReadings(activeDevice, timezone), [activeDevice, timezone]);

  // Resolve the hovered id back to the underlying DeviceRead. Null when
  // nothing is hovered or when the hovered id doesn't match a plottable
  // device (e.g. SWR refresh removed the device between hover and lookup).
  const hoveredDevice = useMemo(() => {
    if (!hoveredDeviceId) return null;
    return plottable.find((d) => d.external_device_id === hoveredDeviceId) ?? null;
  }, [hoveredDeviceId, plottable]);

  // Neighbors of the active device, within PROXIMITY_RADIUS_MILES, sorted
  // nearest-first. Each entry carries the device reference + computed
  // distance so the list rendering can show "0.8 mi" alongside the label.
  // Returns [] when proximity is off, no device is selected, or the
  // selected device has no coordinates.
  // Pagination state for the "Nearby PheNodes" card. 1-indexed. Reset
  // to 1 whenever the underlying neighbor list shifts (active device
  // change, proximity toggle, fleet change), so the user doesn't get
  // stranded on page 4 of a list that just shrank to one page.
  const [nearbyCurrentPage, setNearbyCurrentPage] = useState(1);

  const nearbyDevices = useMemo(() => {
    if (!proximityEnabled || !activeDevice || !hasValidLocation(activeDevice)) return [];
    return plottable
      .filter((d) => d.external_device_id !== activeDevice.external_device_id)
      .map((d) => ({
        device: d,
        distance: haversineDistanceMiles(activeDevice.latitude, activeDevice.longitude, d.latitude, d.longitude)
      }))
      .filter((entry) => entry.distance <= PROXIMITY_RADIUS_MILES)
      .sort((a, b) => a.distance - b.distance);
  }, [proximityEnabled, activeDevice, plottable]);

  // Pagination derived values. totalPages capped at 1 so the math is
  // safe even with an empty nearbyDevices array (avoids "Math.ceil(0)
  // = 0" producing a totalPages of 0, which Pagination doesn't accept).
  // pagedNearbyDevices is the slice for the current page.
  const nearbyTotalPages = Math.max(1, Math.ceil(nearbyDevices.length / NEARBY_PAGE_SIZE));
  const pagedNearbyDevices = useMemo(() => {
    const start = (nearbyCurrentPage - 1) * NEARBY_PAGE_SIZE;
    return nearbyDevices.slice(start, start + NEARBY_PAGE_SIZE);
  }, [nearbyDevices, nearbyCurrentPage]);

  // Reset the page back to 1 whenever the underlying list size shifts.
  // A user on page 3 who picks a different active device would
  // otherwise land on an empty page 3 of the new (typically smaller)
  // neighbor list. Same UX guard FleetOverviewView uses for its own
  // pagination + search/filter changes.
  useEffect(() => {
    setNearbyCurrentPage(1);
  }, [nearbyDevices.length]);

  // Set of ids that should remain at full opacity when proximity is on:
  // the active device itself + everything within radius. Built as a Set
  // so the per-marker `nearbyIds.has(...)` check below is O(1) — important
  // because the marker render runs every pulse tick (~20×/sec).
  const nearbyIds = useMemo(() => {
    const ids = new Set(nearbyDevices.map((entry) => entry.device.external_device_id));
    if (activeDevice) ids.add(activeDevice.external_device_id);
    return ids;
  }, [nearbyDevices, activeDevice]);

  // Stable {lat, lng}[] for ProximityFitController. Memoized so the
  // controller's effect deps only change when neighbor positions
  // actually change, not on every pulse re-render.
  const neighborCoords = useMemo(
    () => nearbyDevices.map((entry) => ({ lat: entry.device.latitude, lng: entry.device.longitude })),
    [nearbyDevices]
  );

  // Halo targets — which pins get a pulsing ring, computed WITHOUT the pulse
  // value so this list stays referentially stable across animation frames
  // (the breathing is applied inside <PulsingHalos>). Declared above the
  // loading/empty early-returns so hook order stays stable. Mirrors the
  // marker visibility rule in the render: with Nearby OFF only the selected
  // device renders; with it ON, every in-radius ("emphasized") device does.
  const haloTargets = useMemo(() => {
    const out = [];
    for (const d of plottable) {
      const isSelected = d.external_device_id === selectedDeviceId;
      if (!isSelected && !proximityEnabled) continue;
      const isEmphasized = !proximityEnabled || nearbyIds.has(d.external_device_id);
      if (!isEmphasized) continue;
      out.push({
        key: d.external_device_id,
        lat: d.latitude,
        lng: d.longitude,
        fill: isSelected ? HALO_SELECTED_FILL : HALO_UNSELECTED_FILL,
        zIndex: isSelected ? 998 : 0
      });
    }
    return out;
  }, [plottable, selectedDeviceId, proximityEnabled, nearbyIds]);

  // Display label for the active device — mirrors deviceReadToFleetRow's
  // siteName logic (prefer user-set label, fall back to immutable
  // external_device_id, then a generic fallback) so the rename modal
  // shows the same name the rest of the UI uses for this device. Without
  // this, a freshly provisioned device with no label would render
  // "undefined" in the modal's "Rename this PheNode from:" line.
  const activeDeviceDisplayName = activeDevice?.label || activeDevice?.external_device_id || 'Unnamed device';

  // Open the confirmation modal when the user clicks Rename (or presses
  // Enter in the input). Mirrors EditableLabel's validation: silently
  // no-op on empty or unchanged input rather than opening a modal the
  // user would just immediately cancel.
  const handleRenameClick = () => {
    if (!activeDevice || !onRename) return;
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    if (trimmed === activeDeviceDisplayName) return;
    setPendingRename({
      externalId: activeDevice.external_device_id,
      oldName: activeDeviceDisplayName,
      newName: trimmed
    });
  };

  // ConfirmRenameModal's Continue handler — same shape as
  // FleetOverviewView.handleConfirmRename:
  //   - Success: success toast naming the new label, close the modal,
  //     clear the input so the field is ready for the next rename.
  //   - Error: surface backend `detail` if present, otherwise the
  //     generic "Failed to rename PheNode" string. Modal stays open so
  //     the user can retry without re-typing.
  const handleConfirmRename = async () => {
    if (!pendingRename || !onRename) return;
    const { externalId, newName } = pendingRename;
    try {
      await onRename(externalId, newName);
      toast.success(`'${newName}' renamed successfully`);
      setPendingRename(null);
      setRenameInput('');
    } catch (err) {
      const backendMessage = typeof err?.detail === 'string' ? err.detail : null;
      const fallback = 'Failed to rename PheNode';
      toast.error(backendMessage ? `${fallback}: ${backendMessage}` : fallback);
      // Intentionally do NOT clear pendingRename — modal stays open for
      // retry. ConfirmRenameModal resets its own isSubmitting in its
      // finally block, so Continue re-enables and the user can click again.
    }
  };

  const totalCount = devices?.length ?? 0;
  const plottableCount = plottable.length;
  const hiddenCount = totalCount - plottableCount;

  // ── Defensive default branches ──────────────────────────────────────────

  if (!API_KEY) {
    return (
      <MessageCard isError>Map unavailable — VITE_APP_GOOGLE_MAPS_API_KEY is not configured. Please contact an administrator.</MessageCard>
    );
  }

  if (isLoading) {
    return (
      <MessageCard>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} sx={{ color: 'var(--green)' }} />
          <Box component="span">Loading fleet…</Box>
        </Stack>
      </MessageCard>
    );
  }

  if (totalCount === 0) {
    return <MessageCard>Connect a PheNode to your account to view it on the map.</MessageCard>;
  }

  if (plottableCount === 0) {
    return (
      <MessageCard>
        No location data available for any PheNode in this fleet. Set coordinates from the device-detail view to see a device on the map.
      </MessageCard>
    );
  }

  // ── Toggle styling — themed (neon) vs Google's default (satellite) ─────
  //
  // In neon mode the Satellite/Neon toggle wears the dashboard's neon
  // chrome so it visually integrates with the styled map underneath. In
  // satellite mode it adopts Google's white-chip default look so it sits
  // naturally alongside Google's own attribution at the bottom-right.
  //
  // Position is NOT in here — both the Satellite/Neon toggle and the
  // Proximity button share a wrapping <Stack> with absolute positioning,
  // so the buttons stack horizontally in the top-right of the map.
  const toggleSx =
    mapStyleMode === 'neon'
      ? {
          '& .MuiToggleButtonGroup-grouped': {
            border: '1px solid var(--reflected-light) !important',
            color: 'var(--blue)',
            // Fully solid navy — no rgba alpha — so neither the base nor
            // selected state lets the map show through. The selected
            // state below uses a backgroundImage overlay for the teal
            // tint rather than a translucent backgroundColor.
            backgroundColor: '#000d29',
            boxShadow: '0 11px 19px 1px #0000002e',
            textTransform: 'none',
            fontSize: '0.72rem',
            fontWeight: 600,
            px: 1.25,
            py: 0.4
          },
          // Explicit hover for the UNSELECTED button. Without this MUI
          // applies its default ToggleButton hover (a translucent
          // theme-colored rgba overlay) on top of the solid navy bg,
          // which then reads as see-through over the map. Same fix
          // pattern as the Nearby button: keep the solid backgroundColor
          // and overlay the hover hint via backgroundImage so opacity
          // stays at 1 throughout.
          '& .MuiToggleButtonGroup-grouped:hover': {
            backgroundColor: '#000d29 !important',
            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.08), rgba(72, 247, 245, 0.08)) !important'
          },
          '& .Mui-selected': {
            color: 'var(--green) !important',
            // Solid bg stays — the teal "active" cue is delivered by
            // (a) the green text + glow text-shadow and (b) a constant
            // translucent overlay applied via backgroundImage. The
            // overlay sits ON TOP of the solid navy bg so there's no
            // see-through to the map.
            backgroundColor: '#000d29 !important',
            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.22), rgba(72, 247, 245, 0.22)) !important',
            textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
          },
          // Selected-and-hovered — slightly brighter teal overlay so
          // hover is still felt on top of the already-tinted active state.
          '& .Mui-selected:hover': {
            backgroundColor: '#000d29 !important',
            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.32), rgba(72, 247, 245, 0.32)) !important'
          }
        }
      : {
          '& .MuiToggleButtonGroup-grouped': {
            border: 'none !important',
            color: '#444 !important',
            backgroundColor: '#ffffff !important',
            textTransform: 'none',
            fontSize: '0.72rem',
            fontWeight: 500,
            px: 1.25,
            py: 0.4,
            boxShadow: '0 11px 19px 1px #0000002e'
          },
          // Satellite-mode hover — same opaque-bg pattern, just with
          // the off-white Google-default chip aesthetic. f5f5f5 is a
          // subtle one-step darker than #ffffff, giving the hover cue
          // without alpha letting the map show through.
          '& .MuiToggleButtonGroup-grouped:hover': {
            backgroundColor: '#f5f5f5 !important'
          },
          '& .Mui-selected': {
            color: '#000 !important',
            backgroundColor: '#f0f0f0 !important'
          },
          '& .Mui-selected:hover': {
            backgroundColor: '#e8e8e8 !important'
          }
        };

  // Proximity (Nearby) button sx — same conditional-theming pattern as
  // toggleSx. The button is a single standalone ToggleButton so its
  // `selected` state drives the active styling. Disabled-looking but
  // not actually disabled when no device is selected (mirrors the
  // intentional always-clickable Rename button); the click no-ops
  // silently in that case.
  const proximityButtonSx =
    mapStyleMode === 'neon'
      ? {
          border: '1px solid var(--reflected-light) !important',
          color: 'var(--blue)',
          // Solid navy bg — no rgba alpha — so the button never reads as
          // see-through. Selected state below adds a translucent overlay
          // ON TOP via backgroundImage instead of swapping in a
          // translucent backgroundColor (which would expose the map
          // underneath).
          backgroundColor: '#000d29',
          boxShadow: '0 11px 19px 1px #0000002e',
          textTransform: 'none',
          fontSize: '0.72rem',
          fontWeight: 600,
          px: 1.25,
          py: 0.4,
          gap: 0.5,
          borderRadius: 1,
          // Explicit hover state for the UNSELECTED button. Without it,
          // MUI's default ToggleButton hover repaints with a theme-
          // colored translucent rgba overlay, which on top of our solid
          // navy makes the button read as see-through. We keep the
          // solid bg and overlay a faint teal via backgroundImage so
          // hover is visually communicated without breaking opacity.
          '&:hover': {
            backgroundColor: '#000d29 !important',
            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.08), rgba(72, 247, 245, 0.08)) !important'
          },
          '&.Mui-selected': {
            color: 'var(--green) !important',
            backgroundColor: '#000d29 !important',
            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.22), rgba(72, 247, 245, 0.22)) !important',
            textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
          },
          '&.Mui-selected:hover': {
            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.32), rgba(72, 247, 245, 0.32)) !important'
          }
        }
      : {
          border: 'none !important',
          color: '#444 !important',
          backgroundColor: '#ffffff !important',
          textTransform: 'none',
          fontSize: '0.72rem',
          fontWeight: 500,
          px: 1.25,
          py: 0.4,
          gap: 0.5,
          borderRadius: 1,
          boxShadow: '0 11px 19px 1px #0000002e',
          '&:hover': {
            backgroundColor: '#f5f5f5 !important'
          },
          '&.Mui-selected': {
            color: '#000 !important',
            backgroundColor: '#f0f0f0 !important'
          }
        };

  // ── Happy path: render the full stack (map block + info card + rename) ──

  return (
    <>
      <Stack spacing={2.5}>
        {/* ── Map block ──────────────────────────────────────────────────── */}
        <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: MAP_HEIGHT_SX,
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid var(--reflected-light)',
              // Conditional theming — the themed dark navy + neon-teal look
              // Single merged builder — neon-conditional color rules
              // and always-applied layout rules sharing the same
              // selector keys, so neither half overwrites the other.
              ...buildMapControlsSx(mapStyleMode === 'neon')
            }}
          >
            <APIProvider apiKey={API_KEY}>
              <Map
                mapTypeId={mapStyleMode === 'satellite' ? 'hybrid' : 'roadmap'}
                styles={mapStyleMode === 'neon' ? NEON_MAP_STYLE : undefined}
                defaultCenter={FALLBACK_CENTER}
                defaultZoom={FALLBACK_ZOOM}
                // Tilt fully disabled. Setting tilt={0} pins the initial
                // angle flat, and rotateControl={false} hides Google's
                // rotate/tilt compass UI. Together these eliminate the
                // tilt feature entirely — there's no in-view affordance
                // for it and the camera can't acquire a nonzero tilt.
                tilt={0}
                rotateControl={false}
                // gestureHandling="cooperative" — on touch devices, requires
                // a two-finger gesture to pan the map. Prevents single-finger
                // touches from trapping the page scroll inside the map.
                gestureHandling="cooperative"
                // We expose our own Satellite/Neon toggle (top-right), so hide
                // Google's built-in Map/Satellite/Terrain selector — two
                // controls fighting over the same corner would be confusing.
                mapTypeControl={false}
                // Fullscreen control moved to the right-edge anchored to the
                // bottom (RIGHT_BOTTOM = 9) so it stacks with the zoom +/-
                // controls there, leaving the top-right clear for our
                // Satellite/Neon toggle. Theming kicks in only in neon mode
                // via the conditional GOOGLE_CONTROL_THEME_SX above.
                fullscreenControl
                fullscreenControlOptions={{ position: RIGHT_BOTTOM_POSITION }}
                // Pin the zoom controls to the same position so fullscreen
                // and zoom sit together as one bottom-right control stack
                // rather than drifting apart at different viewport widths
                // (Google's defaults move zoom around on smaller screens).
                zoomControlOptions={{ position: RIGHT_BOTTOM_POSITION }}
                streetViewControl={false}
                disableDoubleClickZoom
                onDblclick={handleMapDblclick}
              >
                <FitBoundsController plottable={plottable} />
                <SelectionCameraController devices={devices} selectedDeviceId={selectedDeviceId} />
                {proximityEnabled && activeDevice && hasValidLocation(activeDevice) && (
                  <>
                    <ProximityCircle
                      lat={activeDevice.latitude}
                      lng={activeDevice.longitude}
                      radiusMeters={PROXIMITY_RADIUS_METERS}
                      themed={mapStyleMode}
                    />
                    <ProximityFitController
                      active={proximityEnabled}
                      lat={activeDevice.latitude}
                      lng={activeDevice.longitude}
                      neighborCoords={neighborCoords}
                    />
                  </>
                )}
                {/* Pulsing halos render in isolation so the per-frame
                    animation doesn't re-render the whole map. */}
                <PulsingHalos targets={haloTargets} />
                {plottable.map((d) => {
                  const isSelected = d.external_device_id === selectedDeviceId;
                  // Visibility rule: a pin renders if it's
                  //   (a) the CURRENTLY-SELECTED PheNode (always
                  //       visible — both as the visual anchor and
                  //       so the camera-pan lands on a pin, not
                  //       empty space), OR
                  //   (b) inside the proximity radius when Nearby is on.
                  // Otherwise hidden — keeps the default view focused
                  // on the device the user is actively looking at.
                  if (!isSelected && !proximityEnabled) return null;
                  // Visual emphasis = selection. The selected pin gets
                  // the larger inverted-color CORE_SELECTED_ICON; everything
                  // else renders at normal size with the standard teal+blue
                  // unselected styling. (The pulsing halo itself is rendered
                  // separately by <PulsingHalos> so the animation doesn't
                  // re-render this whole marker layer.)
                  // When proximity is on, dim everything outside the radius.
                  // The selected device and any in-radius neighbor stay at
                  // full emphasis.
                  const isEmphasized = !proximityEnabled || nearbyIds.has(d.external_device_id);
                  const baseCoreIcon = isSelected ? CORE_SELECTED_ICON : CORE_UNSELECTED_ICON;
                  const coreIcon = isEmphasized
                    ? baseCoreIcon
                    : {
                        ...baseCoreIcon,
                        fillOpacity: PROXIMITY_DIM_OPACITY,
                        strokeOpacity: PROXIMITY_DIM_OPACITY * 0.8
                      };
                  return (
                    <Fragment key={d.external_device_id}>
                      {/*
                      Core — static. The actual device location indicator.
                      Larger zIndex so it sits on top of its halo and on
                      top of neighboring devices' halos.

                      onMouseOver / onMouseOut drive the themed hover
                      tooltip (the <InfoWindow> rendered below). We
                      deliberately don't set `title` here — the native
                      browser tooltip and our themed InfoWindow would
                      open simultaneously, fighting each other for
                      attention. The themed bubble is what the user
                      should see.
                    */}
                      <Marker
                        position={{ lat: d.latitude, lng: d.longitude }}
                        icon={coreIcon}
                        zIndex={isSelected ? 999 : 1}
                        onClick={() => onSelectDevice?.(d.external_device_id)}
                        onMouseOver={() => setHoveredDeviceId(d.external_device_id)}
                        onMouseOut={() => setHoveredDeviceId((prev) => (prev === d.external_device_id ? null : prev))}
                      />
                    </Fragment>
                  );
                })}

                {/*
                Themed hover tooltip — a single <InfoWindow> positioned
                at the hovered device's lat/lng. Open whenever a core
                marker reports onMouseOver; closed on onMouseOut. The
                inner React content is theme-conditional (neon = teal
                text on dark navy; satellite = dark text matching
                Google's default chrome). The OUTER speech-bubble chrome
                is themed via the .gm-style-iw* selectors inside
                GOOGLE_CONTROL_THEME_SX, which only applies in neon
                mode — in satellite mode Google's default white bubble
                shows through, matching the surrounding attribution.

                headerDisabled=true removes the title row Google would
                otherwise render. shouldFocus=false prevents the
                InfoWindow from stealing keyboard focus on every hover.
                pixelOffset=[0,-8] nudges the bubble slightly above the
                marker so the tip points cleanly at the pin's center.
                disableAutoPan=true keeps the camera still — without
                it, hovering a marker near the map edge would yank the
                view to keep the InfoWindow visible.
              */}
                {hoveredDevice && (
                  <InfoWindow
                    position={{ lat: hoveredDevice.latitude, lng: hoveredDevice.longitude }}
                    pixelOffset={[0, -8]}
                    headerDisabled
                    shouldFocus={false}
                    disableAutoPan
                  >
                    {/*
                      Rich hover summary — header (device label + a
                      "PheNode" tag) + 4-metric grid (Temperature /
                      Rainfall / Wind / Battery) + GPS footer. Modeled
                      on the sensor info card the user supplied as a
                      reference, with PheNode-appropriate metrics drawn
                      from DeviceRead via the existing project
                      formatters (so vocabulary matches the rest of the
                      dashboard: "N/A" for missing values, °F for
                      temperature, etc.).

                      Mode-conditional theming, applied to every text
                      node here:
                        - neon      → teal labels, amber values, on the
                                      dark navy InfoWindow surface that
                                      GOOGLE_CONTROL_THEME_SX paints.
                        - satellite → dark labels and values on
                                      Google's default white bubble.
                    */}
                    {/*
                      maxWidth caps the bubble so the device-label header
                      inside truncates with an ellipsis instead of the
                      whole InfoWindow growing wide. The Typography
                      already carries the truncation styles + a title
                      attribute for hover-to-see-full.
                    */}
                    <Box sx={{ px: 1.5, py: 1, minWidth: 180, maxWidth: 240 }}>
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          mb: 0.75,
                          pb: 0.5,
                          borderBottom: mapStyleMode === 'neon' ? '1px solid var(--reflected-light)' : '1px solid rgba(0,0,0,0.08)'
                        }}
                      >
                        <Typography
                          title={hoveredDevice.label || hoveredDevice.external_device_id}
                          sx={
                            mapStyleMode === 'neon'
                              ? {
                                  // Header label uses var(--purple)
                                  // (#8955e2) — same purple defined in
                                  // assets/style.css. Differentiates
                                  // the card's "title" from the metric-
                                  // row labels below (which are blue)
                                  // and the values (which are green).
                                  color: 'var(--purple)',
                                  fontWeight: 700,
                                  fontSize: '0.95rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  minWidth: 0
                                }
                              : {
                                  color: '#1a1a1a',
                                  fontWeight: 700,
                                  fontSize: '0.95rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  minWidth: 0
                                }
                          }
                        >
                          {hoveredDevice.label || hoveredDevice.external_device_id}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={
                            mapStyleMode === 'neon'
                              ? { color: 'var(--blue)', fontSize: '0.65rem', flexShrink: 0, letterSpacing: '0.04em' }
                              : { color: '#666', fontSize: '0.65rem', flexShrink: 0, letterSpacing: '0.04em' }
                          }
                        >
                          PheNode
                        </Typography>
                      </Stack>
                      {/*
                        Metric grid — auto-width label column on the
                        left, flex-1 value column right-aligned. The
                        two-column grid keeps every value vertically
                        aligned regardless of label width variation.
                      */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          columnGap: 1.5,
                          rowGap: 0.4,
                          mb: 0.75
                        }}
                      >
                        {[
                          ['Temperature:', formatTemperature(hoveredDevice.temperature_c, tempUnit)],
                          ['Rainfall:', formatTodaysRainfall(hoveredDevice.rainfall_today_mm, rainUnit)],
                          ['Wind:', formatWindSpeed(hoveredDevice.wind_speed, speedUnit)],
                          ['Battery:', formatBatteryPercent(hoveredDevice.battery_percent)]
                        ].map(([label, value]) => (
                          <Fragment key={label}>
                            <Typography
                              sx={
                                mapStyleMode === 'neon'
                                  ? // Labels (left column) are blue to
                                    // match the info card's reading-row
                                    // label color. The value column to
                                    // the right keeps the green-glow.
                                    { color: 'var(--blue)', fontSize: '0.78rem', fontWeight: 600 }
                                  : { color: '#444', fontSize: '0.78rem', fontWeight: 500 }
                              }
                            >
                              {label}
                            </Typography>
                            <Typography
                              sx={
                                mapStyleMode === 'neon'
                                  ? {
                                      // Matches the .info-card-green-text
                                      // treatment used by the PheNode
                                      // Information card readings — teal
                                      // value with a soft blue-tinted
                                      // glow. Keeps the hover summary in
                                      // the same visual vocabulary as the
                                      // rest of the dashboard.
                                      color: 'var(--green)',
                                      textShadow: '0 1px 9px #1a75e0c9',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      textAlign: 'right',
                                      minWidth: 0,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }
                                  : {
                                      color: '#1a1a1a',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      textAlign: 'right',
                                      minWidth: 0,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }
                              }
                            >
                              {value}
                            </Typography>
                          </Fragment>
                        ))}
                      </Box>
                      {/*
                        GPS footer — visually separated from the metric
                        grid by a hairline rule. Compact (one line) and
                        always shown: hoveredDevice only exists for
                        devices that already passed hasValidLocation,
                        so coordinates are guaranteed numbers here.
                      */}
                      <Box
                        sx={{
                          pt: 0.5,
                          borderTop: mapStyleMode === 'neon' ? '1px solid var(--reflected-light)' : '1px solid rgba(0,0,0,0.08)'
                        }}
                      >
                        <Typography
                          sx={
                            mapStyleMode === 'neon'
                              ? {
                                  color: 'var(--green)',
                                  textShadow: '0 1px 9px #1a75e0c9',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  textAlign: 'center',
                                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                                }
                              : {
                                  color: '#555',
                                  fontSize: '0.72rem',
                                  fontWeight: 500,
                                  textAlign: 'center',
                                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                                }
                          }
                        >
                          {formatLatLngWithHemisphere(hoveredDevice.latitude, hoveredDevice.longitude)}
                        </Typography>
                      </Box>
                    </Box>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>

            {/* Title overlay — top-left. Uses the solid FLOAT_CHIP_*_SX
              styles in both modes so the chip never goes "see-through"
              over the underlying map (which can be dark navy in neon or
              varied satellite imagery). Matches the visual weight of the
              page-level Map toggle button above this map area. */}
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                px: 1.25,
                py: 0.5,
                borderRadius: 1,
                zIndex: 2,
                ...(mapStyleMode === 'neon' ? FLOAT_CHIP_NEON_SX : FLOAT_CHIP_SATELLITE_SX)
              }}
            >
              <Typography
                variant="subtitle2"
                sx={
                  mapStyleMode === 'neon'
                    ? { color: 'var(--green)', textShadow: '0 0 6px rgba(72, 247, 245, 0.5)' }
                    : { color: '#444', fontWeight: 500 }
                }
              >
                PheNode Fleet Map
              </Typography>
            </Box>

            {/* Top-right control cluster — Proximity toggle (left) and the
                Satellite/Neon mode toggle (right). Both buttons share the
                same conditional theming pattern: themed neon chrome in
                neon mode, Google-default white chips in satellite mode.
                Wrapped in a Stack with absolute positioning so the two
                buttons sit as one row in the corner. */}
            <Stack direction="row" spacing={0.75} sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2, alignItems: 'center' }}>
              {/* Proximity (Nearby) toggle — single standalone
                  ToggleButton because its semantics are on/off, not
                  pick-one-of-many. Clicking when no device is selected
                  is intentionally a no-op (handled in the click handler)
                  so the button never reads as "disabled / broken" — same
                  pattern the Rename button uses. */}
              <ToggleButton
                size="small"
                value="proximity"
                selected={proximityEnabled}
                onChange={() => {
                  // Require an active device + valid coords. Otherwise
                  // no-op silently — same affordance pattern as Rename.
                  if (!activeDevice || !hasValidLocation(activeDevice)) return;
                  setProximityEnabled((prev) => !prev);
                }}
                aria-label={proximityEnabled ? 'Hide nearby PheNodes' : 'Show nearby PheNodes'}
                sx={proximityButtonSx}
              >
                <AntIcon icon={AimOutlined} style={{ fontSize: 13 }} />
                <Box component="span">Nearby</Box>
              </ToggleButton>

              <ToggleButtonGroup
                exclusive
                value={mapStyleMode}
                onChange={(_, next) => {
                  // ToggleButtonGroup emits null when the user clicks the
                  // already-selected option. Guard so we never end up with
                  // mapStyleMode === null (which would render a broken map).
                  if (next) setMapStyleMode(next);
                }}
                size="small"
                sx={toggleSx}
              >
                <ToggleButton value="neon">Neon</ToggleButton>
                <ToggleButton value="satellite">Satellite</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {/* "N of M hidden" badge — only renders when some devices lack
              coordinates. Anchored to the bottom-left of the map.
              `bottom` is bumped above Google's "Google" wordmark (which
              also sits bottom-left and is ToS-protected — we can't move
              or restyle it) so the two don't overlap.
              Theming follows the same neon/satellite split the rest of
              the map chrome uses: neon mode wears the dashboard's dark
              navy + reflected-light border; satellite mode adopts the
              white-chip Google-default look so it sits naturally
              alongside Google's own wordmark and attribution. */}
            {hiddenCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  // Clear the "Google" wordmark in the bottom-left. The
                  // wordmark is ~14px tall + a few px of padding; 36
                  // leaves a visible gap so the badge reads as separate
                  // chrome rather than colliding with the attribution.
                  bottom: 36,
                  left: 12,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  zIndex: 2,
                  pointerEvents: 'none',
                  ...(mapStyleMode === 'neon'
                    ? {
                        backgroundColor: 'rgba(0, 17, 48, 0.86)',
                        border: '1px solid var(--reflected-light)'
                      }
                    : {
                        backgroundColor: '#ffffff',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)'
                      })
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: mapStyleMode === 'neon' ? 'var(--blue)' : '#444', fontWeight: mapStyleMode === 'neon' ? 400 : 500 }}
                >
                  {hiddenCount} of {totalCount} PheNode{totalCount === 1 ? '' : 's'} hidden — no location data
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* ── PheNode Information + Rename grid ──────────────────────────
          Info card gets 8/12, rename gets 4/12 (was 7/5). Shifting one
          column from rename → info gives each reading cell enough
          horizontal room to render the full localized date string from
          formatLastMeasurement() without triggering the ellipsis-
          truncation that kicks in when the value can't fit. Rename only
          needs space for an input + a 132px button, so 4/12 is plenty. */}
        <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
          <Grid size={{ xs: 12, lg: 8 }} sx={{ display: 'flex' }}>
            <Box
              sx={{
                borderRadius: 1,
                p: { xs: 1.5, sm: 2 },
                width: '100%',
                ...glassSurfaceSx,
                ...reflectedCardChromeSx,
                '& .info-card-green-text': {
                  color: 'var(--green)',
                  textShadow: '0 1px 9px #1a75e0c9'
                }
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ color: '#646cff' }}>
                  PheNode Information:
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
                }}
              >
                {pheNodeReadings.map((reading) => (
                  <Box
                    key={reading.label}
                    sx={{
                      border: '1px solid var(--reflected-light)',
                      borderRadius: 1,
                      p: 1,
                      backgroundColor: 'rgba(0, 20, 61, 0.38)',
                      // overflow:hidden on the cell itself is the belt-and-
                      // suspenders guard: even if a child somehow escapes its
                      // truncation, the cell clips it instead of pushing the
                      // grid track wider than minmax(0,1fr) intends.
                      overflow: 'hidden'
                    }}
                  >
                    {/*
                    minWidth: 0 on the flex container is required so the
                    value child can actually shrink below its intrinsic
                    text width. Without it, flexbox respects min-content
                    and refuses to let the text truncate — the cell would
                    just grow horizontally to fit.
                  */}
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          color: 'var(--blue)',
                          fontWeight: 600,
                          // The label side stays fixed-width. flexShrink:0
                          // keeps short labels ("Last Seen", "Battery") from
                          // ever being the thing that gets truncated — the
                          // value is always the one to clip when space is
                          // tight, which is what users expect.
                          flexShrink: 0
                        }}
                      >
                        {reading.label}
                      </Typography>
                      <Typography
                        className="info-card-green-text"
                        variant="body1"
                        // Native browser tooltip on hover — when a value gets
                        // ellipsis-truncated (e.g. a verbose date string from
                        // formatLastMeasurement), the user can hover to see
                        // it in full. Coerced to a string so numeric values
                        // (Wireless Sensors count) render their `title` too.
                        title={String(reading.value)}
                        sx={{
                          textAlign: 'right',
                          fontWeight: 600,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {reading.value}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }} sx={{ display: 'flex' }}>
            <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, width: '100%', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
              <Stack spacing={1.6} sx={{ height: '100%', justifyContent: 'center' }}>
                <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                  Rename this PheNode:
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter new PheNode name"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    // Enter-to-submit for keyboard parity with the fleet
                    // card's EditableLabel rename — pressing Enter inside
                    // the input is the same as clicking the Rename button.
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRenameClick();
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        minHeight: 40,
                        color: 'var(--blue)',
                        backgroundColor: '#00143642',
                        borderStyle: 'none none solid',
                        borderWidth: '1px 1px 2px',
                        borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
                        boxShadow: 'inset 1px 4px 5px #0003',
                        borderRadius: 1,
                        '&:hover:not(.Mui-disabled)': {
                          borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light) !important',
                          boxShadow: 'inset 1px 4px 5px #0003'
                        },
                        '&.Mui-focused': {
                          borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light) !important',
                          boxShadow: 'inset 1px 4px 5px #0003'
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          border: 'none'
                        }
                      },
                      '& .MuiInputBase-input': {
                        color: 'var(--blue)',
                        textAlign: 'left',
                        '&::placeholder': {
                          color: 'var(--blue)',
                          opacity: 1
                        }
                      }
                    }}
                    inputProps={{ 'aria-label': 'Rename PheNode input' }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleRenameClick}
                    // Intentionally NOT disabled when input is empty or no
                    // device is selected. handleRenameClick handles those
                    // states by silently no-op'ing — same behavior as the
                    // fleet-overview rename, where EditableLabel quietly
                    // reverts on an empty or unchanged submission. The
                    // button stays visually active so it never reads as
                    // broken or unavailable.
                    sx={{
                      minWidth: 132,
                      color: 'var(--green)',
                      borderColor: 'var(--orange)',
                      transition: 'none',
                      '&:hover': {
                        borderColor: 'var(--green)',
                        boxShadow: '0 0 7px -5px var(--green)',
                        color: 'var(--green)',
                        textShadow: '0 1px 5px #007bff',
                        backgroundColor: 'rgba(72, 247, 245, 0.08)'
                      }
                    }}
                  >
                    Rename
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Grid>
        </Grid>

        {/* ── Nearby PheNodes card ─────────────────────────────────────
            Appears only when proximity mode is on AND a device is
            selected. The four-effect hybrid (circle / dim / fit / list)
            converges here — this card is the textual half of "show me
            what's near my selected PheNode", complementing the map's
            visual half.

            Rows are clickable: clicking jumps the selection to that
            device (same handler as a pin click), which moves the
            proximity circle, refits the camera, recomputes the
            neighbor list. Effectively a "walk the cluster" navigation. */}
        {proximityEnabled && activeDevice && hasValidLocation(activeDevice) && (
          <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ color: '#646cff', flexShrink: 0 }}>
                Nearby PheNodes:
              </Typography>
              {/*
                The right caption interpolates the active device's display
                name, which can be arbitrarily long. Without these
                truncation styles a long label pushes the caption past the
                card edge. native `title` exposes the full value on hover.
              */}
              <Typography
                variant="caption"
                title={`Within ${PROXIMITY_RADIUS_MILES} mi of ${activeDeviceDisplayName}`}
                sx={{
                  color: 'var(--blue)',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                Within {PROXIMITY_RADIUS_MILES} mi of {activeDeviceDisplayName}
              </Typography>
            </Stack>

            {nearbyDevices.length === 0 ? (
              <Typography variant="body1" sx={{ color: 'var(--blue)', opacity: 0.7, textAlign: 'center', py: 1.5 }}>
                No other PheNodes within {PROXIMITY_RADIUS_MILES} miles of this device.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
                }}
              >
                {pagedNearbyDevices.map(({ device, distance }) => (
                  <Box
                    key={device.external_device_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectDevice?.(device.external_device_id)}
                    onKeyDown={(e) => {
                      // Enter / Space activate the row — same affordance
                      // a keyboard user gets on a real <button>. Without
                      // this the role="button" element looks like a
                      // button to assistive tech but isn't operable.
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectDevice?.(device.external_device_id);
                      }
                    }}
                    sx={{
                      border: '1px solid var(--reflected-light)',
                      borderRadius: 1,
                      p: 1,
                      backgroundColor: 'rgba(0, 20, 61, 0.38)',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      '&:hover, &:focus-visible': {
                        borderColor: 'var(--green)',
                        backgroundColor: 'rgba(72, 247, 245, 0.08)',
                        outline: 'none'
                      }
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography
                        variant="body1"
                        title={device.label || device.external_device_id}
                        sx={{
                          color: 'var(--blue)',
                          fontWeight: 600,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {device.label || device.external_device_id}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          color: 'var(--green)',
                          textShadow: '0 1px 9px #1a75e0c9',
                          fontWeight: 600,
                          flexShrink: 0
                        }}
                      >
                        {distance.toFixed(1)} mi
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}

            {/*
              Pagination — renders only when the neighbor list is
              larger than one page (NEARBY_PAGE_SIZE = 27). Below the
              threshold the full list fits without a pager and the
              extra control chrome would just be visual noise.
              Centered below the grid; styling matches the table
              pagination in FleetOverviewView.
            */}
            {nearbyTotalPages > 1 && (
              <Stack direction="row" sx={{ justifyContent: 'center', pt: 2 }}>
                <Pagination
                  count={nearbyTotalPages}
                  page={nearbyCurrentPage}
                  onChange={(_, page) => setNearbyCurrentPage(page)}
                  shape="rounded"
                  size="medium"
                  siblingCount={1}
                  boundaryCount={1}
                  sx={nearbyPaginationSx}
                />
              </Stack>
            )}
          </Box>
        )}
      </Stack>
      {/*
      Single mounted ConfirmRenameModal — opened by setting pendingRename,
      closed by clearing it. MUI Dialog uses a Portal internally so it
      visually escapes the map's Stack and sits above the rest of the
      page with the backdrop blur, same as the fleet-overview modal.
    */}
      <ConfirmRenameModal
        open={Boolean(pendingRename)}
        entityNoun="PheNode"
        externalId={pendingRename?.externalId}
        oldName={pendingRename?.oldName}
        newName={pendingRename?.newName}
        onConfirm={handleConfirmRename}
        onCancel={() => setPendingRename(null)}
      />
    </>
  );
}
