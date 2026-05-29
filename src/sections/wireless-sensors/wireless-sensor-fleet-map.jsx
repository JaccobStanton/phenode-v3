import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, InfoWindow, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import AntIcon from 'components/AntIcon';
import AimOutlined from '@ant-design/icons-svg/lib/asn/AimOutlined';
import ApartmentOutlined from '@ant-design/icons-svg/lib/asn/ApartmentOutlined';

import ConfirmRenameModal from 'components/ConfirmRenameModal';
import useDisplayPreferences from 'hooks/useDisplayPreferences';
import { useToast } from 'providers/ToastProvider';
import { glassSurfaceSx, reflectedCardChromeSx, tooltipSlotProps } from 'themes/sx-tokens';
import {
  formatBatteryPercent as formatDeviceBatteryPercent,
  formatTemperature as formatDeviceTemperature,
  formatTodaysRainfall as formatDeviceTodaysRainfall,
  formatWindSpeed as formatDeviceWindSpeed
} from 'utils/transforms/device';
import { formatBatteryPercent, formatMacAddress, formatSoilMoisture, formatSoilTemperature } from 'utils/transforms/wirelessSensor';

import wsFleetIcon from 'assets/drawer-icons/WS_Fleet.svg';
import wsFleetIconActive from 'assets/drawer-icons/WS_Fleet_Active.svg';
import soilProbeIconActive from 'assets/toggle_buttons/Soil_Probe_Icon_Active.svg';
import soilProbeIconInactive from 'assets/toggle_buttons/Soil_Probe_Icon_Inactive.svg';

// =============================================================================
// WirelessSensorFleetMap — Google Maps view of the user's wireless sensors plus
// the supporting Sensor Information / Soil Data and Rename surfaces below it.
// =============================================================================
//
// Models the same three-section layout as
// sections/sensor-measurements/phenode-fleet-map.jsx so users moving between
// the PheNode and wireless-sensor maps see the same vocabulary, hover
// behavior, and proximity affordance. Two adaptations distinguish this map:
//
//   1. PINS ARE WIRELESS SENSORS, NOT PHENODES — the green/blue palette,
//      the pulsing halo, the InfoWindow hover summary, the Nearby button,
//      and the neighbor list all operate on `sensors` (WirelessSensorListItem[])
//      instead of `devices` (DeviceRead[]).
//
//   2. NEW "PHENODE" OVERLAY TOGGLE — beside Nearby/Satellite is a new
//      "PheNode" toggle. When on, the parent PheNode of the active
//      sensor is rendered as an ADDITIONAL pin on the map in a
//      visually-distinct purple colour, so the user can see where the
//      sensors' parent device sits relative to its sensor cohort. The
//      parent is resolved from devices[].wireless_sensors[] in the
//      parent component and passed in via the `parentDevice` prop —
//      keeps this map oblivious to the parent-resolution logic.
//
// FAILURE MODES handled (parallel to phenode-fleet-map):
//   - Missing VITE_APP_GOOGLE_MAPS_API_KEY → "Map unavailable" card
//   - sensors loading                      → spinner card
//   - Account has no sensors               → "No sensors" card
//   - Every sensor missing lat/lng         → "No location data" card
//   - Some sensors missing lat/lng         → plot the rest, surface a
//                                              small "N hidden" badge

const API_KEY = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY;

// Geographic center of the contiguous US — only ever visible to a user
// for the brief moment between map mount and FitBoundsController's first
// run.
const FALLBACK_CENTER = { lat: 39.8283, lng: -98.5795 };
const FALLBACK_ZOOM = 4;

// Zoom level for a fleet of exactly one sensor. fitBounds() doesn't behave
// usefully with a degenerate single-point bounding box, so we set zoom
// explicitly.
const SINGLE_SENSOR_ZOOM = 14;

// Closer zoom applied when the user double-clicks anywhere on the
// map (including on a pin). Lets them shortcut past the default
// fleet-wide zoom without using the +/- controls.
const PIN_DBLCLICK_ZOOM = 17;

// Map area responsive heights. Mirrors the PheNode map so the two views
// have matching geometry.
const MAP_HEIGHT_SX = { xs: 320, sm: 400, md: 460, lg: 510 };

// SVG path for a circle centered at origin. Hand-written rather than using
// `google.maps.SymbolPath.CIRCLE` because that enum needs the Maps library
// loaded at icon-definition time, which would force us to construct icons
// inside an effect — unnecessary complexity for a static shape.
const CIRCLE_PATH = 'M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0';

// Solid "core" markers for sensor pins — same teal/blue palette the
// PheNode map uses for visual continuity. The Sensor map shares this
// color vocabulary so pins still read as "PheNode-system geo data" even
// with the entity swap.
const CORE_UNSELECTED_ICON = {
  path: CIRCLE_PATH,
  scale: 0.9,
  fillColor: '#48f7f5', // var(--green) — neon teal
  fillOpacity: 1,
  strokeColor: '#1a75e0', // var(--blue) — slim themed ring
  strokeWeight: 2.5,
  strokeOpacity: 0.9
};

const CORE_SELECTED_ICON = {
  path: CIRCLE_PATH,
  scale: 1.4,
  fillColor: '#1a75e0', // var(--blue) — inverted from unselected
  fillOpacity: 1,
  strokeColor: '#48f7f5', // var(--green)
  strokeWeight: 2.5
};

// Halo base config — radar-pulse ring under each sensor core marker.
const HALO_BASE_SCALE = 1.05;
const HALO_BASE_OPACITY = 0.55;
const HALO_GROW = 1.8;
const HALO_UNSELECTED_FILL = '#1a75e0';
const HALO_SELECTED_FILL = '#48f7f5';

// =============================================================================
// PARENT-PHENODE OVERLAY — distinct visual vocabulary
// =============================================================================
//
// When the user toggles the new "PheNode" button on, we plot the parent
// PheNode as a single additional pin. Color choice rules out the sensor
// palette (teal/blue) entirely — the project's purple accent
// (var(--purple) = #8955e2) is already in the design system and gives
// the maximum visual contrast against the green/blue sensor pins. A
// gold (#fdd835) stroke ring provides extra contrast in case the user is
// using satellite imagery (where the dark navy of the neon style is
// replaced by varied imagery).
//
// The PheNode pin shares the sensor pins' circle SVG path — same
// shape, but a distinctive var(--purple) fill so it still reads as a
// different category of thing visually. No stroke (the previous gold
// ring read as too "alert/warning" against satellite imagery and
// added more visual weight than the parent landmark needed).
const PHENODE_PIN_ICON = {
  path: CIRCLE_PATH,
  scale: 1.1, // a touch bigger than the sensor unselected core (0.9) so the parent still reads as a prominent landmark
  fillColor: '#8955e2', // var(--purple) — distinctive vs the sensor green/blue palette
  fillOpacity: 1,
  strokeOpacity: 0
};

