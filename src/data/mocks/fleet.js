// Empty — both fleet mocks are gone.
//
//   - sensorFleetRows  removed when /api/wireless-sensors/my-sensors
//                      started returning per-sensor summary fields and
//                      hooks/data/useMyWirelessSensors.js flipped to
//                      live data.
//   - phenodeFleetRows removed earlier when /api/devices/my-devices
//                      went live via hooks/data/useMyDevices.js.
//
// This file is otherwise empty and safe to delete:
//
//     rm src/data/mocks/fleet.js
//
// (The sandbox couldn't unlink it on the macOS-mounted volume, hence
// this stub — same situation as the old wirelessSensor.js transformer
// stub before it was rewritten.)

export {};
