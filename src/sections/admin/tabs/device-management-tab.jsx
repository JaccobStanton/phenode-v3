import { useMemo, useState } from 'react';

// material-ui
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// project imports
import useAuth from 'hooks/useAuth';
import { useToast } from 'providers/ToastProvider';
import { useAdminDevices, useAdminUsers, useAdminWirelessSensors } from 'hooks/data/useAdminData';
import {
  adminAssignDevice,
  adminUnassignDevice,
  adminCreateDevice,
  adminCreateWirelessSensor,
  adminLinkWirelessSensor,
  adminUnlinkWirelessSensor
} from 'services/mutations';
import {
  themedTextFieldSx,
  themedSelectSx,
  themedDropdownMenuProps,
  primaryActionButtonSx,
  formPanelSx,
  sectionTitleSx,
  imagingTableContainerSx,
  imagingTableHeadRowSx,
  imagingTableBodyRowSx,
  imagingTableCellSx
} from '../shared';
import {
  LabeledField,
  TableSearch,
  SearchableSelect,
  CountModalCell,
  CollapsibleCard,
  PaginationFooter,
  usePaginatedRows
} from '../components';

// assets
import AntIcon from 'components/AntIcon';
import LinkOutlined from '@ant-design/icons-svg/lib/asn/LinkOutlined';
import InfoCircleOutlined from '@ant-design/icons-svg/lib/asn/InfoCircleOutlined';
import DeleteOutlined from '@ant-design/icons-svg/lib/asn/DeleteOutlined';
import { tooltipSlotProps } from 'themes/sx-tokens';

// =============================================================================
// DeviceManagementTab — register PheNodes + wireless sensors, set a device's
// primary sensor, assign devices to users.
// =============================================================================
//
//   - Add PheNode          → POST /admin/devices                 (adminCreateDevice)
//   - Add Wireless Sensor  → POST /admin/wireless-sensors         (adminCreateWirelessSensor)
//   - Set Primary Sensor   → POST /admin/devices/{id}/wireless-sensors (adminLinkWirelessSensor)
//   - PheNode Devices table → GET /admin/devices                 (useAdminDevices)
//   - Wireless Sensors table → GET /admin/wireless-sensors        (useAdminWirelessSensors)
//
// Table declutter: any column that holds a LIST (connected sensors, primary
// sensor, assigned users, rename history) renders a clickable "# items" count
// (CountModalCell) that opens a project-themed modal with the full list — so
// the rows stay compact. Both tables sit in a solid imaging-style Card, use the
// EXACT imaging table chrome, and paginate at 10 rows/page.

const containsQuery = (value, query) =>
  String(value || '')
    .toLowerCase()
    .includes(query);

// Destructive (Remove) button — red outline, critical hover.
const dangerButtonSx = {
  color: 'var(--red)',
  borderColor: 'var(--red)',
  backgroundColor: 'rgba(0, 20, 61, 0.72)',
  boxShadow: '0 11px 19px 1px #0000002e',
  transition: 'none',
  textTransform: 'none',
  '&:hover': {
    borderColor: 'var(--critical)',
    color: 'var(--critical)',
    boxShadow: '0 0 7px -5px var(--critical)',
    backgroundColor: 'rgba(255, 72, 75, 0.08)'
  }
};

// Inline remove icon-button (next to the "# primary" count) — project-themed:
// blue at rest, red on hover, no hover background.
const removeIconButtonSx = {
  color: 'var(--blue)',
  p: 0.25,
  fontSize: '0.95rem',
  transition: 'color 0.18s ease',
  '&:hover': { color: 'var(--red)', backgroundColor: 'transparent' },
  '&:focus-visible': { color: 'var(--red)', outline: 'none' }
};

