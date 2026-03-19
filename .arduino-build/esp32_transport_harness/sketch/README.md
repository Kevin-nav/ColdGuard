#line 1 "C:\\Users\\Kevin\\Projects\\LabVIEW\\ColdGuard\\firmware\\esp32_transport_harness\\README.md"
# ESP32 Transport Harness

Use `esp32_transport_harness.ino` as the local firmware target for ColdGuard BLE enrollment and Wi-Fi connection testing.

Setup notes:
- the device prints both `Device ID` and `Bootstrap Token` to Serial on boot
- the QR payload must use that printed bootstrap token, not a shared default token
- local recovery commands now expect backend-issued `actionTicket` payloads instead of ES256 `grantToken` strings
- the harness currently verifies those tickets with a shared harness master key and should be treated as transitional until per-device secret provisioning is added
- the sketch is split into `src/device_state.*`, `src/action_ticket.*`, `src/ble_recovery.*`, and `src/wifi_runtime.*` so production recovery logic can evolve without growing one monolithic `.ino`
- production BLE scope should stay limited to discovery, enrollment, decommission, and Wi-Fi recovery handoff
- for Arduino IDE, use `Tools > Partition Scheme > No OTA (2MB APP/2MB SPIFFS)` on a 4MB `ESP32 Dev Module`
- keep `Tools > Debug Level > None`; the core is already built with size optimization and the current sketch can exceed the default `1310720` byte app limit

For the full contract and test flow, see `docs/runbooks/esp32-transport-harness.md`.
