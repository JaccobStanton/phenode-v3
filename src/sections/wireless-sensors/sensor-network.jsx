import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import ConfirmRenameModal from 'components/ConfirmRenameModal';
import MainCard from 'components/MainCard';
import MapView from 'sections/wireless-sensors/map-view';
import MeasurementsChartGrid from 'sections/wireless-sensors/MeasurementsChartGrid';
import useAuth from 'hooks/useAuth';
import useInfoCard from 'hooks/useInfoCard';
import useMyDevices from 'hooks/data/useMyDevices';
import useMyWirelessSensors from 'hooks/data/useMyWirelessSensors';
import useWirelessSensorDetail from 'hooks/data/useWirelessSensorDetail';
import { renameSensor } from 'services/mutations';
import { formatBatteryPercent, formatLastMeasurement, formatSoilMoisture, formatSoilTemperature } from 'utils/transforms/wirelessSensor';
import wirelessSensorsDiagram from 'assets/diagrams/Wireless-Sensors-v4.svg';
import wsFleetIcon from 'assets/drawer-icons/WS_Fleet.svg';
import wsFleetIconActive from 'assets/drawer-icons/WS_Fleet_Active.svg';
import mapIconActive from 'assets/toggle_buttons/Map_Icon_Active.svg';
import mapIconInactive from 'assets/toggle_buttons/Map_Icon_Inactive.svg';
import soilProbeIconActive from 'assets/toggle_buttons/Soil_Probe_Icon_Active.svg';
import soilProbeIconInactive from 'assets/toggle_buttons/Soil_Probe_Icon_Inactive.svg';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

import {
  glassSurfaceSx,
  reflectedCardChromeSx,
  drfSurfaceSx,
  neonControlSx,
  drawerNavButtonSurfaceSx,
  orientationButtonSx,
  neonMenuPaperSx,
  neonMenuItemSx,
  tooltipSlotProps,
  neonSelectMenuPaperProps
} from 'themes/sx-tokens';

import { timeRangeOptions, chartTimeLabels } from 'data/mocks/time-ranges';
import { sensorMeasurementCharts } from 'data/mocks/sensor-measurements';

// Hoisted to module scope so this object literal isn't recreated every render.
const diagramWidthSx = { xs: '92%', sm: '88%', md: '90%', lg: '92%' };

// Search-param name for deep-linking from the wireless-sensor fleet
// overview. The fleet card click writes
// `?sensor=<externalSensorId>` (see sections/fleet-overview/
// sensor-fleet-overview.jsx:handleRowClick); this page reads it back
// out to seed both the PheNode and Sensor dropdowns. Pulled to a
// module-scope constant so the contract is discoverable in one place
// — if we ever rename the param, both sides flip together. Mirrors
// the DEVICE_PARAM convention in sensor-measurements.jsx.
const SENSOR_PARAM = 'sensor';

// Conversion ratio for °F → °m. Local consts (not magic numbers in the
// transform) make the intent obvious at the call site. Used for the
// altitude reading (backend stores meters; the existing UI displays feet).
const FEET_PER_METER = 3.28084;