// Halo behind the parent PheNode pin. Same pulse cadence as sensor
// halos (driven by the same usePulse hook) but tinted purple so it
// visually belongs to its own pin.
const PHENODE_HALO_FILL = '#8955e2';

// Neon-on-navy roadmap style — identical to the PheNode map so the two
// views share visual continuity.
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

// Google Maps ControlPosition.RIGHT_BOTTOM as a numeric constant so we
// don't need to wait for the Maps library to load.
const RIGHT_BOTTOM_POSITION = 9;

// Floating-chip background variants — fully opaque so the floating UI
// never reads as see-through against either neon map or satellite.
const FLOAT_CHIP_NEON_SX = {
  backgroundColor: '#000d29',
  border: '1px solid var(--reflected-light)',
  boxShadow: '0 11px 19px 1px #0000002e'
};
const FLOAT_CHIP_SATELLITE_SX = {
  backgroundColor: '#ffffff',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  boxShadow: '0 11px 19px 1px #0000002e'
};

// Build the same merged Google-controls + InfoWindow sx the PheNode map
// uses. Single function so both maps stay in lockstep on chrome theming.
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

// PROXIMITY FEATURE — same constants the PheNode map uses so the two
// maps share the same neighbor-radius semantics.
const PROXIMITY_RADIUS_MILES = 10;
const PROXIMITY_RADIUS_METERS = PROXIMITY_RADIUS_MILES * 1609.344;
const PROXIMITY_DIM_OPACITY = 0.18;

// Page size for the "Nearby Sensors" card. Above this size a
// pagination control appears below the grid; below it, the full list
// renders without a pager.
const NEARBY_PAGE_SIZE = 27;

// Themed pagination sx — duplicated from phenode-fleet-map.jsx (which
// itself mirrors FleetOverviewView's tabular pagination) so the
// "Nearby Sensors" pager reads as the same control vocabulary the
// rest of the app uses for paged lists.
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

// Format a decimal lat/lng pair as "dd.dddd°N, dd.dddd°W". Returns '—'
// for missing inputs so the caller doesn't need a null guard.
function formatLatLngWithHemisphere(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '—';
  const latHemi = lat >= 0 ? 'N' : 'S';
  const lngHemi = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latHemi}, ${Math.abs(lng).toFixed(4)}°${lngHemi}`;
}

// Predicate: this sensor has both lat AND lng (the schema permits
// either to be null) and they're plottable numbers.
function hasValidSensorLocation(sensor) {
  return typeof sensor?.latitude === 'number' && typeof sensor?.longitude === 'number';
}

// Same predicate for a DeviceRead (the parent PheNode pin).
function hasValidDeviceLocation(device) {
  return typeof device?.latitude === 'number' && typeof device?.longitude === 'number';
}

// Great-circle distance via haversine — same approximation the PheNode
// map uses (~0.5% worst-case error at fleet scales, far below GPS
// precision).
function haversineDistanceMiles(lat1, lng1, lat2, lng2) {
  const EARTH_RADIUS_MILES = 3958.8;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

// =============================================================================
// Sub-components — Google Maps lifecycle controllers
// =============================================================================
//
// These are structurally identical to phenode-fleet-map's controllers
// (intentionally — they're map-lifecycle helpers that don't depend on the
// entity vocabulary). They're duplicated here rather than imported because
// extracting them into a shared module would be a wider refactor than
// the user asked for, and copy-paste keeps each map self-contained for
// the user's read/debug experience. If a third map ever appears, hoist
// these into a shared `map/controllers.jsx`.

function ProximityCircle({ lat, lng, radiusMeters, themed }) {
  const map = useMap();
  const maps = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !maps || lat == null || lng == null) return undefined;
    const isSatellite = themed === 'satellite';
    const strokeColor = isSatellite ? '#fdd835' : '#48f7f5';
    const circle = new maps.Circle({
      strokeColor,
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

function ProximityFitController({ active, lat, lng, neighborCoords }) {
  const map = useMap();
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
    if (neighborCoords.length === 0) {
      map.setCenter({ lat, lng });
      map.setZoom(SINGLE_SENSOR_ZOOM);
    } else {
      map.fitBounds(bounds, 80);
    }
  }, [active, map, core, lat, lng, neighborCoords]);

  return null;
}

// One-shot camera PAN (no zoom change) when the user toggles the
// PheNode overlay on. Mirrors ProximityFitController's "fire once on
// off→on transition" pattern via a wasActiveRef, but uses panTo
// instead of fitBounds — the user explicitly asked for the camera to
// scroll over to the parent PheNode without zooming in. Preserving
// zoom keeps their current visual context intact (so e.g. a wide-fleet
// view stays wide; a tight selected-sensor view stays tight, just
// recentered on the parent).
//
// Toggling OFF doesn't trigger any camera change — the user is back
// to the sensor-only view and the existing camera is the right one.
//
// Silent no-op when lat/lng are missing; the toggle button itself
// already guards against opening the overlay for an unplottable
// parent device.
function PhenodeOverlayPanController({ active, lat, lng }) {
  const map = useMap();
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (!map) return;
    const justActivated = active && !wasActiveRef.current;
    wasActiveRef.current = active;
    if (!justActivated) return;
    if (lat == null || lng == null) return;
    // panTo (not setCenter) for a smooth animated transition. zoom is
    // intentionally left alone — that's the point of this controller
    // vs the FitBoundsController above.
    map.panTo({ lat, lng });
  }, [active, map, lat, lng]);

  return null;
}

// usePulse — value in [0, 1) looping monotonically over `period` ms.
// Throttled to ~20fps via setInterval so the marker setIcon churn is
// bounded. Same hook as the PheNode map.
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

// PulsingHalos — renders the breathing halo rings in ISOLATION.
//
// usePulse updates state ~20×/sec. Previously it lived in the top-level
// WirelessSensorFleetMap component, so every frame re-rendered the entire
// map subtree (APIProvider, <Map>, all core markers, controllers, the
// InfoWindow) 20×/sec — churn the user saw as the map "flashing /
// reloading". Moving the pulse into this leaf means only the cheap halo
// markers re-render each frame; everything else renders only when its own
// data actually changes.
//
// `targets` is a stable array the parent memoizes WITHOUT the pulse value:
// `{ key, lat, lng, fill, zIndex }` per halo. Visibility (which sensors get
// a halo) is decided by the parent so this component stays purely visual.
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

// Selection-aware camera controller. Replaces the previous
// SelectionCameraController + count-driven FitBoundsController split that
// the PheNode map uses.
//
// Why the wireless map needed a different shape: the PheNode map fits
// camera bounds to ALL plottable devices on initial load. With sensors
// that's the wrong move — the only pin actually rendered when the
// Nearby toggle is OFF is the SELECTED sensor (see the visibility
// rule in the marker render below). Fitting to the whole account-wide
// sensor cohort therefore zoomed the camera out wide enough to span
// the entire fleet (often U.S.-wide), even though only one pin was
// visible at that wide zoom. Subsequent selection changes panned at
// that wide zoom (panTo preserves zoom), so clicking a sensor in the
// dropdown didn't visibly move the camera in.
//
// New behavior: every selection change snaps the camera to the
// selected sensor at SINGLE_SENSOR_ZOOM, matching the
// "single-pin → close zoom" behavior the PheNode map exhibits when
// the user has only one device. Only fires when the selection
// actually changes (lastFitKeyRef compares the previous fit key) so
// user pan/zoom isn't yanked back on every SWR poll.
//
// When proximity is ON, ProximityFitController owns the camera (it
// fits selected + neighbors once on toggle-on). This controller still
// updates its lastFitKeyRef during proximity mode so the post-
// proximity-off transition doesn't re-fit redundantly.
function FitBoundsController({ selectedSensor, plottable, proximityActive }) {
  const map = useMap();
  const core = useMapsLibrary('core');
  // Single ref tracking the "last camera target" we set. Two key shapes:
  //   "selected:<externalSensorId>"  — focused on a specific sensor
  //   "fleet:<count>"                — fit-to-fleet fallback
  // Selection-driven re-fits only happen when this key changes, so user
  // pan/zoom between fits is preserved.
  const lastFitKeyRef = useRef(null);

  useEffect(() => {
    if (!map || !core) return;
    // Proximity owns the camera in its mode — record the key so the
    // transition back to non-proximity doesn't double-fit, but don't
    // compete with ProximityFitController.
    if (proximityActive) {
      lastFitKeyRef.current = selectedSensor ? `selected:${selectedSensor.externalSensorId}` : `fleet:${plottable.length}`;
      return;
    }

    // Selected sensor with valid coords → focus on it. This is the
    // common case once defaults apply or the user picks something.
    if (selectedSensor && hasValidSensorLocation(selectedSensor)) {
      const key = `selected:${selectedSensor.externalSensorId}`;
      if (key === lastFitKeyRef.current) return;
      lastFitKeyRef.current = key;
      map.setCenter({ lat: selectedSensor.latitude, lng: selectedSensor.longitude });
      map.setZoom(SINGLE_SENSOR_ZOOM);
      return;
    }

    // No selection yet (briefly, during the window between mount and
    // default-applying effect) — fall back to fitting whatever's
    // plottable so the user sees something useful instead of the bare
    // FALLBACK_CENTER.
    if (!plottable.length) return;
    const key = `fleet:${plottable.length}`;
    if (key === lastFitKeyRef.current) return;
    lastFitKeyRef.current = key;

    if (plottable.length === 1) {
      const s = plottable[0];
      map.setCenter({ lat: s.latitude, lng: s.longitude });
      map.setZoom(SINGLE_SENSOR_ZOOM);
    } else {
      const bounds = new core.LatLngBounds();
      plottable.forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }));
      map.fitBounds(bounds, 60);
    }
  }, [map, core, selectedSensor, plottable, proximityActive]);

  return null;
}

// Shared message-card chrome for the four non-map states.
function MessageCard({ children, isError }) {
  return (
    <Box
      sx={{
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

const formatConductivity = (value) => {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(2)} dS/m`;
};

