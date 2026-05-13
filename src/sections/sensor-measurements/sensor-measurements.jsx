import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';

import MainCard from 'components/MainCard';
import PhenodeSelector from 'components/PhenodeSelector';
import MapView from 'sections/wireless-sensors/map-view';
import useInfoCard from 'hooks/useInfoCard';
import useMyDevices from 'hooks/data/useMyDevices';
import {
  formatLastMeasurement,
  formatTemperature,
  formatTodaysRainfall,
  formatWindSpeed
} from 'utils/transforms/device';
import rainSensorIcon from 'assets/sensor-measurements/Rain.svg';
import tempSensorIcon from 'assets/sensor-measurements/Temp.svg';
import windSensorIcon from 'assets/sensor-measurements/Wind.svg';
import mapIconActive from 'assets/toggle_buttons/Map_Icon_Active.svg';
import mapIconInactive from 'assets/toggle_buttons/Map_Icon_Inactive.svg';
import phenodeFleetIcon from 'assets/drawer-icons/PheNode_Fleet.svg';
import phenodeFleetIconActive from 'assets/drawer-icons/PheNode_Fleet_Active.svg';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import ZoomInOutlined from '@ant-design/icons/ZoomInOutlined';

import {
  reflectedCardChromeSx,
  orientationButtonSx,
  tooltipSlotProps,
  neonSelectMenuPaperProps,
  drawerNavButtonSurfaceSx
} from 'themes/sx-tokens';
import { timeRangeOptions, chartTimeLabels } from 'data/mocks/time-ranges';
import { sensorMeasurementCharts } from 'data/mocks/sensor-measurements';

// Sensor-measurements uses a slightly opaque "drf" base for its main panel;
// keep this local variant rather than the more translucent shared one.
const glassSurfaceSx = {
  backgroundColor: 'var(--drf)',
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))'
};

// Chart panel surface – gradient with custom border, distinct from the shared chart surface.
const chartSurfaceSx = {
  backgroundColor: '#07143f',
  backgroundImage: 'linear-gradient(180deg, #06102a 0%, #07143f 100%)',
  border: '1px solid #0e346a'
};

// Search-param name the fleet-overview card click writes to (and that
// this page reads from). Pulling it to a constant keeps the contract
// between the two pages discoverable in one place — if we ever rename
// the param, both sides flip together.
const DEVICE_PARAM = 'device';

// Build the three "current value" circles from a single DeviceRead. The
// values use the same formatters the fleet-overview cards use, so the
// number the user clicked on the fleet card visually matches the number
// they land on here. Humidity (circle 1 sub-label), Gust (circle 3
// sub-label) and Wind direction (circle 3 caption) aren't on the
// DeviceRead schema yet — they render as "N/A" / "—" placeholders for
// now; the moment those land in the backend the read-throughs below
// flip to live values without any other change.
//
// `device` may be null/undefined while the hook is still loading or the
// fleet is empty — each formatter returns "N/A" for missing inputs,
// so we don't need additional guards here.
function buildCircleMetrics(device) {
  return [
    {
      id: 'metric-1',
      icon: tempSensorIcon,
      iconAlt: 'Temperature sensor icon',
      value: formatTemperature(device?.temperature_c),
      label: 'Current Air Temperature',
      gustLabel: 'Humidity:',
      // Humidity isn't on the DeviceRead schema (see services/schemas/
      // device.js); placeholder until backend lands the field.
      gustValue: 'N/A'
    },
    {
      id: 'metric-2',
      icon: rainSensorIcon,
      iconAlt: 'Rain sensor icon',
      value: formatTodaysRainfall(device?.rainfall_today_mm),
      label: "Today's Rainfall"
    },
    {
      id: 'metric-3',
      icon: windSensorIcon,
      iconAlt: 'Wind sensor icon',
      // Wind direction isn't on DeviceRead yet — em-dash placeholder
      // reads as "value unavailable" without implying a specific
      // direction. Same forward-compat plan as humidity above.
      direction: '—',
      value: formatWindSpeed(device?.wind_speed),
      label: 'Current Windspeed',
      gustLabel: 'Gust:',
      gustValue: 'N/A'
    }
  ];
}

