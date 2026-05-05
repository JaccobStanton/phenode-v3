// Placeholder — wireless-sensor transformers shelved until the backend
// ships a richer /api/wireless-sensors/my-sensors response.
//
// Plan: when WirelessSensorListItem is extended to mirror DeviceRead
// (carrying last_measurement_at, health_status, battery_percent,
// soil_moisture, soil_temperature_c, rssi server-side), a transformer
// `wirelessSensorToFleetRow(sensor)` will live here — analogous to
// `deviceReadToFleetRow` in ./device.js. Container code in
// sections/fleet-overview/sensor-fleet-overview.jsx will then map
// useMyWirelessSensors() output through it.
//
// This file is otherwise empty and safe to delete:
//
//     rm src/utils/transforms/wirelessSensor.js
//
// (The sandbox couldn't unlink it on the macOS-mounted volume, hence
// this stub.)

export {};