// Rename-history list (rendered inside the Rename History modal).
function RenameHistoryList({ history }) {
  const rows = Array.isArray(history) ? history : [];
  return (
    <Stack spacing={1}>
      {rows.map((entry) => (
        <Box
          key={entry.id}
          sx={{ border: '1px solid var(--reflected-light)', borderRadius: 1, p: 0.75, backgroundColor: 'rgba(4, 71, 138, 0.18)' }}
        >
          <Typography sx={{ display: 'block', color: 'var(--green)', fontSize: '0.82rem' }}>
            {(entry.old_label || 'Unlabeled') + ' → ' + (entry.new_label || 'Unlabeled')}
          </Typography>
          <Typography sx={{ display: 'block', color: 'var(--blue)', fontSize: '0.72rem', opacity: 0.8 }}>
            {entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Unknown time'}
            {entry.changed_by_email ? ` by ${entry.changed_by_email}` : ''}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

// Cell: connected (physical) wireless sensors → "# connected" → modal list.
function ConnectedSensorsCell({ device }) {
  const list = Array.isArray(device.wireless_sensors) ? device.wireless_sensors : [];
  const aliases = Array.isArray(device.gateway_aliases) ? device.gateway_aliases : [];
  return (
    <CountModalCell count={list.length} label={`${list.length} connected`} title="Connected Wireless Sensors" emptyLabel="None">
      <Stack spacing={1}>
        {list.map((s) => (
          <Typography key={s.id} sx={{ color: 'var(--green)', fontSize: '0.85rem' }}>
            {s.label || s.external_sensor_id}{' '}
            <Box component="span" sx={{ color: 'var(--blue)', opacity: 0.8 }}>
              ({s.external_sensor_id})
            </Box>
          </Typography>
        ))}
        {aliases.length > 0 && (
          <Typography sx={{ color: 'var(--blue)', fontSize: '0.75rem', opacity: 0.8 }}>Gateway alias: {aliases.join(', ')}</Typography>
        )}
      </Stack>
    </CountModalCell>
  );
}

// Cell: primary (virtual) sensor → "# primary" with an inline themed remove
// icon (clears the primary directly, no modal needed). The modal still lists
// the sensor(s) with a Remove button each.
function PrimarySensorCell({ device, onClear }) {
  const list = Array.isArray(device.virtual_wireless_sensors) ? device.virtual_wireless_sensors : [];
  const modal = (
    <CountModalCell count={list.length} label={`${list.length} primary`} title="Primary Sensor" emptyLabel="None">
      <Stack spacing={1}>
        {list.map((s) => (
          <Stack key={s.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
            <Typography sx={{ color: 'var(--green)', fontSize: '0.85rem' }}>
              {(s.label || s.external_sensor_id) + ` (${s.external_sensor_id})`}
            </Typography>
            <Button variant="outlined" size="small" onClick={() => onClear(device.id, s.id)} sx={dangerButtonSx}>
              Remove
            </Button>
          </Stack>
        ))}
      </Stack>
    </CountModalCell>
  );

  // No primary set → just the "None" text (CountModalCell handles it).
  if (list.length === 0) return modal;

  // Primary set → count link + an inline remove icon with a themed tooltip.
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
      {modal}
      <Tooltip title="Remove primary" arrow={false} slotProps={tooltipSlotProps}>
        <IconButton size="small" aria-label="Remove primary" onClick={() => onClear(device.id, list[0].id)} sx={removeIconButtonSx}>
          <AntIcon icon={DeleteOutlined} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

// Cell: assigned users → "# users" → modal list of emails.
function AssignedUsersCell({ sensor }) {
  const list = Array.isArray(sensor.assigned_users) ? sensor.assigned_users : [];
  return (
    <CountModalCell
      count={list.length}
      label={`${list.length} ${list.length === 1 ? 'user' : 'users'}`}
      title="Assigned Users"
      emptyLabel="Unassigned"
    >
      <Stack spacing={0.75}>
        {list.map((u) => (
          <Typography key={u.id} sx={{ color: 'var(--green)', fontSize: '0.85rem' }}>
            {u.email}
          </Typography>
        ))}
      </Stack>
    </CountModalCell>
  );
}

// Cell: rename history → "# previous names" → modal list.
function RenameHistoryCell({ history }) {
  const rows = Array.isArray(history) ? history : [];
  return (
    <CountModalCell
      count={rows.length}
      label={`${rows.length} ${rows.length === 1 ? 'previous name' : 'previous names'}`}
      title="Rename History"
      emptyLabel="No previous names"
    >
      <RenameHistoryList history={rows} />
    </CountModalCell>
  );
}

export default function DeviceManagementTab() {
  const { accessToken } = useAuth();
  const toast = useToast();

  const { devices, error: devicesError, mutate: mutateDevices } = useAdminDevices();
  const { sensors, error: sensorsError, mutate: mutateSensors } = useAdminWirelessSensors();
  const { users: allUsers } = useAdminUsers();

  // Add PheNode form.
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceLabel, setNewDeviceLabel] = useState('');
  const [newDeviceUserId, setNewDeviceUserId] = useState('');

  // Add Wireless Sensor form.
  const [newSensorId, setNewSensorId] = useState('');
  const [newSensorLabel, setNewSensorLabel] = useState('');
  const [newSensorDeviceId, setNewSensorDeviceId] = useState('');

  // Set Primary Sensor form (backed by the virtual wireless mapping).
  const [mapDeviceId, setMapDeviceId] = useState('');
  const [mapSensorId, setMapSensorId] = useState('');

  // Search state.
  const [devicesSearch, setDevicesSearch] = useState('');
  const [sensorsSearch, setSensorsSearch] = useState('');

  const filteredDevices = useMemo(() => {
    if (!Array.isArray(devices)) return [];
    const q = devicesSearch.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) => containsQuery(d.label, q) || containsQuery(d.external_device_id, q) || containsQuery(d.assigned_user?.email, q)
    );
  }, [devices, devicesSearch]);

  const filteredSensors = useMemo(() => {
    if (!Array.isArray(sensors)) return [];
    const q = sensorsSearch.trim().toLowerCase();
    if (!q) return sensors;
    return sensors.filter((s) => {
      const assigned = Array.isArray(s.assigned_users) ? s.assigned_users : [];
      return containsQuery(s.label, q) || containsQuery(s.external_sensor_id, q) || assigned.some((u) => containsQuery(u.email, q));
    });
  }, [sensors, sensorsSearch]);

  const devicesPage = usePaginatedRows(filteredDevices);
  const sensorsPage = usePaginatedRows(filteredSensors);

  // { id, label } option lists for the typeable (SearchableSelect) pickers.
  const deviceOptions = useMemo(
    () => (Array.isArray(devices) ? devices : []).map((d) => ({ id: d.id, label: d.label || d.external_device_id })),
    [devices]
  );
  const userOptions = useMemo(() => (Array.isArray(allUsers) ? allUsers : []).map((u) => ({ id: u.id, label: u.email })), [allUsers]);
  const sensorOptions = useMemo(
    () =>
      (Array.isArray(sensors) ? sensors : []).map((s) => ({
        id: s.id,
        label: `${s.label || s.external_sensor_id} (${s.external_sensor_id})`
      })),
    [sensors]
  );

  const handleCreateDevice = async () => {
    const id = newDeviceId.trim();
    if (!id) {
      toast.error('Please provide a device ID / MAC.');
      return;
    }
    if (id.toUpperCase().startsWith('WS-')) {
      toast.error('Wireless sensor IDs cannot be added as PheNode devices.');
      return;
    }
    try {
      const created = await adminCreateDevice({ externalDeviceId: id, label: newDeviceLabel }, accessToken);
      if (newDeviceUserId) {
        await adminAssignDevice(created.id, newDeviceUserId, accessToken);
      }
      toast.success('Device created successfully.');
      setNewDeviceId('');
      setNewDeviceLabel('');
      setNewDeviceUserId('');
      mutateDevices();
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Failed to create device.');
    }
  };

  const handleCreateSensor = async () => {
    const id = newSensorId.trim();
    if (!id) {
      toast.error('Please provide a wireless sensor ID.');
      return;
    }
    if (!id.toUpperCase().startsWith('WS-') || id.toUpperCase() === 'WS-') {
      toast.error('Wireless sensor IDs must start with WS- and be complete.');
      return;
    }
    try {
      await adminCreateWirelessSensor({ externalSensorId: id, label: newSensorLabel, deviceId: newSensorDeviceId }, accessToken);
      toast.success('Wireless sensor created successfully.');
      setNewSensorId('');
      setNewSensorLabel('');
      setNewSensorDeviceId('');
      mutateSensors();
      mutateDevices();
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Failed to create wireless sensor.');
    }
  };

  // Set the PheNode's primary sensor (virtual wireless mapping). Single-primary
  // enforcement: unlink any existing virtual mapping(s) before linking the new
  // one, so each PheNode has exactly one primary. No backend change.
  const handleSetPrimary = async () => {
    if (!mapDeviceId || !mapSensorId) {
      toast.error('Please select both a PheNode and a sensor.');
      return;
    }
    try {
      const device = (devices || []).find((d) => d.id === mapDeviceId);
      const existing = Array.isArray(device?.virtual_wireless_sensors) ? device.virtual_wireless_sensors : [];
      if (existing.some((s) => s.id === Number(mapSensorId))) {
        toast.error('That sensor is already the primary for this PheNode — it can’t be set twice.');
        return;
      }
      await Promise.all(
        existing.filter((s) => s.id !== Number(mapSensorId)).map((s) => adminUnlinkWirelessSensor(mapDeviceId, s.id, accessToken))
      );
      await adminLinkWirelessSensor(mapDeviceId, mapSensorId, accessToken);
      toast.success('Primary sensor set for this PheNode.');
      setMapSensorId('');
      mutateDevices();
      mutateSensors();
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Failed to set primary sensor.');
    }
  };

  // Clear a device's primary sensor (remove the virtual mapping).
  const handleClearPrimary = async (deviceId, wirelessSensorId) => {
    try {
      await adminUnlinkWirelessSensor(deviceId, wirelessSensorId, accessToken);
      toast.success('Primary sensor cleared for this PheNode.');
      mutateDevices();
      mutateSensors();
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Failed to clear primary sensor.');
    }
  };

  const handleAssign = async (deviceId, value) => {
    try {
      if (value === 'unassign') {
        await adminUnassignDevice(deviceId, accessToken);
        toast.success('Device unassigned.');
      } else {
        await adminAssignDevice(deviceId, value, accessToken);
        toast.success('Device assigned.');
      }
      mutateDevices();
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Failed to update assignment.');
    }
  };

  return (
    <Stack spacing={3}>
      {/* ----- Add PheNode ----- */}
      <Box sx={formPanelSx}>
        <Typography sx={{ ...sectionTitleSx, mb: 1.5 }}>Add PheNode (MAC/ID)</Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'flex-end' }} flexWrap="wrap" useFlexGap>
          <LabeledField label="Device ID / MAC" htmlFor="add-device-id" sx={{ flex: 1, minWidth: 200 }}>
            <TextField
              id="add-device-id"
              size="small"
              fullWidth
              placeholder="e.g. C2:9F:82:D2:51:93"
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              sx={themedTextFieldSx}
            />
          </LabeledField>
          <LabeledField label="Label (optional)" htmlFor="add-device-label" sx={{ flex: 1, minWidth: 180 }}>
            <TextField
              id="add-device-label"
              size="small"
              fullWidth
              placeholder="e.g. FVSU PheNode 001"
              value={newDeviceLabel}
              onChange={(e) => setNewDeviceLabel(e.target.value)}
              sx={themedTextFieldSx}
            />
          </LabeledField>
          <LabeledField label="User (optional)" htmlFor="add-device-user" sx={{ minWidth: 200 }}>
            <SearchableSelect
              id="add-device-user"
              placeholder="Search users…"
              options={userOptions}
              value={userOptions.find((o) => o.id === newDeviceUserId) || null}
              onChange={(opt) => setNewDeviceUserId(opt ? opt.id : '')}
            />
          </LabeledField>
          <Button
            variant="outlined"
            onClick={handleCreateDevice}
            sx={{ ...primaryActionButtonSx, minWidth: 120, height: 40, flexShrink: 0 }}
          >
            Add Device
          </Button>
        </Stack>
      </Box>

      {/* ----- Add Wireless Sensor ----- */}
      <Box sx={formPanelSx}>
        <Typography sx={{ ...sectionTitleSx, mb: 1.5 }}>Add Wireless Sensor (WS-ID)</Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'flex-end' }} flexWrap="wrap" useFlexGap>
          <LabeledField label="Wireless Sensor ID" htmlFor="add-sensor-id" sx={{ flex: 1, minWidth: 200 }}>
            <TextField
              id="add-sensor-id"
              size="small"
              fullWidth
              placeholder="e.g. WS-0A1B2C"
              value={newSensorId}
              onChange={(e) => setNewSensorId(e.target.value)}
              sx={themedTextFieldSx}
            />
          </LabeledField>
          <LabeledField label="Label (optional)" htmlFor="add-sensor-label" sx={{ flex: 1, minWidth: 180 }}>
            <TextField
              id="add-sensor-label"
              size="small"
              fullWidth
              placeholder="e.g. North Field Teros 12"
              value={newSensorLabel}
              onChange={(e) => setNewSensorLabel(e.target.value)}
              sx={themedTextFieldSx}
            />
          </LabeledField>
          <LabeledField label="Assign PheNode (optional)" htmlFor="add-sensor-device" sx={{ minWidth: 220 }}>
            <SearchableSelect
              id="add-sensor-device"
              placeholder="Search PheNodes…"
              options={deviceOptions}
              value={deviceOptions.find((o) => o.id === newSensorDeviceId) || null}
              onChange={(opt) => setNewSensorDeviceId(opt ? opt.id : '')}
            />
          </LabeledField>
          <Button
            variant="outlined"
            onClick={handleCreateSensor}
            sx={{ ...primaryActionButtonSx, minWidth: 120, height: 40, flexShrink: 0 }}
          >
            Add Sensor
          </Button>
        </Stack>
      </Box>

      {/* ----- Set Primary Sensor (virtual wireless mapping) ----- */}
      <Box sx={formPanelSx}>
        <Typography sx={{ ...sectionTitleSx, mb: 0.5 }}>Set Primary Sensor</Typography>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.8rem', opacity: 0.85, mb: 1.5 }}>
          The primary sensor is the wireless sensor whose data appears on this PheNode&apos;s charting pages and PheNode-scoped downloads.
          Each PheNode has one primary — setting a new one replaces the current primary.
        </Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'flex-end' }} flexWrap="wrap" useFlexGap>
          <LabeledField label="PheNode" htmlFor="primary-device" sx={{ minWidth: 240 }}>
            <SearchableSelect
              id="primary-device"
              placeholder="Search PheNodes…"
              options={deviceOptions}
              value={deviceOptions.find((o) => o.id === mapDeviceId) || null}
              onChange={(opt) => setMapDeviceId(opt ? opt.id : '')}
            />
          </LabeledField>
          <LabeledField label="Primary Sensor" htmlFor="primary-sensor" sx={{ minWidth: 260 }}>
            <SearchableSelect
              id="primary-sensor"
              placeholder="Search sensors…"
              options={sensorOptions}
              value={sensorOptions.find((o) => o.id === mapSensorId) || null}
              onChange={(opt) => setMapSensorId(opt ? opt.id : '')}
            />
          </LabeledField>
          <Button
            variant="outlined"
            startIcon={<AntIcon icon={LinkOutlined} />}
            onClick={handleSetPrimary}
            sx={{ ...primaryActionButtonSx, minWidth: 120, height: 40, flexShrink: 0 }}
          >
            Set Primary
          </Button>
        </Stack>
      </Box>

      {/* ----- PheNode Devices (collapsible, default closed) ----- */}
      <CollapsibleCard title="PheNode Devices">
        {devicesError ? (
          <Alert severity="error" variant="outlined">
            Failed to load devices.
          </Alert>
        ) : !devices ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={28} sx={{ color: 'var(--green)' }} />
          </Box>
        ) : devices.length === 0 ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ color: 'var(--blue)', p: 1.5, border: '1px solid var(--reflected-light)', borderRadius: 1 }}
          >
            <AntIcon icon={InfoCircleOutlined} />
            <Typography sx={{ fontSize: '0.86rem' }}>No devices yet. They appear automatically when data arrives.</Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <TableSearch
              value={devicesSearch}
              onChange={(e) => setDevicesSearch(e.target.value)}
              placeholder="Search devices (label, external ID, assigned user)"
              maxWidth={520}
            />
            {filteredDevices.length === 0 ? (
              <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem' }}>No matching devices.</Typography>
            ) : (
              <>
                <TableContainer sx={imagingTableContainerSx}>
                  <Table stickyHeader aria-label="phenode devices">
                    <TableHead>
                      <TableRow sx={imagingTableHeadRowSx}>
                        {['Label', 'External ID', 'Assigned To', 'Wireless Sensors', 'Primary Sensor', 'Rename History', 'Action'].map(
                          (h, i) => (
                            <TableCell key={h} align={i === 0 ? 'left' : 'center'}>
                              {h}
                            </TableCell>
                          )
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {devicesPage.pageRows.map((device) => (
                        <TableRow key={device.id} hover sx={imagingTableBodyRowSx}>
                          <TableCell sx={imagingTableCellSx}>{device.label || '—'}</TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            {device.external_device_id}
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            {device.assigned_user?.email || 'Unassigned'}
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            <ConnectedSensorsCell device={device} />
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            <PrimarySensorCell device={device} onClear={handleClearPrimary} />
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            <RenameHistoryCell history={device.rename_history} />
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            <FormControl size="small" sx={{ width: 180 }}>
                              <Select
                                displayEmpty
                                value={device.assigned_user?.id || ''}
                                onChange={(e) => handleAssign(device.id, e.target.value)}
                                MenuProps={themedDropdownMenuProps}
                                sx={{
                                  ...themedSelectSx,
                                  '& .MuiSelect-select': {
                                    color: 'var(--green)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }
                                }}
                                renderValue={(selected) => {
                                  if (!selected)
                                    return (
                                      <Box component="span" sx={{ color: 'var(--blue)', opacity: 0.65 }}>
                                        Assign User
                                      </Box>
                                    );
                                  return (allUsers || []).find((u) => u.id === selected)?.email || device.assigned_user?.email || selected;
                                }}
                              >
                                <MenuItem value="unassign">Unassign</MenuItem>
                                {(allUsers || []).map((u) => (
                                  <MenuItem key={u.id} value={u.id}>
                                    {u.email}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <PaginationFooter
                  page={devicesPage.page}
                  pageCount={devicesPage.pageCount}
                  onChange={(_e, v) => devicesPage.setPage(v)}
                  shown={devicesPage.pageRows.length}
                  total={devicesPage.total}
                  noun="devices"
                />
              </>
            )}
          </Stack>
        )}
      </CollapsibleCard>

      {/* ----- Wireless Sensors (collapsible, default closed) ----- */}
      <CollapsibleCard title="Wireless Sensors">
        {sensorsError ? (
          <Alert severity="error" variant="outlined">
            Failed to load wireless sensors.
          </Alert>
        ) : !sensors ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={28} sx={{ color: 'var(--green)' }} />
          </Box>
        ) : sensors.length === 0 ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ color: 'var(--blue)', p: 1.5, border: '1px solid var(--reflected-light)', borderRadius: 1 }}
          >
            <AntIcon icon={InfoCircleOutlined} />
            <Typography sx={{ fontSize: '0.86rem' }}>Wireless sensors (WS-…) appear here as they report data.</Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <TableSearch
              value={sensorsSearch}
              onChange={(e) => setSensorsSearch(e.target.value)}
              placeholder="Search wireless sensors (label, ID, assigned user)"
              maxWidth={560}
            />
            {filteredSensors.length === 0 ? (
              <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem' }}>No matching wireless sensors.</Typography>
            ) : (
              <>
                <TableContainer sx={imagingTableContainerSx}>
                  <Table stickyHeader aria-label="wireless sensors">
                    <TableHead>
                      <TableRow sx={imagingTableHeadRowSx}>
                        {['Label', 'External ID', 'Assigned User(s)', 'Rename History', 'Last Updated'].map((h, i) => (
                          <TableCell key={h} align={i === 0 ? 'left' : 'center'}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sensorsPage.pageRows.map((sensor) => (
                        <TableRow key={sensor.id} hover sx={imagingTableBodyRowSx}>
                          <TableCell sx={imagingTableCellSx}>{sensor.label || '—'}</TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            {sensor.external_sensor_id}
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            <AssignedUsersCell sensor={sensor} />
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            <RenameHistoryCell history={sensor.rename_history} />
                          </TableCell>
                          <TableCell align="center" sx={imagingTableCellSx}>
                            {sensor.updated_at ? new Date(sensor.updated_at).toLocaleString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <PaginationFooter
                  page={sensorsPage.page}
                  pageCount={sensorsPage.pageCount}
                  onChange={(_e, v) => sensorsPage.setPage(v)}
                  shown={sensorsPage.pageRows.length}
                  total={sensorsPage.total}
                  noun="wireless sensors"
                />
              </>
            )}
          </Stack>
        )}
      </CollapsibleCard>
    </Stack>
  );
}
