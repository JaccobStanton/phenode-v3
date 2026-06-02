import { useMemo, useState } from 'react';

// material-ui
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
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
  floatingLabelSx,
  primaryActionButtonSx,
  formPanelSx,
  sectionTitleSx,
  subSectionTitleSx,
  tableContainerSx,
  tableHeaderCellSx,
  tableCellSx
} from '../shared';

// assets
import AntIcon from 'components/AntIcon';
import LinkOutlined from '@ant-design/icons-svg/lib/asn/LinkOutlined';
import InfoCircleOutlined from '@ant-design/icons-svg/lib/asn/InfoCircleOutlined';

// =============================================================================
// DeviceManagementTab — register PheNodes + wireless sensors, map virtual
// sensors, assign devices to users.
// =============================================================================
//
// Ports the v2 AdminPage device-management logic into the V3 theme:
//   - Add PheNode               → POST /admin/devices            (adminCreateDevice)
//                                  + optional follow-up assign     (adminAssignDevice)
//   - Add Wireless Sensor       → POST /admin/wireless-sensors    (adminCreateWirelessSensor)
//   - Set Primary Sensor        → POST /admin/devices/{id}/wireless-sensors
//                                                                  (adminLinkWirelessSensor)
//   - PheNode Devices table     → GET  /admin/devices             (useAdminDevices)
//                                  + per-row assign / unassign      (adminAssignDevice / unassign)
//                                  + clear primary chip             (adminUnlinkWirelessSensor)
//   - Wireless Sensors table    → GET  /admin/wireless-sensors     (useAdminWirelessSensors)
//
// "Primary sensor": the PheNode's primary sensor IS the virtual wireless
// mapping (device_virtual_wireless_sensors) — that sensor's data is what
// appears on the device's charting pages and PheNode-scoped downloads
// (per phenode_backend/api/admin/routes.py + api/devices/routes.py:205-211).
// The backend allows several virtual mappings per device, but the product
// rule is ONE primary per PheNode, so handleSetPrimary unlinks any existing
// mapping before linking the chosen sensor (no backend change needed).
//
// Feedback flows through ToastProvider, matching the account-settings tabs.

const containsQuery = (value, query) =>
  String(value || '')
    .toLowerCase()
    .includes(query);

// Themed chip used to render linked / virtual wireless sensors in the table.
function SensorChip({ label, onDelete }) {
  return (
    <Chip
      label={label}
      size="small"
      variant="outlined"
      onDelete={onDelete}
      sx={{
        color: 'var(--green)',
        borderColor: 'var(--reflected-light)',
        fontSize: '0.72rem',
        '& .MuiChip-deleteIcon': { color: 'var(--blue)', '&:hover': { color: 'var(--red)' } }
      }}
    />
  );
}

