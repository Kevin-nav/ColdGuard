# ESP32 Transport Harness

Use `esp32_transport_harness.ino` as the local firmware target for ColdGuard BLE enrollment and Wi-Fi connection testing.

Setup notes:
- the device prints `Device ID` and a ready-to-scan `Enrollment Link` to Serial on boot
- the raw `Bootstrap Token` remains redacted unless you explicitly enable verbose secret logging
- pairing now requires the device to be put into `New enrollment` mode from the on-device LCD menu first
- the QR payload must use the current enrollment link for that menu session, not a shared default token
- local recovery commands now expect backend-issued `actionTicket` payloads instead of ES256 `grantToken` strings
- the harness currently verifies those tickets with a shared harness master key and should be treated as transitional until per-device secret provisioning is added
- the sketch is split into `src/device_state.*`, `src/action_ticket.*`, `src/ble_recovery.*`, `src/device_ui.*`, and `src/wifi_runtime.*` so production recovery logic can evolve without growing one monolithic `.ino`
- production BLE scope should stay limited to discovery, enrollment, decommission, and Wi-Fi recovery handoff
- for Arduino IDE, use `Tools > Partition Scheme > No OTA (2MB APP/2MB SPIFFS)` on a 4MB `ESP32 Dev Module`
- keep `Tools > Debug Level > None`; the core is already built with size optimization and the current sketch can exceed the default `1310720` byte app limit
- current device UI assumptions:
  - I2C 16x2 LCD using `LiquidCrystal_I2C`
  - LCD I2C address `0x27`
  - capacitive touch input on `T0`
  - built-in LED on `GPIO 2`
  - short touch uses the tested capacitive-tap behavior with about `200ms` debounce
  - long touch uses about `700ms` hold time to open the menu or select the current action
  - the LED runs continuous mode patterns for runtime, menu, enrollment-ready, pending/recovery, and error states
  - major UI actions also print `[UI] ...` logs to Serial, including fresh enrollment links

For the full contract and test flow, see `docs/runbooks/esp32-transport-harness.md`.