export default function SensorMeasurements() {
  const [timeRange, setTimeRange] = useState('Last 24 hours');
  const [chartLayout, setChartLayout] = useState('row');
  const chartCards = useMemo(() => sensorMeasurementCharts, []);

  // Map-view toggle — mirrors the same pattern used in
  // sections/wireless-sensors/sensor-network.jsx so the affordance
  // reads the same on both pages. When true, the circles + chart panel
  // are replaced by the MapView component (same component the
  // wireless-sensors page uses, so soil-probe / sensor-info dialogs
  // stay consistent with what users already know).
  //
  // The hover state is tracked separately so the icon can swap between
  // its active / inactive variants on pointer + focus — matches the
  // hover-swap behavior on the sensor-network map button.
  const [isMapView, setIsMapView] = useState(false);
  const [isMapToggleHovered, setIsMapToggleHovered] = useState(false);

  // Info-card state for MapView's sensor / soil-data toggle. Lives in
  // a hook so we don't have to thread four setters through props.
  // Hook is called unconditionally (React rules-of-hooks) even when
  // the map view isn't open — the state cost is negligible and it
  // means switching INTO map view doesn't lose previously-selected
  // soil-probe context across toggles.
  const { infoCardMode, setInfoCardMode, selectedSoilProbe, setSelectedSoilProbe } = useInfoCard();

  // Icon variant for the map toggle button. Four visual states organized
  // around two axes (which view is open × pointer/focus hover):
  //
  //   NOT in map view:
  //     - hovered    → mapIconActive    (tinted map icon)
  //     - resting    → mapIconInactive  (quiet map icon)
  //   IN map view:
  //     - hovered    → phenodeFleetIconActive   (tinted "go back to fleet" icon)
  //     - resting    → phenodeFleetIcon         (quiet "go back to fleet" icon)
  //
  // The button never stays in a permanently-active state. When the
  // user opens the map, the icon flips to the PheNode_Fleet glyph in
  // its inactive variant — communicating "the next click goes back to
  // the fleet measurements view" — and only highlights on hover. This
  // matches the affordance pattern used in sensor-network.jsx where
  // the icon always represents the *destination* of the next click,
  // not the *current* state of the toggle.
  const mapToggleIcon = isMapView
    ? isMapToggleHovered
      ? phenodeFleetIconActive
      : phenodeFleetIcon
    : isMapToggleHovered
      ? mapIconActive
      : mapIconInactive;
  const mapToggleTooltip = isMapView ? 'Sensor Measurements' : 'Map View';

  // URL search params drive which PheNode this page is scoped to. URL
  // is the source of truth so deep links from the fleet-overview cards
  // (and bookmarks / shared links) refresh-survive without any local
  // state shimming.
  const [searchParams, setSearchParams] = useSearchParams();
  const deviceFromUrl = searchParams.get(DEVICE_PARAM);

  const { devices, isLoading: devicesLoading } = useMyDevices();

  // Most-recently-reporting PheNode — used as the fallback selection
  // when the URL doesn't carry a device id (e.g. the user navigated
  // here directly via the sidebar rather than clicking a fleet card).
  //
  // -Infinity fallback for devices that have never reported keeps
  // them from incorrectly "winning" the recency race against a peer
  // with a real last_measurement_at. Mirrors the same sort comparator
  // used in sensor-fleet-overview.jsx and FleetOverviewView's default
  // recency sort, so the "default device" surfaced here is the same
  // one that sits at the top of the fleet list.
  const defaultPhenodeId = useMemo(() => {
    if (!devices?.length) return null;
    const byRecency = [...devices].sort((a, b) => {
      const aTime = a.last_measurement_at ? new Date(a.last_measurement_at).getTime() : -Infinity;
      const bTime = b.last_measurement_at ? new Date(b.last_measurement_at).getTime() : -Infinity;
      return bTime - aTime;
    });
    return byRecency[0]?.external_device_id ?? null;
  }, [devices]);

  // Resolve the active device id, preferring the URL value but falling
  // back to the recency-default. We tolerate a URL value that no
  // longer matches any device (e.g. the user deep-linked an external_id
  // that's since been removed) by treating the unmatched case the same
  // as "no URL value" and falling through to the default.
  const activeDeviceId = useMemo(() => {
    if (deviceFromUrl) {
      const exists = devices?.some((d) => d.external_device_id === deviceFromUrl);
      if (exists) return deviceFromUrl;
    }
    return defaultPhenodeId;
  }, [deviceFromUrl, devices, defaultPhenodeId]);

  // If the URL referenced a device that no longer exists in the fleet,
  // clean the param out of the URL so back/forward + reload don't keep
  // pointing at a phantom selection. We only clear the param — other
  // unrelated params (e.g. future filters) stay in place.
  //
  // Guard against running during the initial loading window when
  // devices is still undefined; the "doesn't exist" check would
  // spuriously fire and wipe a perfectly valid deep link.
  useEffect(() => {
    if (!devices) return;
    if (!deviceFromUrl) return;
    const exists = devices.some((d) => d.external_device_id === deviceFromUrl);
    if (!exists) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(DEVICE_PARAM);
          return next;
        },
        { replace: true }
      );
    }
  }, [devices, deviceFromUrl, setSearchParams]);

  // Find the active DeviceRead for the resolved id. Null while the
  // hook is still loading — buildCircleMetrics handles that case by
  // rendering "N/A" in each circle.
  const activeDevice = useMemo(() => {
    if (!devices || !activeDeviceId) return null;
    return devices.find((d) => d.external_device_id === activeDeviceId) ?? null;
  }, [devices, activeDeviceId]);

  // PheNode dropdown change → write to URL. We don't mirror this into
  // local state because the URL is already the source of truth — the
  // next render reads the new value back out of searchParams.
  //
  // replace:false (default) so the dropdown action is a real history
  // entry. Back button takes the user to the previously-selected device.
  const handlePhenodeChange = useCallback(
    (nextDeviceId) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextDeviceId) {
          next.set(DEVICE_PARAM, nextDeviceId);
        } else {
          next.delete(DEVICE_PARAM);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  // The three circles' content is fully derived from the active
  // device. useMemo so the array reference is stable across renders
  // when activeDevice hasn't changed — prevents the .map() below from
  // remounting <Box> children unnecessarily.
  const circleMetrics = useMemo(() => buildCircleMetrics(activeDevice), [activeDevice]);

  // Formatted "Last Measurements Taken" string for the page header.
  // Uses the shared transform (returns "Never" for null,
  // "Unknown" for an unparseable string) so this page surfaces the
  // same vocabulary as the fleet cards.
  const lastMeasurementsDisplay = activeDevice ? formatLastMeasurement(activeDevice.last_measurement_at) : '—';

  return (
    <MainCard content={false} sx={{ width: '100%', minWidth: 0, overflow: 'hidden', ...glassSurfaceSx, ...reflectedCardChromeSx }}>
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
            Sensor Measurements
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

      {/*
        Toolbar row mirroring the dropdown + map-button placement used
        on the wireless-sensors page (sections/wireless-sensors/sensor-
        network.jsx). Lives in its own Box with the same px/pt/pb
        spacing the wireless-sensors toolbar uses, so the bare
        Autocomplete + map button sit at the same vertical distance
        below the title divider on both pages.

        Layout:
          - PhenodeSelector on the LEFT (no label — the placeholder
            "Select PheNode..." carries the affordance, and the title
            row above provides the page-level context).
          - Map toggle IconButton on the RIGHT — clicking flips the
            content area between the regular measurements view
            (circles + chart panel) and the shared MapView component.
      */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 1.5, sm: 2 } }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: { xs: 1.5, sm: 2 },
            gap: 1
          }}
        >
          <PhenodeSelector
            devices={devices}
            selectedDeviceId={activeDeviceId}
            onChange={handlePhenodeChange}
            isLoading={devicesLoading}
            label={null}
          />

          <Tooltip title={mapToggleTooltip} arrow={false} slotProps={tooltipSlotProps}>
            <IconButton
              aria-label={isMapView ? 'show sensor measurements' : 'show map view'}
              onClick={() => setIsMapView((prev) => !prev)}
              // Hover state on pointer + focus — keyboard navigation
              // gets the same icon swap as a mouse hover would, so the
              // affordance is consistent for keyboard users.
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
              {/*
                Image-based icon (not an icon-font glyph) so the SVG's
                own colors render — the active variant is a tinted
                green and the inactive variant is the muted blue,
                matching the same swap used on sensor-network's
                map button.
              */}
              <Box component="img" src={mapToggleIcon} alt="" sx={{ width: 21, height: 21 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/*
        Content area — gates on isMapView. When the map toggle is on,
        we render the shared MapView component instead of the regular
        circles + chart panel. We don't unmount the regular view by
        toggling display; we conditionally render the whole branch so
        the chart components don't try to lay out while hidden (which
        causes MUI x-charts to compute size against a zero-height box
        on first reveal).
      */}
      {isMapView ? (
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
          <MapView
            infoCardMode={infoCardMode}
            setInfoCardMode={setInfoCardMode}
            selectedSoilProbe={selectedSoilProbe}
            setSelectedSoilProbe={setSelectedSoilProbe}
          />
        </Box>
      ) : (
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            overflowX: { xs: 'auto', md: 'hidden' },
            pb: 1.25,
            mb: { xs: 2.5, sm: 3 },
            '&::-webkit-scrollbar': {
              height: '10px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 68, 143, 0.8)'
            }
          }}
        >
          <Stack direction="row" spacing={2.5} sx={{ minWidth: { xs: 930, md: 'auto' } }}>
            {circleMetrics.map((metric) => (
              <Box key={metric.id} sx={{ flex: 1, minWidth: 290, display: 'flex', justifyContent: 'center' }}>
                <Box
                  sx={{
                    width: { xs: 290, sm: 300, md: 315 },
                    height: { xs: 290, sm: 300, md: 315 },
                    borderRadius: '50%',
                    backgroundColor: '#00143642',
                    backgroundImage:
                      'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.06), rgba(255,255,255,0.01) 38%, transparent 55%)',
                    boxShadow: `
      inset -12px 0 18px rgba(0, 0, 0, 0.22),
      inset -24px 0 30px rgba(0, 20, 54, 0.28),
      inset 1px 4px 5px rgba(0, 0, 0, 0.2)
    `,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 1.1
                  }}
                >
                  <Box
                    component="img"
                    src={metric.icon}
                    alt={metric.iconAlt}
                    sx={{
                      width: metric.id === 'metric-1' ? { xs: 68, sm: 74, md: 80 } : { xs: 78, sm: 84, md: 90 },
                      height: metric.id === 'metric-1' ? { xs: 68, sm: 74, md: 80 } : { xs: 78, sm: 84, md: 90 },
                      border: 'none',
                      objectFit: 'contain'
                    }}
                  />
                  {metric.direction && (
                    <Typography variant="caption" sx={{ color: 'var(--blue)', fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1 }}>
                      {metric.direction}
                    </Typography>
                  )}
                  <Typography
                    variant="h1"
                    sx={{
                      color: 'var(--green)',
                      lineHeight: 1,
                      fontWeight: 300,
                      fontSize: { xs: '3.2rem', sm: '3.4rem', md: '3.7rem' },
                      textShadow: '0 1px 9px #1a75e0c9'
                    }}
                  >
                    {metric.value}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{ color: 'var(--blue)', textAlign: 'center', fontSize: { xs: '1rem', sm: '1.05rem' } }}
                  >
                    {metric.label}
                  </Typography>
                  {metric.gustLabel && metric.gustValue && (
                    <Typography variant="subtitle2" sx={{ textAlign: 'center', color: 'var(--blue)' }}>
                      <Box component="span">{metric.gustLabel}</Box>
                      <Box component="span" sx={{ color: 'var(--green)', ml: 0.75 }}>
                        {metric.gustValue}
                      </Box>
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            borderRadius: 1,
            p: { xs: 1.5, sm: 2 },
            ...reflectedCardChromeSx,
            backgroundColor: 'var(--drf)',
            backgroundImage: 'none',
            boxShadow: '0 14px 26px rgba(1, 13, 50, 1)'
          }}
        >
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h5" sx={{ color: 'var(--blue)' }}>
              Measurements Over Time
            </Typography>
            <Tooltip
              title="Orientation"
              arrow={false}
              slotProps={tooltipSlotProps}
            >
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
                displayEmpty
                sx={{
                  color: 'var(--green)',
                  border: '1px solid var(--reflected-light)',
                  borderRadius: 1,
                  backgroundColor: 'var(--drf)',
                  boxShadow: '0 11px 19px 1px #0000002e',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-select': { color: 'var(--green)' },
                  '& .MuiSelect-icon': { color: 'var(--blue)' }
                }}
                MenuProps={{
                  PaperProps: neonSelectMenuPaperProps
                }}
                renderValue={(selected) => (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <ClockCircleOutlined style={{ color: 'var(--blue)' }} />
                    <Box component="span" sx={{ color: 'var(--green)' }}>
                      {selected || 'Select Time Range...'}
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

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns:
                chartLayout === 'row' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } : '1fr'
            }}
          >
            {chartCards.map((chart) => {
              const minVal = Math.min(...chart.data);
              const maxVal = Math.max(...chart.data);
              const pad = Math.max(0.1, (maxVal - minVal) * 0.04);

              return (
                <Box
                  key={chart.title}
                  sx={{
                    borderRadius: 1,
                    p: { xs: 0.45, sm: 0.65 },
                    minHeight: { xs: 260, sm: 286 },
                    display: 'flex',
                    flexDirection: 'column',
                    ...reflectedCardChromeSx,
                    ...chartSurfaceSx,
                    border: '1px solid #0e346a'
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                    <Typography variant="subtitle1" sx={{ color: 'var(--blue)', ml: 1.25 }}>
                      {chart.title}
                    </Typography>
                    <IconButton aria-label={`zoom ${chart.title}`} size="small" sx={{ color: 'var(--blue)' }}>
                      <ZoomInOutlined />
                    </IconButton>
                  </Stack>

                  <LineChart
                    xAxis={[
                      {
                        id: `${chart.title}-x`,
                        scaleType: 'point',
                        data: chartTimeLabels,
                        tickLabelInterval: (_, index) => index === 0 || index === chartTimeLabels.length - 1 || index % 4 === 0,
                        tickLabelStyle: { fontSize: 11, fill: 'var(--green)' }
                      }
                    ]}
                    yAxis={[
                      {
                        id: `${chart.title}-y`,
                        min: minVal - pad,
                        max: maxVal + pad,
                        width: 30,
                        tickLabelStyle: { fill: 'var(--green)' },
                        valueFormatter: (value) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`)
                      }
                    ]}
                    series={[
                      {
                        id: `${chart.title}-line`,
                        data: chart.data,
                        color: chart.lineColor,
                        area: true,
                        showMark: false,
                        curve: 'linear'
                      }
                    ]}
                    grid={{ horizontal: true, vertical: true }}
                    height={chartLayout === 'row' ? 228 : 258}
                    margin={{ top: 2, right: 16, bottom: 10, left: 10 }}
                    hideLegend
                    sx={{
                      width: '100%',
                      overflow: 'visible',
                      '& .MuiChartsSurface-root': {
                        overflow: 'visible'
                      },
                      '& .MuiChartsGrid-line': {
                        stroke: 'var(--blue)',
                        strokeOpacity: 0.38,
                        strokeWidth: 0.65
                      },
                      '& .MuiLineElement-root': {
                        strokeWidth: 0.95,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        filter: `drop-shadow(0 0 8px ${chart.lineColor})`
                      },
                      '& .MuiAreaElement-root': {
                        fillOpacity: 0.16
                      },
                      '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
                        stroke: 'rgba(232, 232, 232, 0.45)'
                      },
                      '& .MuiChartsAxis-tickLabel': {
                        fill: 'var(--green)',
                        fontWeight: 600
                      },
                      '& .MuiChartsAxis-left .MuiChartsAxis-line, & .MuiChartsAxis-bottom .MuiChartsAxis-line': {
                        stroke: 'rgba(232, 232, 232, 0.55)'
                      },
                      background: 'transparent',
                      borderRadius: 1
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
      )}
    </MainCard>
  );
}