function RenameHistory({ history }) {
  const rows = Array.isArray(history) ? history : [];
  if (rows.length === 0) {
    return <Typography sx={{ color: 'var(--blue)', fontSize: '0.76rem', opacity: 0.8 }}>No previous names</Typography>;
  }
  return (
    <Stack spacing={0.5} sx={{ minWidth: 200, maxWidth: 320 }}>
      {rows.map((entry) => (
        <Box
          key={entry.id}
          sx={{ border: '1px solid var(--reflected-light)', borderRadius: 1, p: 0.75, backgroundColor: 'rgba(4, 71, 138, 0.18)' }}
        >
          <Typography sx={{ display: 'block', color: 'var(--green)', fontSize: '0.74rem' }}>
            {(entry.old_label || 'Unlabeled') + ' → ' + (entry.new_label || 'Unlabeled')}
          </Typography>
          <Typography sx={{ display: 'block', color: 'var(--blue)', fontSize: '0.7rem', opacity: 0.8 }}>
            {entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Unknown time'}
            {entry.changed_by_email ? ` by ${entry.changed_by_email}` : ''}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function WirelessSensorCell({ sensors, aliases, deviceId, removable, countLabel, onUnlink, showCount = true, emptyLabel }) {
  const rows = Array.isArray(sensors) ? sensors : [];
  const gatewayAliases = Array.isArray(aliases) ? aliases : [];
  if (rows.length === 0) {
    return (
      <Stack spacing={0.5}>
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.78rem' }}>{emptyLabel || `0 ${countLabel}`}</Typography>
        {gatewayAliases.length > 0 && (
          <Typography sx={{ color: 'var(--blue)', fontSize: '0.7rem', opacity: 0.75 }}>
            Gateway alias: {gatewayAliases.join(', ')}
          </Typography>
        )}
      </Stack>
    );
  }
  return (
    <Stack spacing={0.5} sx={{ minWidth: 180, maxWidth: 320 }}>
      {showCount && (
        <Chip
          label={`${rows.length} ${countLabel}`}
          size="small"
          variant="outlined"
          sx={{ color: 'var(--blue)', borderColor: 'var(--reflected-light)', width: 'fit-content', fontSize: '0.72rem' }}
        />
      )}
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        {rows.map((sensor) => (
          <SensorChip
            key={sensor.id}
            label={sensor.label || sensor.external_sensor_id}
            onDelete={removable ? () => onUnlink(deviceId, sensor.id) : undefined}
          />
        ))}
      </Stack>
      {gatewayAliases.length > 0 && (
        <Typography sx={{ color: 'var(--blue)', fontSize: '0.7rem', opacity: 0.75 }}>Gateway alias: {gatewayAliases.join(', ')}</Typography>
      )}
    </Stack>
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

  // Set the PheNode's primary sensor. The "primary" sensor is the virtual
  // wireless mapping (device_virtual_wireless_sensors) — the sensor whose data
  // shows on the device's charting pages and PheNode-scoped downloads.
  //
  // Single-primary enforcement: the backend allows many virtual mappings per
  // device, but product-wise a PheNode has exactly ONE primary. So before
  // linking the chosen sensor we unlink any existing virtual mapping(s) on that
  // device (skipping the chosen one if it's somehow already mapped). Uses the
  // existing link/unlink routes — no backend change.
  const handleSetPrimary = async () => {
    if (!mapDeviceId || !mapSensorId) {
      toast.error('Please select both a PheNode and a sensor.');
      return;
    }
    try {
      const device = (devices || []).find((d) => d.id === mapDeviceId);
      const existing = Array.isArray(device?.virtual_wireless_sensors) ? device.virtual_wireless_sensors : [];
      // Already the primary — nothing to do.
      if (existing.length === 1 && existing[0].id === Number(mapSensorId)) {
        toast.success('That sensor is already the primary for this PheNode.');
        setMapSensorId('');
        return;
      }
      // Clear the current primary (any stale extras too) before setting the new one.
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
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }} flexWrap="wrap" useFlexGap>
          <TextField
            label="Device ID / MAC"
            size="small"
            value={newDeviceId}
            onChange={(e) => setNewDeviceId(e.target.value)}
            sx={{ ...themedTextFieldSx, minWidth: 200, '& .MuiInputLabel-root': floatingLabelSx }}
          />
          <TextField
            label="Label (optional)"
            size="small"
            value={newDeviceLabel}
            onChange={(e) => setNewDeviceLabel(e.target.value)}
            sx={{ ...themedTextFieldSx, minWidth: 180, '& .MuiInputLabel-root': floatingLabelSx }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel sx={floatingLabelSx}>User (optional)</InputLabel>
            <Select
              label="User (optional)"
              value={newDeviceUserId}
              onChange={(e) => setNewDeviceUserId(e.target.value)}
              sx={themedSelectSx}
              MenuProps={themedDropdownMenuProps}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {(allUsers || []).map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }} flexWrap="wrap" useFlexGap>
          <TextField
            label="Wireless Sensor ID"
            size="small"
            value={newSensorId}
            onChange={(e) => setNewSensorId(e.target.value)}
            sx={{ ...themedTextFieldSx, minWidth: 200, '& .MuiInputLabel-root': floatingLabelSx }}
          />
          <TextField
            label="Label (optional)"
            size="small"
            value={newSensorLabel}
            onChange={(e) => setNewSensorLabel(e.target.value)}
            sx={{ ...themedTextFieldSx, minWidth: 180, '& .MuiInputLabel-root': floatingLabelSx }}
          />
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel sx={floatingLabelSx}>Assign PheNode (optional)</InputLabel>
            <Select
              label="Assign PheNode (optional)"
              value={newSensorDeviceId}
              onChange={(e) => setNewSensorDeviceId(e.target.value)}
              sx={themedSelectSx}
              MenuProps={themedDropdownMenuProps}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {(devices || []).map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.label || d.external_device_id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel sx={floatingLabelSx}>PheNode</InputLabel>
            <Select
              label="PheNode"
              value={mapDeviceId}
              onChange={(e) => setMapDeviceId(e.target.value)}
              sx={themedSelectSx}
              MenuProps={themedDropdownMenuProps}
            >
              <MenuItem value="">
                <em>Select PheNode</em>
              </MenuItem>
              {(devices || []).map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.label || d.external_device_id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel sx={floatingLabelSx}>Primary Sensor</InputLabel>
            <Select
              label="Primary Sensor"
              value={mapSensorId}
              onChange={(e) => setMapSensorId(e.target.value)}
              sx={themedSelectSx}
              MenuProps={themedDropdownMenuProps}
            >
              <MenuItem value="">
                <em>Select sensor</em>
              </MenuItem>
              {(sensors || []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {(s.label || s.external_sensor_id) + ` (${s.external_sensor_id})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

      {/* ----- PheNode Devices ----- */}
      <Box>
        <Typography sx={{ ...subSectionTitleSx, mb: 1 }}>PheNode Devices</Typography>
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
            sx={{ color: 'var(--blue)', p: 1.5, border: '1px solid var(--reflected-light)', borderRadius: 1.5 }}
          >
            <AntIcon icon={InfoCircleOutlined} />
            <Typography sx={{ fontSize: '0.86rem' }}>No devices yet. They appear automatically when data arrives.</Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <TextField
              size="small"
              placeholder="Search devices (label, external ID, assigned user)"
              value={devicesSearch}
              onChange={(e) => setDevicesSearch(e.target.value)}
              sx={{ ...themedTextFieldSx, maxWidth: 520 }}
            />
            {filteredDevices.length === 0 ? (
              <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem' }}>No matching devices.</Typography>
            ) : (
              <TableContainer sx={tableContainerSx}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {['Label', 'External ID', 'Assigned To', 'Wireless Sensors', 'Primary Sensor', 'Rename History', 'Action'].map(
                        (h) => (
                          <TableCell key={h} sx={tableHeaderCellSx}>
                            {h}
                          </TableCell>
                        )
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDevices.map((device) => (
                      <TableRow key={device.id} hover>
                        <TableCell sx={tableCellSx}>{device.label || '—'}</TableCell>
                        <TableCell sx={tableCellSx}>{device.external_device_id}</TableCell>
                        <TableCell sx={tableCellSx}>{device.assigned_user?.email || 'Unassigned'}</TableCell>
                        <TableCell sx={tableCellSx}>
                          <WirelessSensorCell
                            sensors={device.wireless_sensors}
                            aliases={device.gateway_aliases}
                            deviceId={device.id}
                            countLabel="connected"
                          />
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <WirelessSensorCell
                            sensors={device.virtual_wireless_sensors}
                            aliases={[]}
                            deviceId={device.id}
                            removable
                            showCount={false}
                            emptyLabel="None"
                            countLabel="primary"
                            onUnlink={handleClearPrimary}
                          />
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <RenameHistory history={device.rename_history} />
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <FormControl size="small" sx={{ minWidth: 170 }}>
                            <InputLabel sx={floatingLabelSx}>Assign User</InputLabel>
                            <Select
                              label="Assign User"
                              value={device.assigned_user?.id || ''}
                              onChange={(e) => handleAssign(device.id, e.target.value)}
                              sx={themedSelectSx}
                              MenuProps={themedDropdownMenuProps}
                            >
                              <MenuItem value="">
                                <em>Select…</em>
                              </MenuItem>
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
            )}
          </Stack>
        )}
      </Box>

      {/* ----- Wireless Sensors ----- */}
      <Box>
        <Typography sx={{ ...subSectionTitleSx, mb: 1 }}>Wireless Sensors</Typography>
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
            sx={{ color: 'var(--blue)', p: 1.5, border: '1px solid var(--reflected-light)', borderRadius: 1.5 }}
          >
            <AntIcon icon={InfoCircleOutlined} />
            <Typography sx={{ fontSize: '0.86rem' }}>Wireless sensors (WS-…) appear here as they report data.</Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <TextField
              size="small"
              placeholder="Search wireless sensors (label, ID, assigned user)"
              value={sensorsSearch}
              onChange={(e) => setSensorsSearch(e.target.value)}
              sx={{ ...themedTextFieldSx, maxWidth: 560 }}
            />
            {filteredSensors.length === 0 ? (
              <Typography sx={{ color: 'var(--blue)', fontSize: '0.85rem' }}>No matching wireless sensors.</Typography>
            ) : (
              <TableContainer sx={tableContainerSx}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {['Label', 'External ID', 'Assigned User(s)', 'Rename History', 'Last Updated'].map((h) => (
                        <TableCell key={h} sx={tableHeaderCellSx}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSensors.map((sensor) => (
                      <TableRow key={sensor.id} hover>
                        <TableCell sx={tableCellSx}>{sensor.label || '—'}</TableCell>
                        <TableCell sx={tableCellSx}>{sensor.external_sensor_id}</TableCell>
                        <TableCell sx={tableCellSx}>
                          {Array.isArray(sensor.assigned_users) && sensor.assigned_users.length > 0
                            ? sensor.assigned_users.map((u) => u.email).join(', ')
                            : 'Unassigned'}
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <RenameHistory history={sensor.rename_history} />
                        </TableCell>
                        <TableCell sx={tableCellSx}>{sensor.updated_at ? new Date(sensor.updated_at).toLocaleString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