// Display format for GPS coords on the Sensor Information card.
//   "32.4218, -92.8907"  — ~5 decimal places ≈ 1m precision, which is
//   the resolution the backend's _clean_location guard is good for.
//   Returns "N/A" when either coordinate is missing/invalid.
//
// Why two-line / single-string here (not separate Latitude + Longitude
// rows like the mock had): the existing card layout is a 2-column grid
// (label + value) and the rest of the labels read as one-liners
// ("Sensor ID", "Battery", "Probes Connected"). Showing GPS as a
// single combined string keeps the visual rhythm consistent. If we
// later want to break it back out, the comma-split is trivial.
const formatGpsCoords = (lat, lng) => {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return 'N/A';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

// Altitude is meters on the wire (sensor.altitude on the WirelessSensor
// model — see phenodeX/phenode_backend/db/models.py:124). The mock
// previously displayed feet ("793.95ft"), so we convert here to keep the
// surface visual unchanged. If a unit-preference toggle ever lands, this
// is the single place to flip it.
const formatAltitude = (meters) => {
  if (meters == null || Number.isNaN(meters)) return 'N/A';
  const feet = meters * FEET_PER_METER;
  return `${feet.toFixed(2)}ft`;
};

// Count the number of true entries in soilProbesConnected. The backend
// returns { teros12_1_connected: bool, teros12_2_connected: bool } —
// see _soil_probes_connected in phenodeX/phenode_backend/api/
// wireless_sensors/routes.py:92-108. Returning a bare integer (or 'N/A'
// when the dict isn't present) so the existing card UI just renders it
// as a number.
const countConnectedProbes = (probesConnected) => {
  if (!probesConnected) return 'N/A';
  return Object.values(probesConnected).filter((v) => v === true).length;
};

// Format electrical conductivity for the Soil Data card. Backend
// normalizes to dS/m (decisiemens per meter) — see _normalize_conductivity
// in routes.py:53-57. The mock previously labelled this "Soil Salinity"
// in kPa, which was wrong on both axes (the value is conductivity, not
// salinity, and the unit is dS/m). We keep the same row in the same
// position so the visual layout is unchanged, but with correct copy
// + unit so the number actually means something.
const formatConductivity = (value) => {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(2)} dS/m`;
};

// Build the soil-data rows for the active probe. selectedSoilProbe is
// 'probe-1' or 'probe-2' (see useInfoCard); we map that to the matching
// element of detail.soilSensors. Falls back to an "N/A" row set when
// the detail hook hasn't resolved or the sensor doesn't have a probe
// wired to that port — same shape as the mock so the .map() in the
// render branch doesn't have to special-case loading.
const buildSoilReadings = (sensorDetail, selectedSoilProbe) => {
  const port = selectedSoilProbe === 'probe-2' ? 1 : 0;
  const soil = sensorDetail?.soilSensors?.[port];
  return [
    { label: 'Soil Temperature', value: formatSoilTemperature(soil?.soilTemperature) },
    { label: 'Soil Moisture', value: formatSoilMoisture(soil?.soilMoisture) },
    // Renamed from "Soil Salinity / kPa" (mock) → "Conductivity / dS/m"
    // because the backend value is electrical conductivity, not salinity.
    // See note on formatConductivity above.
    { label: 'Conductivity', value: formatConductivity(soil?.electricalConductivity) }
  ];
};

export default function SensorNetwork() {
  const [timeRange, setTimeRange] = useState('Last 24 hours');
  const [chartLayout, setChartLayout] = useState('row');
  const [isMapView, setIsMapView] = useState(false);

  // PheNode + sensor selection. Both start as `undefined` (the
  // "uninitialized" sentinel) so the auto-default effect below can
  // tell the difference between "user hasn't picked yet" and "user
  // explicitly cleared the selection." Mirrors the same pattern used
  // in sections/fleet-overview/sensor-fleet-overview.jsx.
  const [selectedPhenodeId, setSelectedPhenodeId] = useState(undefined);
  const [selectedSensorId, setSelectedSensorId] = useState(undefined);

  // Info-card state (mode + soil-probe selection) lives in a hook so we can
  // pass it directly to MapView without prop-drilling four setters.
  const { infoCardMode, setInfoCardMode, selectedSoilProbe, setSelectedSoilProbe, isSoilDataMode } = useInfoCard();
  const [isMapToggleHovered, setIsMapToggleHovered] = useState(false);
  const [isInfoToggleHovered, setIsInfoToggleHovered] = useState(false);

  // Live data hooks — devices for the PheNode dropdown + sensor-cohort
  // membership; sensors for the wireless-sensor dropdown; detail for
  // the Sensor Information / Soil Data cards' richer fields (altitude,
  // soil-probe metrics, probes connected).
  const { devices, isLoading: devicesLoading } = useMyDevices();
  const { sensors, isLoading: sensorsLoading, mutate: mutateSensors } = useMyWirelessSensors();
  const { accessToken } = useAuth();

  // Deep-link entry point — `?sensor=<externalSensorId>` written by the
  // wireless-sensor fleet card click handler. When present and valid
  // (sensor exists in the user's list AND has a parent PheNode in the
  // user's devices), we seed BOTH dropdowns to that sensor's pair.
  // When absent or invalid, the existing recency-based defaults take
  // over.
  //
  // Mirrors the URL-as-source-of-truth pattern used in
  // sections/sensor-measurements/sensor-measurements.jsx — refresh-safe,
  // shareable, and gives the back button honest history between
  // distinct sensor selections.
  const [searchParams, setSearchParams] = useSearchParams();
  const sensorFromUrl = searchParams.get(SENSOR_PARAM);

  // Resolve the URL sensor into a { sensorId, phenodeId } pair, or null
  // if the URL value is missing/invalid. Returns null when:
  //   - no URL param
  //   - sensor not yet loaded (validation can't run)
  //   - URL sensor isn't in the user's sensor list (e.g. the user
  //     deep-linked an externalSensorId that's since been removed)
  //   - URL sensor has no parent PheNode in the user's devices
  //     (orphaned sensor — shouldn't normally happen, but we degrade
  //     gracefully rather than wedging the dropdowns)
  //
  // The stale-URL cleanup effect below removes the param in any of the
  // "invalid" cases so back/forward + reload don't keep pointing at a
  // phantom selection.
  const urlSensorResolution = useMemo(() => {
    if (!sensorFromUrl || !sensors || !devices) return null;
    const sensorExists = sensors.some((s) => s.externalSensorId === sensorFromUrl);
    if (!sensorExists) return null;
    const parentDevice = devices.find((d) => d.wireless_sensors?.some((ws) => ws.external_sensor_id === sensorFromUrl));
    if (!parentDevice) return null;
    return { sensorId: sensorFromUrl, phenodeId: parentDevice.external_device_id };
  }, [sensorFromUrl, sensors, devices]);

  const chartCards = useMemo(() => sensorMeasurementCharts, []);
  const infoCardTitle = isSoilDataMode ? 'Soil Data' : 'Sensor Information';
  const infoCardTooltipTitle = isSoilDataMode ? 'Sensor Info.' : 'Soil Data';
  const infoCardToggleIcon = isSoilDataMode
    ? isInfoToggleHovered
      ? wsFleetIconActive
      : wsFleetIcon
    : isInfoToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive;
  const mapToggleIcon = isMapView
    ? isMapToggleHovered
      ? soilProbeIconActive
      : soilProbeIconInactive
    : isMapToggleHovered
      ? mapIconActive
      : mapIconInactive;
  const sectionTitle = isMapView ? 'Sensor Overview' : 'Wireless Sensor Measurements';
  const mapToggleTooltip = isMapView ? 'Sensor Overview' : 'Map View';

  // Most-recently-reporting PheNode — same recency-sort with -Infinity
  // fallback used in sensor-fleet-overview.jsx so devices that have
  // never reported sink to the bottom rather than incorrectly winning
  // the recency race.
  //
  // URL sensor's parent PheNode wins over recency: if the user landed
  // here from a fleet-card click, the deep-link target's parent is the
  // PheNode they expect to see selected — promoting it past recency
  // keeps that intent intact even when the parent isn't the most-
  // recently-reporting device on the account.
  const defaultPhenodeId = useMemo(() => {
    if (urlSensorResolution?.phenodeId) return urlSensorResolution.phenodeId;
    if (!devices?.length) return null;
    const byRecency = [...devices].sort((a, b) => {
      const aTime = a.last_measurement_at ? new Date(a.last_measurement_at).getTime() : -Infinity;
      const bTime = b.last_measurement_at ? new Date(b.last_measurement_at).getTime() : -Infinity;
      return bTime - aTime;
    });
    return byRecency[0]?.external_device_id ?? null;
  }, [devices, urlSensorResolution]);

  // Apply the auto-default once on mount, and again if the user's
  // selected PheNode disappears from the fleet (e.g. an SWR
  // revalidation drops it). Same shape as sensor-fleet-overview.
  useEffect(() => {
    if (selectedPhenodeId === undefined) {
      if (defaultPhenodeId) setSelectedPhenodeId(defaultPhenodeId);
      return;
    }
    const stillExists = devices?.some((d) => d.external_device_id === selectedPhenodeId);
    if (!stillExists && defaultPhenodeId) {
      setSelectedPhenodeId(defaultPhenodeId);
    }
  }, [defaultPhenodeId, devices, selectedPhenodeId]);

  // Stale-URL cleanup. If the URL referenced a sensor that is no longer
  // resolvable (sensor was removed, parent PheNode was unassigned,
  // etc.), drop the param so back/forward + reload don't keep pointing
  // at a phantom selection. Mirrors the cleanup pattern in
  // sensor-measurements.jsx.
  //
  // Only runs once both data sources have loaded — checking before then
  // would spuriously fire and wipe a perfectly valid deep link during
  // the brief window between mount and first SWR resolution.
  //
  // We delete the param with `replace: true` so the cleanup doesn't
  // create a new history entry; the previous URL (which presumably did
  // hold a valid value) stays the back-button target.
  useEffect(() => {
    if (!sensorFromUrl) return;
    if (!sensors || !devices) return;
    if (urlSensorResolution) return; // URL value is valid — leave it alone.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SENSOR_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [sensorFromUrl, sensors, devices, urlSensorResolution, setSearchParams]);

  // Sensor cohort = wireless sensors paired to the selected PheNode.
  // The DeviceRead carries a `wireless_sensors[]` field of
  // { id, external_sensor_id, label } — see services/schemas/device.js.
  // We collect the external IDs into a Set for O(1) membership checks
  // when filtering the full sensor list below.
  const connectedSensorIds = useMemo(() => {
    if (!selectedPhenodeId || !devices) return new Set();
    const selected = devices.find((d) => d.external_device_id === selectedPhenodeId);
    if (!selected?.wireless_sensors?.length) return new Set();
    return new Set(selected.wireless_sensors.map((s) => s.external_sensor_id));
  }, [devices, selectedPhenodeId]);

  // The sensors visible in the dropdown — the full list filtered down
  // to the selected PheNode's cohort. Returns undefined while sensors
  // haven't loaded yet so the "loading" branch on the Autocomplete
  // still fires; returns [] when sensors exist but none are connected
  // to the selected PheNode (Autocomplete shows "No options").
  const filteredSensors = useMemo(() => {
    if (!sensors) return undefined;
    if (!selectedPhenodeId) return [];
    return sensors.filter((s) => connectedSensorIds.has(s.externalSensorId));
  }, [sensors, selectedPhenodeId, connectedSensorIds]);

  // Most-recently-reporting sensor in the current cohort. Same
  // -Infinity-fallback recency sort used for the PheNode default
  // above. Recomputed whenever the cohort changes (e.g. user picks a
  // different PheNode) so the "default sensor" stays meaningful.
  //
  // URL sensor wins over recency, but only if it actually lives in the
  // current cohort. We check membership against `filteredSensors` (the
  // selected-PheNode-scoped list) rather than `sensors` (the full
  // account list) because the cohort filter can legitimately exclude a
  // URL sensor — e.g. the user lands via deep link, then changes the
  // PheNode dropdown to a different device. In that case we drop back
  // to the new cohort's recency winner and let the stale-cleanup
  // effect below remove the now-stale URL param.
  const defaultSensorId = useMemo(() => {
    if (urlSensorResolution?.sensorId && filteredSensors?.some((s) => s.externalSensorId === urlSensorResolution.sensorId)) {
      return urlSensorResolution.sensorId;
    }
    if (!filteredSensors?.length) return null;
    const byRecency = [...filteredSensors].sort((a, b) => {
      const aTime = a.lastMeasurementAt ? new Date(a.lastMeasurementAt).getTime() : -Infinity;
      const bTime = b.lastMeasurementAt ? new Date(b.lastMeasurementAt).getTime() : -Infinity;
      return bTime - aTime;
    });
    return byRecency[0]?.externalSensorId ?? null;
  }, [filteredSensors, urlSensorResolution]);

  // Apply the auto-default to the sensor selection. Two clamp cases:
  //   1. Uninitialized   → pick the cohort's default.
  //   2. Stale selection → user previously picked a sensor that is no
  //      longer in the current cohort (changed PheNodes, or SWR
  //      dropped the sensor from the list). Re-default rather than
  //      stranding the user on a phantom selection.
  useEffect(() => {
    if (selectedSensorId === undefined) {
      if (defaultSensorId) setSelectedSensorId(defaultSensorId);
      return;
    }
    if (!filteredSensors) return;
    const stillExists = filteredSensors.some((s) => s.externalSensorId === selectedSensorId);
    if (!stillExists) {
      setSelectedSensorId(defaultSensorId ?? null);
    }
  }, [defaultSensorId, filteredSensors, selectedSensorId]);

  // The active list-item record (matches the dropdown selection).
  // Carries the lastMeasurementAt used by the page header. The detail
  // hook below provides the richer info-card fields.
  const activeSensor = useMemo(() => {
    if (!filteredSensors || !selectedSensorId) return null;
    return filteredSensors.find((s) => s.externalSensorId === selectedSensorId) ?? null;
  }, [filteredSensors, selectedSensorId]);

  // Detail fetch for the selected sensor — populates Sensor Information
  // (altitude, GPS, battery, probes connected) and Soil Data
  // (soilSensors[0/1] readings). Auto-skips when no sensor is selected.
  // We don't surface the hook's loading flag right now: every consumer
  // formatter ('formatGpsCoords', 'formatAltitude', etc.) renders 'N/A'
  // for missing inputs, so the card naturally degrades to "N/A" rows
  // during the brief window between dropdown selection and detail
  // arrival. Wire `isLoading` through here when a placeholder shimmer
  // becomes desirable.
  const { sensor: sensorDetail } = useWirelessSensorDetail(selectedSensorId);

  // Autocomplete options for both dropdowns. Object form `{ id, label }`
  // is what MUI Autocomplete prefers (id for equality, label for
  // display). Falls back to the immutable identifier when no label is
  // set so a freshly provisioned device/sensor is still pickable.
  const phenodeOptions = useMemo(
    () =>
      (devices ?? []).map((device) => ({
        id: device.external_device_id,
        label: device.label || device.external_device_id
      })),
    [devices]
  );
  const phenodeValue = phenodeOptions.find((opt) => opt.id === selectedPhenodeId) ?? null;

  const sensorOptions = useMemo(
    () =>
      (filteredSensors ?? []).map((sensor) => ({
        id: sensor.externalSensorId,
        label: sensor.label || sensor.externalSensorId
      })),
    [filteredSensors]
  );
  const sensorValue = sensorOptions.find((opt) => opt.id === selectedSensorId) ?? null;

  // Header "Last Measurements Taken:" string — uses the same
  // formatLastMeasurement transform as the fleet view so the date
  // vocabulary ("Never" / "Unknown" / localized timestamp) is consistent.
  const lastMeasurementsDisplay = activeSensor ? formatLastMeasurement(activeSensor.lastMeasurementAt) : '—';

  // Diagram-heading identifier. The mock displayed a placeholder MAC
  // ("E3:45:2C:89:B6") but the wireless-sensor model carries no MAC
  // field — externalSensorId is the immutable hardware identifier. We
  // surface that value so the heading stays correlated with the actual
  // selected sensor; falls back to "—" before the dropdown defaults.
  const diagramIdentifier = selectedSensorId ?? '—';

  // Soil-data rows for the active probe. Built once per detail/probe
  // change so the .map() in the render branch doesn't recompute on
  // every parent render.
  const activeSoilReadings = useMemo(() => buildSoilReadings(sensorDetail, selectedSoilProbe), [sensorDetail, selectedSoilProbe]);

  // ---- Rename card -------------------------------------------------------
  // Local controlled state for the Rename TextField. Reset whenever the
  // selected sensor changes so the input doesn't carry stale text from
  // a different sensor's rename attempt.
  const [renameInput, setRenameInput] = useState('');
  const [renameToast, setRenameToast] = useState(null); // { severity: 'success' | 'error', message }

  // `renameDraft` is the same {externalId, oldName, newName} payload
  // FleetOverviewView uses to drive its ConfirmRenameModal — kept as a
  // single object so we never get into a half-open modal where one
  // field is set and another isn't. `null` = modal closed; non-null =
  // modal open with that draft.
  //
  // Mirroring the fleet view's pattern (instead of two states for
  // "open" + "draft data") means the modal only exists in one
  // consistent state at any given time, and the same Continue/Cancel
  // contract applies on both pages — a user who has renamed a device
  // before sees the same modal behavior here.
  const [renameDraft, setRenameDraft] = useState(null);

  useEffect(() => {
    setRenameInput('');
  }, [selectedSensorId]);

  // Compute the OLD name once for the modal. Same fallback chain the
  // dropdown uses (label || externalSensorId) so the modal text matches
  // what the user just saw in the dropdown.
  const activeSensorOldName = activeSensor?.label || activeSensor?.externalSensorId || '';

  // Open the confirm-rename modal. Inline-guards on the no-sensor and
  // empty-input cases so the button reads as always-active (per user
  // request) but a stray click before a selection reads as a no-op
  // rather than throwing or opening an empty modal.
  //
  // The modal is what owns the actual PUT — see handleConfirmRename
  // below. This function only sets the draft.
  const handleOpenRenameModal = useCallback(() => {
    const trimmed = renameInput.trim();
    if (!selectedSensorId || !trimmed) return;
    setRenameDraft({
      externalId: selectedSensorId,
      oldName: activeSensorOldName,
      newName: trimmed
    });
  }, [activeSensorOldName, renameInput, selectedSensorId]);

  // Continue handler — runs when the user confirms inside the modal.
  // Performs the PUT, revalidates the sensor list (so the dropdown
  // label updates immediately), surfaces a success/error toast, and
  // closes the modal on success. Mirror of FleetOverviewView's
  // handleConfirmRename.
  //
  // Modal behavior on error: stays OPEN so the user can read the
  // failure detail and retry without re-typing the new name. The
  // modal's internal isSubmitting resets in its `finally`, so the
  // Continue button re-enables automatically.
  const handleConfirmRename = useCallback(async () => {
    if (!renameDraft) return;
    const { externalId, newName } = renameDraft;
    try {
      await renameSensor(externalId, newName, accessToken);
      await mutateSensors();
      setRenameInput('');
      setRenameDraft(null);
      setRenameToast({ severity: 'success', message: `Renamed sensor to "${newName}".` });
    } catch (err) {
      // ApiError carries `.detail` from the backend; fall back to a
      // generic message for non-API errors (network blip etc.).
      const detail = err?.detail || err?.message || 'Failed to rename sensor';
      setRenameToast({ severity: 'error', message: detail });
      // Intentionally do NOT clear renameDraft — modal stays open for
      // retry.
    }
  }, [accessToken, mutateSensors, renameDraft]);

  // Note: the Rename button is intentionally NOT disabled — the
  // open-modal handler already guards against the no-sensor and
  // empty-input cases by returning early. Pressing Rename with nothing
  // entered just no-ops; pressing it with valid input opens the
  // confirmation modal. The modal owns its own in-flight state so a
  // double-click on Continue can't fire two PUTs.

  // Clear the `?sensor` URL param. Called by the dropdown change
  // handlers below — once the user picks something different from the
  // deep-linked sensor, the URL param no longer reflects the user's
  // intent and a subsequent refresh shouldn't rewind their choice. The
  // existing stale-cleanup effect doesn't catch this case because the
  // URL value is still technically resolvable; "the user chose
  // otherwise" isn't a validity signal it can detect.
  //
  // Wrapped in useCallback so the inline onChange handlers stay
  // referentially stable across renders. `replace: true` avoids
  // polluting history with a no-content URL change.
  const clearSensorUrlParam = useCallback(() => {
    if (!sensorFromUrl) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SENSOR_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [sensorFromUrl, setSearchParams]);

  return (
    <MainCard content={false} sx={{ overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: '1px solid',
            borderBottomColor: 'var(--orange)',
            pb: 1.25
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--blue)' }}>
            {sectionTitle}
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              textAlign: { xs: 'left', md: 'right' },
              width: { xs: '100%', md: 'auto' },
              display: { xs: 'flex', md: 'block' },
              alignItems: { xs: 'center', md: 'unset' }
            }}
          >
            <Box component="span" sx={{ color: 'var(--blue)' }}>
              Last Measurements Taken:
            </Box>
            <Box component="span" sx={{ color: 'var(--green)', ml: { xs: 'auto', md: 1.5 }, display: 'inline-block', textAlign: 'right' }}>
              {lastMeasurementsDisplay}
            </Box>
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2.5, gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Autocomplete
              options={phenodeOptions}
              value={phenodeValue}
              onChange={(_, newValue) => {
                // Switching PheNode invalidates the sensor selection
                // (different cohort). Reset to undefined so the
                // auto-default effect repopulates with the new cohort's
                // most-recently-reporting sensor instead of stranding
                // the dropdown on a stale ID. Also clear any
                // deep-link `?sensor` param — the user has explicitly
                // moved off the URL-targeted PheNode/sensor pair.
                setSelectedPhenodeId(newValue?.id ?? null);
                setSelectedSensorId(undefined);
                clearSensorUrlParam();
              }}
              loading={devicesLoading}
              loadingText="Loading PheNodes…"
              noOptionsText="No PheNodes available"
              isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
              sx={{ width: { xs: 170, sm: 220 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={devicesLoading ? 'Loading…' : 'Select PheNode...'}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      ...neonControlSx,
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none'
                      },
                      '&.Mui-focused': {
                        borderColor: 'var(--blue)'
                      }
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--green)',
                      '&::placeholder': {
                        color: 'var(--green)',
                        opacity: 1
                      }
                    },
                    '& .MuiSvgIcon-root': {
                      color: 'var(--blue)'
                    }
                  }}
                />
              )}
              slotProps={{
                paper: {
                  sx: neonMenuPaperSx
                },
                listbox: {
                  sx: {
                    p: 0.5,
                    '& .MuiAutocomplete-option': {
                      ...neonMenuItemSx
                    }
                  }
                }
              }}
            />

            <Autocomplete
              options={sensorOptions}
              value={sensorValue}
              onChange={(_, newValue) => {
                // Manual sensor change — drop the deep-link `?sensor`
                // param so a subsequent refresh doesn't rewind the
                // user's pick to the URL-targeted sensor.
                setSelectedSensorId(newValue?.id ?? null);
                clearSensorUrlParam();
              }}
              loading={sensorsLoading}
              loadingText="Loading sensors…"
              noOptionsText={selectedPhenodeId ? 'No sensors connected to this PheNode' : 'Select a PheNode first'}
              isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
              disabled={!selectedPhenodeId}
              sx={{ width: { xs: 190, sm: 250 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={sensorsLoading ? 'Loading…' : 'Select Wireless Sensor...'}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      ...neonControlSx,
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none'
                      },
                      '&.Mui-focused': {
                        borderColor: 'var(--blue)'
                      }
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--green)',
                      '&::placeholder': {
                        color: 'var(--green)',
                        opacity: 1
                      }
                    },
                    '& .MuiSvgIcon-root': {
                      color: 'var(--blue)'
                    }
                  }}
                />
              )}
              slotProps={{
                paper: {
                  sx: neonMenuPaperSx
                },
                listbox: {
                  sx: {
                    p: 0.5,
                    '& .MuiAutocomplete-option': {
                      ...neonMenuItemSx
                    }
                  }
                }
              }}
            />
          </Stack>

          <Tooltip title={mapToggleTooltip} arrow={false} slotProps={tooltipSlotProps}>
            <IconButton
              aria-label={isMapView ? 'sensor overview' : 'map view'}
              onClick={() => setIsMapView((prev) => !prev)}
              onMouseEnter={() => setIsMapToggleHovered(true)}
              onMouseLeave={() => setIsMapToggleHovered(false)}
              onFocus={() => setIsMapToggleHovered(true)}
              onBlur={() => setIsMapToggleHovered(false)}
              sx={{
                border: '1px solid var(--reflected-light)',
                color: 'var(--blue)',
                ...drawerNavButtonSurfaceSx,
                boxShadow: '0 11px 19px 1px #0000002e'
              }}
            >
              <Box component="img" src={mapToggleIcon} alt="" sx={{ width: 21, height: 21 }} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
          {isMapView ? (
            <Grid size={{ xs: 12 }}>
              <MapView
                infoCardMode={infoCardMode}
                setInfoCardMode={setInfoCardMode}
                selectedSoilProbe={selectedSoilProbe}
                setSelectedSoilProbe={setSelectedSoilProbe}
              />
            </Grid>
          ) : (
            <>
              <Grid size={{ xs: 12, lg: 8 }} sx={{ display: 'flex' }}>
                <Box
                  sx={{
                    borderRadius: 1,
                    p: { xs: 1.5, sm: 2 },
                    width: '100%',
                    height: '100%',
                    ...drfSurfaceSx,
                    ...reflectedCardChromeSx
                  }}
                >
                  <Box sx={{ width: diagramWidthSx, mx: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Typography variant="body1" sx={{ width: '100%', textAlign: 'center', fontWeight: 600, pt: { xs: 0.25, sm: 0.5 } }}>
                      <Box component="span" sx={{ color: 'var(--blue)' }}>
                        [ MAC ADDR:
                      </Box>{' '}
                      <Box component="span" sx={{ color: 'var(--green)', textShadow: '0 1px 9px #1a75e0c9' }}>
                        {diagramIdentifier}
                      </Box>{' '}
                      <Box component="span" sx={{ color: 'var(--blue)' }}>
                        ]
                      </Box>
                    </Typography>

                    <Box
                      sx={{
                        mt: { xs: 2.5, lg: 'auto' },
                        pb: 0,
                        lineHeight: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center'
                      }}
                    >
                      <Box
                        component="img"
                        src={wirelessSensorsDiagram}
                        alt="Wireless sensor network diagram"
                        sx={{
                          width: '100%',
                          maxHeight: { xs: 250, sm: 330, md: 400, lg: 350 },
                          objectFit: 'contain',
                          display: 'block',
                          transform: { xs: 'translateY(8px)', sm: 'translateY(10px)' },
                          mb: 0,
                          pb: 0
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, lg: 4 }} sx={{ display: 'flex' }}>
                <Stack spacing={2.5} sx={{ width: '100%', height: '100%' }}>
                  <Box
                    sx={{
                      borderRadius: 1,
                      p: { xs: 1.5, sm: 2 },
                      ...drfSurfaceSx,
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
                            ...drawerNavButtonSurfaceSx,
                            boxShadow: '0 11px 19px 1px #0000002e'
                          }}
                        >
                          <Box component="img" src={infoCardToggleIcon} alt="" sx={{ width: 22, height: 22 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    {isSoilDataMode ? (
                      <>
                        <ToggleButtonGroup
                          exclusive
                          value={selectedSoilProbe}
                          onChange={(_, nextValue) => {
                            if (nextValue) setSelectedSoilProbe(nextValue);
                          }}
                          size="small"
                          sx={{
                            mb: 2,
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

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                          {activeSoilReadings.map((reading) => (
                            <Box key={reading.label} sx={{ display: 'contents' }}>
                              <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                                {reading.label}
                              </Typography>
                              <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                                {reading.value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </>
                    ) : (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1.25 }}>
                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          Sensor ID:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          {selectedSensorId ?? 'N/A'}
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          GPS:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatGpsCoords(sensorDetail?.location?.latitude, sensorDetail?.location?.longitude)}
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          Altitude:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatAltitude(sensorDetail?.location?.altitude)}
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          Battery:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatBatteryPercent(sensorDetail?.battery?.batteryPercent ?? activeSensor?.batteryPercent)}
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'var(--blue)', fontWeight: 600 }}>
                          Probes Connected:
                        </Typography>
                        <Typography className="info-card-green-text" variant="body1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                          {countConnectedProbes(sensorDetail?.soilProbesConnected)}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ borderRadius: 1, p: { xs: 1.5, sm: 2 }, flexGrow: 1, ...drfSurfaceSx, ...reflectedCardChromeSx }}>
                    <Stack sx={{ height: '100%', justifyContent: 'center', alignItems: 'center' }} spacing={2}>
                      <Typography variant="h5" sx={{ textAlign: 'center', color: 'var(--blue)' }}>
                        Rename this Sensor:
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={selectedSensorId ? 'Enter new sensor name' : 'Select a sensor first'}
                        value={renameInput}
                        onChange={(event) => setRenameInput(event.target.value)}
                        onKeyDown={(event) => {
                          // Submit on Enter for keyboard parity with the
                          // Rename button. preventDefault keeps the field
                          // from submitting any ancestor form (none today,
                          // but defensive). handleOpenRenameModal owns
                          // the guard logic (no sensor / empty input),
                          // so a fire-and-forget call here matches the
                          // button's behavior — no click-vs-Enter drift.
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleOpenRenameModal();
                          }
                        }}
                        disabled={!selectedSensorId}
                        sx={{
                          maxWidth: 320,
                          '& .MuiOutlinedInput-root': {
                            minHeight: 40,
                            borderStyle: 'none none solid',
                            borderWidth: '1px 1px 2px',
                            borderColor: 'var(--dark-blue) var(--dark-blue) var(--reflected-light)',
                            color: 'var(--blue)',
                            backgroundColor: '#00143642',
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
                            textAlign: 'center',
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
                        onClick={handleOpenRenameModal}
                        sx={{
                          minWidth: 140,
                          color: 'var(--green)',
                          borderColor: 'var(--orange)',
                          transition: 'none',
                          '&:hover': {
                            borderColor: 'var(--green)',
                            boxShadow: '0 0 7px -5px var(--green)',
                            color: 'var(--green)',
                            textShadow: '0 1px 5px #007bff',
                            backgroundColor: 'rgba(72, 247, 245, 0.08)'
                          },
                          // The button is never disabled today, but
                          // keep this rule so a future re-introduction
                          // of the disabled state degrades gracefully
                          // (still readable, just dimmer) instead of
                          // greying out unexpectedly.
                          '&.Mui-disabled': {
                            color: 'var(--green)',
                            borderColor: 'var(--orange)',
                            opacity: 0.6
                          }
                        }}
                      >
                        Rename
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </Grid>
            </>
          )}

          <Grid size={{ xs: 12 }}>
            <Box
              sx={{
                borderRadius: 1,
                p: { xs: 1.5, sm: 2 },
                ...drfSurfaceSx,
                ...reflectedCardChromeSx
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
                  Measurements Over Time
                </Typography>
                <Tooltip title="Orientation" arrow={false} slotProps={tooltipSlotProps}>
                  <IconButton
                    aria-label="toggle sensor chart layout"
                    onClick={() => setChartLayout((prev) => (prev === 'column' ? 'row' : 'column'))}
                    sx={orientationButtonSx}
                  >
                    <AppstoreOutlined />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 2 }}>
                <FormControl
                  size="small"
                  sx={{ minWidth: { xs: 0, sm: 220 }, width: { xs: '100%', sm: 220 }, flex: { xs: 1, sm: '0 0 auto' } }}
                >
                  <Select
                    value={timeRange}
                    onChange={(event) => setTimeRange(event.target.value)}
                    sx={{
                      color: 'var(--green)',
                      border: '1px solid var(--reflected-light)',
                      borderRadius: 1,
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '& .MuiSelect-icon': { color: 'var(--blue)' }
                    }}
                    MenuProps={{ PaperProps: neonSelectMenuPaperProps }}
                    renderValue={(selected) => (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <ClockCircleOutlined style={{ color: 'var(--blue)' }} />
                        <Box component="span" sx={{ color: 'var(--green)' }}>
                          {selected}
                        </Box>
                      </Stack>
                    )}
                  >
                    {timeRangeOptions.map((option) => (
                      <MenuItem
                        key={option}
                        value={option}
                        sx={{
                          color: 'var(--green)',
                          '&:hover': { backgroundColor: 'rgba(72, 247, 245, 0.12)' },
                          '&.Mui-selected': { backgroundColor: 'rgba(72, 247, 245, 0.18)' }
                        }}
                      >
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Refresh" arrow={false} slotProps={tooltipSlotProps}>
                  <IconButton
                    aria-label="refresh sensor charts"
                    sx={{
                      border: '1px solid var(--reflected-light)',
                      color: 'var(--purple)',
                      backgroundColor: 'rgba(0, 20, 61, 0.72)',
                      boxShadow: '0 11px 19px 1px #0000002e',
                      '&:hover': {
                        borderColor: 'var(--green)',
                        boxShadow: '0 0 7px -5px var(--green)',
                        color: 'var(--green)',
                        textShadow: '0 1px 5px #007bff',
                        backgroundColor: 'rgba(72, 247, 245, 0.08)'
                      }
                    }}
                  >
                    <ReloadOutlined />
                  </IconButton>
                </Tooltip>
              </Stack>

              <MeasurementsChartGrid charts={chartCards} timeLabels={chartTimeLabels} layout={chartLayout} />
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/*
        Rename feedback toast — surfaces success and ApiError-derived
        validation messages from the rename mutation. Auto-hides after
        4s for success, 6s for errors so the user has more time to read
        the failure detail. Uses MUI Snackbar+Alert (not a custom popup)
        so it inherits the global accessibility behavior (announces to
        screen readers via the Alert role).
      */}
      <Snackbar
        open={Boolean(renameToast)}
        autoHideDuration={renameToast?.severity === 'error' ? 6000 : 4000}
        onClose={() => setRenameToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {renameToast ? (
          <Alert onClose={() => setRenameToast(null)} severity={renameToast.severity} variant="filled" sx={{ width: '100%' }}>
            {renameToast.message}
          </Alert>
        ) : null}
      </Snackbar>

      {/*
        Confirmation modal for the Rename action. Single mounted
        instance — opened by setRenameDraft({...}), closed by
        setRenameDraft(null). Mirrors the mounting pattern in
        FleetOverviewView so the user sees the same modal vocabulary
        and behavior whether they rename from a fleet card or from this
        page's Rename Card.
      */}
      <ConfirmRenameModal
        open={Boolean(renameDraft)}
        entityNoun="Sensor"
        externalId={renameDraft?.externalId}
        oldName={renameDraft?.oldName}
        newName={renameDraft?.newName}
        onConfirm={handleConfirmRename}
        onCancel={() => setRenameDraft(null)}
      />
    </MainCard>
  );
}