// Build the Soil Data rows for the active probe — mirror of the same
// helper in sensor-network.jsx so the two surfaces show identical values
// for the same sensor/probe pair.
//
// `tempUnit` comes from useDisplayPreferences().tempUnit — passing it
// through the helper keeps the function pure (same inputs → same
// output) so it can stay at module scope. The caller's useMemo includes
// tempUnit in its deps.
function buildSoilReadings(sensorDetail, selectedSoilProbe, tempUnit = 'F') {
  const port = selectedSoilProbe === 'probe-2' ? 1 : 0;
  const soil = sensorDetail?.soilSensors?.[port];
  return [
    { label: 'Soil Temperature', value: formatSoilTemperature(soil?.soilTemperature, tempUnit) },
    { label: 'Soil Moisture', value: formatSoilMoisture(soil?.soilMoisture) },
    { label: 'Conductivity', value: formatConductivity(soil?.electricalConductivity) }
  ];
}

// Build the Sensor Information rows from the active sensor list-item +
// detail-fetch. Same field set the diagram-mode info card shows in
// sensor-network.jsx so the user sees identical values across both views.
//
// "Last Seen" was intentionally removed from this list per user
// request — the page-level "Last Measurements Taken" header above the
// map already surfaces that timestamp prominently, so repeating it
// inside the info card would just duplicate the same fact in two
// adjacent surfaces. The diagram-mode info card is unaffected.
function buildSensorReadings(activeSensor, sensorDetail) {
  const lat = sensorDetail?.location?.latitude ?? activeSensor?.latitude;
  const lng = sensorDetail?.location?.longitude ?? activeSensor?.longitude;
  const altitudeMeters = sensorDetail?.location?.altitude;
  const batteryPercent = sensorDetail?.battery?.batteryPercent ?? activeSensor?.batteryPercent;
  const probesConnected = sensorDetail?.soilProbesConnected;
  return [
    { label: 'Sensor ID:', value: activeSensor?.externalSensorId ?? '—' },
    { label: 'Latitude:', value: typeof lat === 'number' ? lat.toFixed(5) : '—' },
    { label: 'Longitude:', value: typeof lng === 'number' ? lng.toFixed(5) : '—' },
    {
      label: 'Altitude:',
      value: typeof altitudeMeters === 'number' ? `${(altitudeMeters * 3.28084).toFixed(2)}ft` : '—'
    },
    { label: 'Battery:', value: formatBatteryPercent(batteryPercent) },
    {
      label: 'Probes Connected:',
      value: probesConnected ? Object.values(probesConnected).filter((v) => v === true).length : 'N/A'
    }
  ];
}

export default function WirelessSensorFleetMap({
  // Full WirelessSensorListItem[] (validated). Used both for plotting
  // sensor pins and for resolving Nearby neighbors. The parent passes
  // the unfiltered account-wide list; cohort-filtering is a dropdown
  // concern, not a map concern (a user looking at the map likely wants
  // to see geographic relationships across the whole account).
  sensors,
  selectedSensorId,
  // (id) => void. Pin click + nearby-list click both fire this so the
  // parent can update its dropdown selection state.
  onSelectSensor,
  // The sensor list-item record for the current selection. Carries
  // lastMeasurementAt + the list-summary fields for the InfoWindow
  // hover summary.
  activeSensor,
  // The detail-fetch result for the current selection. Carries the
  // richer fields the Sensor Information / Soil Data card displays
  // (altitude, soilSensors[], soilProbesConnected). May be undefined
  // briefly between selection change and detail fetch resolution —
  // formatters degrade to "N/A" rows during that window.
  sensorDetail,
  // The parent PheNode (DeviceRead) of the currently-selected sensor,
  // resolved by the parent via devices[].wireless_sensors[]. May be
  // null if the sensor has no parent in the user's devices, or no
  // sensor is selected. Used by the new "PheNode" overlay button.
  parentDevice,
  // useInfoCard state lifted from the parent so this map and the
  // diagram-mode info card share the same Sensor Info ↔ Soil Data
  // toggle + soil-probe selection. Mirrors the prop contract the old
  // map-view.jsx accepted.
  infoCardMode,
  setInfoCardMode,
  selectedSoilProbe,
  setSelectedSoilProbe,
  // Async (externalSensorId, newLabel) => Promise<void>. Wired up by
  // the parent to renameSensor + sensor-list mutate. Errors propagate
  // here; we surface them via the toast and keep the modal open.
  onRename,
  isLoading
}) {
  const [mapStyleMode, setMapStyleMode] = useState('neon');
  const [renameInput, setRenameInput] = useState('');
  const [pendingRename, setPendingRename] = useState(null);
  const toast = useToast();

  // Hover state — separate ids for sensors vs the parent PheNode so
  // both pin types can show their own InfoWindow without collision.
  // Tracking by id (not object reference) keeps lookups stable across
  // SWR-driven re-fetches that mint new array references.
  const [hoveredSensorId, setHoveredSensorId] = useState(null);
  const [isHoveringPhenode, setIsHoveringPhenode] = useState(false);

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

  // Two independent toggles in the top-right control cluster.
  //
  //   proximityEnabled     — radius circle + dim faraway sensors + fit
  //                          camera + neighbor list. Same four-effect
  //                          hybrid as the PheNode map's Nearby toggle.
  //   phenodeOverlayEnabled — render the parent PheNode as an
  //                          additional pin in purple/gold so the user
  //                          can see where the parent device sits
  //                          relative to its sensors. Independent of
  //                          Nearby — both can be on simultaneously.
  const [proximityEnabled, setProximityEnabled] = useState(false);
  const [phenodeOverlayEnabled, setPhenodeOverlayEnabled] = useState(false);

  // Plottable subset — sensors that have both lat AND lng. fitBounds
  // controller depends on a stable reference for its count comparison.
  const plottable = useMemo(() => (sensors ?? []).filter(hasValidSensorLocation), [sensors]);

  // Display preferences — flows into both the soil-readings card
  // (soil temperature) and the parentDevice hover tooltip (temp /
  // wind / rain). useDisplayPreferences memoizes the returned object
  // so the per-field destructure here is stable across renders that
  // don't actually change preferences.
  const { tempUnit, speedUnit, rainUnit } = useDisplayPreferences();

  // Sensor & soil readings for the info-card branches. Memoized on the
  // upstream references so the .map() rendering doesn't iterate fresh
  // arrays per pulse-driven re-render. `tempUnit` is in the deps so a
  // unit change re-derives the soil rows.
  const sensorReadings = useMemo(() => buildSensorReadings(activeSensor, sensorDetail), [activeSensor, sensorDetail]);
  const soilReadings = useMemo(
    () => buildSoilReadings(sensorDetail, selectedSoilProbe, tempUnit),
    [sensorDetail, selectedSoilProbe, tempUnit]
  );
  const isSoilDataMode = infoCardMode === 'soil';

  // Info-card title + toggle button artwork — mirrors the diagram-mode
  // Sensor Information / Soil Data card so the user sees identical
  // chrome whether they're in the diagram or map view.
  const infoCardTitle = isSoilDataMode ? 'Soil Data:' : 'Sensor Information:';
  const infoCardTooltipTitle = isSoilDataMode ? 'Sensor Info.' : 'Soil Data';
  const [isInfoToggleHovered, setIsInfoToggleHovered] = useState(false);
  const infoCardToggleIcon = isSoilDataMode
    ? isInfoToggleHovered
      ? wsFleetIconActive
      : wsFleetIcon
    : isInfoToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive;

  // Hovered sensor record for the InfoWindow. Lookup falls back to null
  // when the hovered id no longer matches a plottable sensor (e.g. an
  // SWR refresh dropped it between hover and lookup).
  const hoveredSensor = useMemo(() => {
    if (!hoveredSensorId) return null;
    return plottable.find((s) => s.externalSensorId === hoveredSensorId) ?? null;
  }, [hoveredSensorId, plottable]);

  // Nearby sensors — within PROXIMITY_RADIUS_MILES of the active
  // sensor, sorted nearest-first. Empty when proximity is off or the
  // active sensor lacks coordinates.
  const nearbySensors = useMemo(() => {
    if (!proximityEnabled || !activeSensor || !hasValidSensorLocation(activeSensor)) return [];
    return plottable
      .filter((s) => s.externalSensorId !== activeSensor.externalSensorId)
      .map((s) => ({
        sensor: s,
        distance: haversineDistanceMiles(activeSensor.latitude, activeSensor.longitude, s.latitude, s.longitude)
      }))
      .filter((entry) => entry.distance <= PROXIMITY_RADIUS_MILES)
      .sort((a, b) => a.distance - b.distance);
  }, [proximityEnabled, activeSensor, plottable]);

  // Pagination state for the "Nearby Sensors" card. 1-indexed. Reset
  // to 1 whenever the underlying neighbor list shifts (active sensor
  // change, proximity toggle, fleet change) so the user doesn't get
  // stranded on a high page number of a list that just shrank.
  const [nearbyCurrentPage, setNearbyCurrentPage] = useState(1);
  const nearbyTotalPages = Math.max(1, Math.ceil(nearbySensors.length / NEARBY_PAGE_SIZE));
  const pagedNearbySensors = useMemo(() => {
    const start = (nearbyCurrentPage - 1) * NEARBY_PAGE_SIZE;
    return nearbySensors.slice(start, start + NEARBY_PAGE_SIZE);
  }, [nearbySensors, nearbyCurrentPage]);
  useEffect(() => {
    setNearbyCurrentPage(1);
  }, [nearbySensors.length]);

  // Set of ids that should remain at full opacity when proximity is on.
  // Built as a Set so the per-marker membership check is O(1) — the
  // marker render runs every pulse tick (~20×/sec), so an O(N) lookup
  // would compound.
  const nearbyIds = useMemo(() => {
    const ids = new Set(nearbySensors.map((entry) => entry.sensor.externalSensorId));
    if (activeSensor) ids.add(activeSensor.externalSensorId);
    return ids;
  }, [nearbySensors, activeSensor]);

  // Stable {lat, lng}[] for ProximityFitController.
  const neighborCoords = useMemo(
    () => nearbySensors.map((entry) => ({ lat: entry.sensor.latitude, lng: entry.sensor.longitude })),
    [nearbySensors]
  );

  // Halo targets — which pins get a pulsing ring, computed WITHOUT the pulse
  // value so this list stays referentially stable across animation frames
  // (the actual breathing is applied inside <PulsingHalos>). Declared here,
  // above the loading/empty early-returns, so the hook order stays stable.
  // Mirrors the marker visibility rule in the render: with Nearby OFF only
  // the selected sensor renders; with it ON, every in-radius ("emphasized")
  // sensor does. The parent PheNode overlay gets a halo when its toggle is on.
  const haloTargets = useMemo(() => {
    const out = [];
    for (const s of plottable) {
      const isSelected = s.externalSensorId === selectedSensorId;
      if (!isSelected && !proximityEnabled) continue;
      const isEmphasized = !proximityEnabled || nearbyIds.has(s.externalSensorId);
      if (!isEmphasized) continue;
      out.push({
        key: s.externalSensorId,
        lat: s.latitude,
        lng: s.longitude,
        fill: isSelected ? HALO_SELECTED_FILL : HALO_UNSELECTED_FILL,
        zIndex: isSelected ? 998 : 0
      });
    }
    if (phenodeOverlayEnabled && parentDevice && hasValidDeviceLocation(parentDevice)) {
      out.push({
        key: '__phenode_overlay__',
        lat: parentDevice.latitude,
        lng: parentDevice.longitude,
        fill: PHENODE_HALO_FILL,
        zIndex: 1500
      });
    }
    return out;
  }, [plottable, selectedSensorId, proximityEnabled, nearbyIds, phenodeOverlayEnabled, parentDevice]);

  // Display name for the active sensor (label || externalSensorId)
  // — used in the rename modal and the "Within X mi of …" caption on
  // the Nearby card. Falls back to a generic placeholder so a freshly
  // provisioned sensor with no label never reads as "undefined".
  const activeSensorDisplayName = activeSensor?.label || activeSensor?.externalSensorId || 'Unnamed sensor';

  // Open the confirmation modal. Same silent-noop guards the PheNode
  // map uses (no sensor / empty / unchanged input → just return). Keeps
  // the Rename button always-active without ever opening a modal the
  // user would immediately cancel.
  const handleRenameClick = () => {
    if (!activeSensor || !onRename) return;
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    if (trimmed === activeSensorDisplayName) return;
    // MAC resolution mirrors the sensor-network diagram heading: prefer
    // the detail-fetch value (always fresh against the latest reading),
    // fall back to the list-summary, finally null. Pre-format here so
    // the modal can render it directly.
    const macRaw = sensorDetail?.macAddress ?? activeSensor?.macAddress ?? null;
    setPendingRename({
      // externalId is what handleConfirmRename feeds to onRename →
      // renameSensor for the actual PUT; keep it as the immutable
      // externalSensorId regardless of which display id the modal
      // surfaces above.
      externalId: activeSensor.externalSensorId,
      // Display-only — modal shows this in its hardware-id badge in
      // place of externalId when present. Null falls through to
      // externalId display so the badge never renders empty.
      macAddress: macRaw ? formatMacAddress(macRaw) : null,
      oldName: activeSensorDisplayName,
      newName: trimmed
    });
  };

  // Continue handler — same shape as FleetOverviewView / PheNode map.
  // Success → toast + close modal + clear input. Error → toast,
  // modal stays open so the user can retry without re-typing.
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
      const fallback = 'Failed to rename sensor';
      toast.error(backendMessage ? `${fallback}: ${backendMessage}` : fallback);
    }
  };

  const totalCount = sensors?.length ?? 0;
  const plottableCount = plottable.length;
  const hiddenCount = totalCount - plottableCount;

  // Defensive default branches — same cascade as the PheNode map.

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
          <Box component="span">Loading sensors…</Box>
        </Stack>
      </MessageCard>
    );
  }

  if (totalCount === 0) {
    return <MessageCard>No wireless sensors assigned to this account yet.</MessageCard>;
  }

  if (plottableCount === 0) {
    return (
      <MessageCard>
        No location data available for any wireless sensor in this fleet. Sensors plot on the map once they report a GPS fix.
      </MessageCard>
    );
  }

  // Toggle styling — themed neon vs Google's default white, identical
  // recipe to the PheNode map so both surfaces feel like one product.
  const toggleSx =
    mapStyleMode === 'neon'
      ? {
          '& .MuiToggleButtonGroup-grouped': {
            border: '1px solid var(--reflected-light) !important',
            color: 'var(--blue)',
            backgroundColor: '#000d29',
            boxShadow: '0 11px 19px 1px #0000002e',
            textTransform: 'none',
            fontSize: '0.72rem',
            fontWeight: 600,
            px: 1.25,
            py: 0.4
          },
          '& .MuiToggleButtonGroup-grouped:hover': {
            backgroundColor: '#000d29 !important',
            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.08), rgba(72, 247, 245, 0.08)) !important'
          },
          '& .Mui-selected': {
            color: 'var(--green) !important',
            backgroundColor: '#000d29 !important',
            backgroundImage: 'linear-gradient(rgba(72, 247, 245, 0.22), rgba(72, 247, 245, 0.22)) !important',
            textShadow: '0 0 6px rgba(72, 247, 245, 0.45)'
          },
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

  // Single-button toggle sx — same conditional theming. Used by both
  // the Nearby button and the new PheNode overlay button so the two
  // sit visually identical to each other in the corner cluster.
  const singleToggleSx =
    mapStyleMode === 'neon'
      ? {
          border: '1px solid var(--reflected-light) !important',
          color: 'var(--blue)',
          backgroundColor: '#000d29',
          boxShadow: '0 11px 19px 1px #0000002e',
          textTransform: 'none',
          fontSize: '0.72rem',
          fontWeight: 600,
          px: 1.25,
          py: 0.4,
          gap: 0.5,
          borderRadius: 1,
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

  // Whether the parent PheNode overlay is actually plottable. Captured
  // once here so the marker render and the InfoWindow render both gate
  // on the same condition.
  const phenodeOverlayActive = phenodeOverlayEnabled && parentDevice && hasValidDeviceLocation(parentDevice);

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
              ...buildMapControlsSx(mapStyleMode === 'neon')
            }}
          >
            <APIProvider apiKey={API_KEY}>
              <Map
                mapTypeId={mapStyleMode === 'satellite' ? 'hybrid' : 'roadmap'}
                styles={mapStyleMode === 'neon' ? NEON_MAP_STYLE : undefined}
                defaultCenter={FALLBACK_CENTER}
                defaultZoom={FALLBACK_ZOOM}
                tilt={0}
                rotateControl={false}
                gestureHandling="cooperative"
                mapTypeControl={false}
                fullscreenControl
                fullscreenControlOptions={{ position: RIGHT_BOTTOM_POSITION }}
                zoomControlOptions={{ position: RIGHT_BOTTOM_POSITION }}
                streetViewControl={false}
                disableDoubleClickZoom
                onDblclick={handleMapDblclick}
              >
                <FitBoundsController selectedSensor={activeSensor} plottable={plottable} proximityActive={proximityEnabled} />
                {/*
                  Pan-only camera move when the user toggles the PheNode
                  overlay on. Mounted unconditionally so the controller's
                  internal wasActiveRef can detect the off→on transition;
                  it silently no-ops when `active` is false or the parent
                  device has no GPS. We pass parent's lat/lng even if
                  parentDevice is null/missing — the controller guards
                  against that.
                */}
                <PhenodeOverlayPanController
                  active={Boolean(phenodeOverlayActive)}
                  lat={parentDevice?.latitude}
                  lng={parentDevice?.longitude}
                />
                {proximityEnabled && activeSensor && hasValidSensorLocation(activeSensor) && (
                  <>
                    <ProximityCircle
                      lat={activeSensor.latitude}
                      lng={activeSensor.longitude}
                      radiusMeters={PROXIMITY_RADIUS_METERS}
                      themed={mapStyleMode}
                    />
                    <ProximityFitController
                      active={proximityEnabled}
                      lat={activeSensor.latitude}
                      lng={activeSensor.longitude}
                      neighborCoords={neighborCoords}
                    />
                  </>
                )}
                {/* Pulsing halos render in isolation so the per-frame
                    animation doesn't re-render the whole map. */}
                <PulsingHalos targets={haloTargets} />
                {plottable.map((s) => {
                  const isSelected = s.externalSensorId === selectedSensorId;
                  // Same visibility rule as PheNode map: render only the
                  // selected sensor by default, all in-radius sensors
                  // when Nearby is on.
                  if (!isSelected && !proximityEnabled) return null;
                  const isEmphasized = !proximityEnabled || nearbyIds.has(s.externalSensorId);
                  const baseCoreIcon = isSelected ? CORE_SELECTED_ICON : CORE_UNSELECTED_ICON;
                  const coreIcon = isEmphasized
                    ? baseCoreIcon
                    : {
                        ...baseCoreIcon,
                        fillOpacity: PROXIMITY_DIM_OPACITY,
                        strokeOpacity: PROXIMITY_DIM_OPACITY * 0.8
                      };
                  return (
                    <Fragment key={s.externalSensorId}>
                      <Marker
                        position={{ lat: s.latitude, lng: s.longitude }}
                        icon={coreIcon}
                        zIndex={isSelected ? 999 : 1}
                        onClick={() => onSelectSensor?.(s.externalSensorId)}
                        onMouseOver={() => setHoveredSensorId(s.externalSensorId)}
                        onMouseOut={() => setHoveredSensorId((prev) => (prev === s.externalSensorId ? null : prev))}
                      />
                    </Fragment>
                  );
                })}

                {/*
                  Parent PheNode overlay marker — only rendered when the
                  PheNode toggle is on AND the parent device has valid
                  coordinates. The diamond shape + purple-on-gold palette
                  immediately distinguishes it from the round green/blue
                  sensor pins for both color-sighted and color-blind
                  users. Halo pulse uses the same usePulse value so all
                  pins on the map breathe in sync (helps the eye treat
                  the map as one cohesive visualization rather than two
                  competing ones). zIndex bumped above sensor cores so
                  the parent reads as "the landmark", not just another
                  pin in the cluster.
                */}
                {phenodeOverlayActive && (
                  <Marker
                    position={{ lat: parentDevice.latitude, lng: parentDevice.longitude }}
                    icon={PHENODE_PIN_ICON}
                    zIndex={1600}
                    onMouseOver={() => setIsHoveringPhenode(true)}
                    onMouseOut={() => setIsHoveringPhenode(false)}
                  />
                )}

                {/*
                  Themed hover tooltip for sensor pins. The PheNode pin
                  has its own InfoWindow below — kept separate so the
                  vocabulary inside each can specialize (sensor metrics
                  vs PheNode metrics). They never both render at once
                  in practice because hover state is mutually exclusive
                  on a real map, but if it ever did happen the two
                  windows would just stack near each other without
                  conflict.
                */}
                {hoveredSensor && (
                  <InfoWindow
                    position={{ lat: hoveredSensor.latitude, lng: hoveredSensor.longitude }}
                    pixelOffset={[0, -8]}
                    headerDisabled
                    shouldFocus={false}
                    disableAutoPan
                  >
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
                        {/*
                          Sensor label color is var(--orange) per user
                          request — distinguishes the sensor hover
                          card's title from the metric values below
                          (green) and the parent-PheNode hover card's
                          title (purple), so all three pin types have a
                          unique title color in their respective hover
                          cards. The teal textShadow from the previous
                          treatment is dropped since orange + teal glow
                          reads off-color; orange against the dark navy
                          card surface has enough contrast on its own.
                        */}
                        <Typography
                          title={hoveredSensor.label || hoveredSensor.externalSensorId}
                          sx={
                            mapStyleMode === 'neon'
                              ? {
                                  color: 'var(--orange)',
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
                          {hoveredSensor.label || hoveredSensor.externalSensorId}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={
                            mapStyleMode === 'neon'
                              ? { color: 'var(--blue)', fontSize: '0.65rem', flexShrink: 0, letterSpacing: '0.04em' }
                              : { color: '#666', fontSize: '0.65rem', flexShrink: 0, letterSpacing: '0.04em' }
                          }
                        >
                          Sensor
                        </Typography>
                      </Stack>
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
                          // formatSoilTemperature respects the user's
                          // tempUnit and handles the typeof-number guard
                          // internally (returns 'N/A' for non-numeric).
                          ['Soil Temp:', formatSoilTemperature(hoveredSensor.soilTemperatureC, tempUnit)],
                          ['Soil Moisture:', formatSoilMoisture(hoveredSensor.soilMoisture)],
                          ['Battery:', formatBatteryPercent(hoveredSensor.batteryPercent)]
                        ].map(([label, value]) => (
                          <Fragment key={label}>
                            <Typography
                              sx={
                                mapStyleMode === 'neon'
                                  ? { color: 'var(--blue)', fontSize: '0.78rem', fontWeight: 600 }
                                  : { color: '#444', fontSize: '0.78rem', fontWeight: 500 }
                              }
                            >
                              {label}
                            </Typography>
                            <Typography
                              sx={
                                mapStyleMode === 'neon'
                                  ? {
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
                          {formatLatLngWithHemisphere(hoveredSensor.latitude, hoveredSensor.longitude)}
                        </Typography>
                      </Box>
                    </Box>
                  </InfoWindow>
                )}

                {/*
                  Parent-PheNode hover InfoWindow. Renders only when the
                  PheNode overlay is on AND the user is hovering the
                  PheNode pin. The header carries the device label + a
                  "PheNode" tag in purple (matching the pin), so the
                  card immediately reads as "different category of pin"
                  vs the sensor InfoWindow's green-teal vocabulary.
                */}
                {phenodeOverlayActive && isHoveringPhenode && (
                  <InfoWindow
                    position={{ lat: parentDevice.latitude, lng: parentDevice.longitude }}
                    pixelOffset={[0, -8]}
                    headerDisabled
                    shouldFocus={false}
                    disableAutoPan
                  >
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
                          title={parentDevice.label || parentDevice.external_device_id}
                          sx={
                            mapStyleMode === 'neon'
                              ? {
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
                          {parentDevice.label || parentDevice.external_device_id}
                        </Typography>
                        {/*
                          "PheNode" tag — matches the styling of the
                          PheNode-fleet-map's hover tag (blue caption
                          in neon mode, gray in satellite). The title
                          above stays var(--purple) so the hover card
                          still visually echoes the purple pin color
                          on the map.
                        */}
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
                        Metric grid — same row set the PheNode-fleet-map
                        hover card uses (Temperature / Rainfall / Wind /
                        Battery, all from the device transforms so the
                        vocabulary matches across both maps), plus a
                        Sensors row that's specific to this map (count
                        of paired wireless sensors on the parent device,
                        which is the load-bearing reason the user
                        cares about the parent here).
                      */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.4, mb: 0.75 }}>
                        {[
                          ['Temperature:', formatDeviceTemperature(parentDevice.temperature_c, tempUnit)],
                          ['Rainfall:', formatDeviceTodaysRainfall(parentDevice.rainfall_today_mm, rainUnit)],
                          ['Wind:', formatDeviceWindSpeed(parentDevice.wind_speed, speedUnit)],
                          ['Battery:', formatDeviceBatteryPercent(parentDevice.battery_percent)],
                          ['Sensors:', String(parentDevice.wireless_sensors?.length ?? 0)]
                        ].map(([label, value]) => (
                          <Fragment key={label}>
                            <Typography
                              sx={
                                mapStyleMode === 'neon'
                                  ? { color: 'var(--blue)', fontSize: '0.78rem', fontWeight: 600 }
                                  : { color: '#444', fontSize: '0.78rem', fontWeight: 500 }
                              }
                            >
                              {label}
                            </Typography>
                            <Typography
                              sx={
                                mapStyleMode === 'neon'
                                  ? {
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
                          {formatLatLngWithHemisphere(parentDevice.latitude, parentDevice.longitude)}
                        </Typography>
                      </Box>
                    </Box>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>

            {/* Title overlay — top-left, parallel to PheNode map. */}
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
                Wireless Sensor Map
              </Typography>
            </Box>

            {/*
              Top-right control cluster — Nearby (left), PheNode overlay
              (middle), Neon/Satellite (right). All three share the same
              conditional theming so they read as one row of related
              affordances. Wrapped in a Stack with absolute positioning
              so the buttons stack horizontally in the corner.
            */}
            <Stack direction="row" spacing={0.75} sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2, alignItems: 'center' }}>
              <ToggleButton
                size="small"
                value="proximity"
                selected={proximityEnabled}
                onChange={() => {
                  // Same silent-noop pattern as the PheNode map's Nearby
                  // button — clicking with no active sensor or missing
                  // coords is a no-op rather than a confusing error
                  // state.
                  if (!activeSensor || !hasValidSensorLocation(activeSensor)) return;
                  setProximityEnabled((prev) => !prev);
                }}
                aria-label={proximityEnabled ? 'Hide nearby sensors' : 'Show nearby sensors'}
                sx={singleToggleSx}
              >
                <AntIcon icon={AimOutlined} style={{ fontSize: 13 }} />
                <Box component="span">Nearby</Box>
              </ToggleButton>

              {/*
                NEW — PheNode overlay toggle. When on, the parent
                PheNode of the active sensor renders as an extra pin in
                purple/gold so the user can locate the parent device
                relative to its sensor cohort. No-ops silently if the
                parent isn't resolvable (sensor has no parent device or
                the parent has no GPS) — same affordance pattern as
                Nearby and Rename.
              */}
              <ToggleButton
                size="small"
                value="phenode"
                selected={phenodeOverlayEnabled}
                onChange={() => {
                  if (!parentDevice || !hasValidDeviceLocation(parentDevice)) return;
                  setPhenodeOverlayEnabled((prev) => !prev);
                }}
                aria-label={phenodeOverlayEnabled ? 'Hide parent PheNode pin' : 'Show parent PheNode pin'}
                sx={singleToggleSx}
              >
                <AntIcon icon={ApartmentOutlined} style={{ fontSize: 13 }} />
                <Box component="span">PheNode</Box>
              </ToggleButton>

              <ToggleButtonGroup
                exclusive
                value={mapStyleMode}
                onChange={(_, next) => {
                  if (next) setMapStyleMode(next);
                }}
                size="small"
                sx={toggleSx}
              >
                <ToggleButton value="neon">Neon</ToggleButton>
                <ToggleButton value="satellite">Satellite</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {/* Hidden-count badge — anchored bottom-left of the map.
                Bumped above Google's "Google" wordmark (also bottom-
                left, ToS-protected and unrestylable) so the badge and
                the attribution don't collide.
                Mode-conditional theming: neon wears the dashboard's
                dark navy + reflected-light border; satellite adopts
                the white-chip Google-default look so it sits naturally
                alongside Google's own attribution chrome. */}
            {hiddenCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  // Clear the "Google" wordmark in the bottom-left. 36
                  // leaves a visible gap above the ~14px wordmark so the
                  // badge reads as separate chrome rather than colliding.
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
                  {hiddenCount} of {totalCount} sensor{totalCount === 1 ? '' : 's'} hidden — no location data
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* ── Sensor Information / Soil Data + Rename grid ───────────────── */}
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
                  {infoCardTitle}
                </Typography>
                {/*
                  Same Sensor Info ↔ Soil Data toggle the diagram-mode
                  card carries. We deliberately reuse the parent's
                  useInfoCard state (passed in via props) so flipping
                  here also flips when the user switches back to
                  diagram view — one mental model, not two surfaces
                  drifting out of sync.
                */}
                <Tooltip title={infoCardTooltipTitle} arrow={false} slotProps={tooltipSlotProps}>
                  <IconButton
                    aria-label={isSoilDataMode ? 'show sensor info' : 'show soil data'}
                    onClick={() => setInfoCardMode((prev) => (prev === 'soil' ? 'sensor' : 'soil'))}
                    onMouseEnter={() => setIsInfoToggleHovered(true)}
                    onMouseLeave={() => setIsInfoToggleHovered(false)}
                    onFocus={() => setIsInfoToggleHovered(true)}
                    onBlur={() => setIsInfoToggleHovered(false)}
                    sx={{
                      border: '1px solid var(--reflected-light)',
                      color: 'var(--blue)',
                      backgroundColor: 'rgba(0, 17, 48, 0.03)',
                      backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      '&:hover': { borderColor: 'var(--green)' }
                    }}
                  >
                    <Box component="img" src={infoCardToggleIcon} alt="" sx={{ width: 22, height: 22 }} />
                  </IconButton>
                </Tooltip>
              </Stack>

              {isSoilDataMode ? (
                <ToggleButtonGroup
                  exclusive
                  value={selectedSoilProbe}
                  onChange={(_, nextValue) => {
                    if (nextValue) setSelectedSoilProbe(nextValue);
                  }}
                  size="small"
                  sx={{
                    mb: 1.75,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    '& .MuiToggleButtonGroup-grouped': {
                      border: '1px solid var(--reflected-light) !important',
                      borderRadius: '6px !important',
                      color: 'var(--blue)',
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
                      textTransform: 'none',
                      fontWeight: 600
                    },
                    '& .MuiToggleButtonGroup-grouped:first-of-type': {
                      borderTopRightRadius: '0 !important',
                      borderBottomRightRadius: '0 !important'
                    },
                    '& .MuiToggleButtonGroup-grouped:last-of-type': {
                      borderTopLeftRadius: '0 !important',
                      borderBottomLeftRadius: '0 !important'
                    },
                    '& .Mui-selected': {
                      color: 'var(--green) !important',
                      backgroundColor: 'rgba(72, 247, 245, 0.12) !important'
                    }
                  }}
                >
                  <ToggleButton value="probe-1">Soil Probe 1</ToggleButton>
                  <ToggleButton value="probe-2">Soil Probe 2</ToggleButton>
                </ToggleButtonGroup>
              ) : null}

              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
                }}
              >
                {(isSoilDataMode ? soilReadings : sensorReadings).map((reading) => (
                  <Box
                    key={reading.label}
                    sx={{
                      border: '1px solid var(--reflected-light)',
                      borderRadius: 1,
                      p: 1,
                      backgroundColor: 'rgba(0, 20, 61, 0.38)',
                      overflow: 'hidden'
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600, flexShrink: 0 }}>
                        {reading.label}
                      </Typography>
                      <Typography
                        className="info-card-green-text"
                        variant="body1"
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
                  Rename this Sensor:
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter new sensor name"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
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
                    inputProps={{ 'aria-label': 'Rename sensor input' }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleRenameClick}
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

        {/* ── Nearby Sensors card ───────────────────────────────────────── */}
        {proximityEnabled && activeSensor && hasValidSensorLocation(activeSensor) && (
          <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, ...glassSurfaceSx, ...reflectedCardChromeSx }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ color: '#646cff', flexShrink: 0 }}>
                Nearby Sensors:
              </Typography>
              <Typography
                variant="caption"
                title={`Within ${PROXIMITY_RADIUS_MILES} mi of ${activeSensorDisplayName}`}
                sx={{
                  color: 'var(--blue)',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                Within {PROXIMITY_RADIUS_MILES} mi of {activeSensorDisplayName}
              </Typography>
            </Stack>

            {nearbySensors.length === 0 ? (
              <Typography variant="body1" sx={{ color: 'var(--blue)', opacity: 0.7, textAlign: 'center', py: 1.5 }}>
                No other sensors within {PROXIMITY_RADIUS_MILES} miles of this sensor.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
                }}
              >
                {pagedNearbySensors.map(({ sensor, distance }) => (
                  <Box
                    key={sensor.externalSensorId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectSensor?.(sensor.externalSensorId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectSensor?.(sensor.externalSensorId);
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
                        title={sensor.label || sensor.externalSensorId}
                        sx={{
                          color: 'var(--blue)',
                          fontWeight: 600,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {sensor.label || sensor.externalSensorId}
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
              Pagination — only renders when the neighbor list is
              larger than one page (NEARBY_PAGE_SIZE = 27). Below
              that, the full list fits comfortably and the pager
              would add control chrome with no purpose. Centered
              under the grid; styling matches the PheNode map's
              equivalent pager.
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

      <ConfirmRenameModal
        open={Boolean(pendingRename)}
        entityNoun="Sensor"
        externalId={pendingRename?.externalId}
        macAddress={pendingRename?.macAddress}
        oldName={pendingRename?.oldName}
        newName={pendingRename?.newName}
        onConfirm={handleConfirmRename}
        onCancel={() => setPendingRename(null)}
      />
    </>
  );
}
