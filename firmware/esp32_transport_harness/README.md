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
  - 1.3" SH1106 I2C OLED using `U8g2`
  - OLED driver `U8G2_SH1106_128X64_NONAME_F_HW_I2C`
  - OLED I2C wiring `SDA=21`, `SCL=22`
  - capacitive touch navigation input on `T0`
  - capacitive touch select input on `T4`
  - built-in LED on `GPIO 2`

Current local control behavior:

- nav tap advances menu and detail navigation
- nav hold returns home or backs out of the current flow
- select tap opens the menu from home, selects the current menu item, or advances detail pages
- select hold confirms actions on confirm screens
- `New enrollment`, `Clear Wi-Fi`, and `Factory reset` use explicit confirm screens
- the touch timing still uses roughly `200ms` debounce and `700ms` hold detection, but it is applied per touch role instead of one shared sensor path

Current OLED and LED behavior:

- the OLED shows a header/body/footer layout with a visible menu highlight, clearer detail pages, and centered confirm prompts
- runtime normal: slow heartbeat
- menu open: solid on
- enrollment-ready: repeating double pulse
- pending enrollment or Wi-Fi recovery activity: faster pulse
- runtime transition states such as `PENDING`, `READY`, `ONLINE`, and `ERROR` are surfaced on the OLED and reflected by the LED mode
- error present: repeating triple blink
- event overlays briefly override the base mode for new enrollment generation, facility Wi-Fi clear, factory reset, and newly recorded runtime errors

Current Serial observability:

- touch calibration prints the measured baseline and computed threshold for both nav and select inputs at boot
- `[UI] Screen -> ...` logs are emitted for home, menu, detail, and confirm transitions
- `[UI] Selection -> ...` logs are emitted when the menu cursor changes
- `[UI] Input -> ...` logs are emitted for nav and select tap/hold events
- `[UI] Confirm -> ...` logs are emitted for confirm entry, accept, and cancel
- `[UI] Runtime -> ...` logs are emitted for runtime phase changes such as `softap-starting`, `softap-ready`, `facility-wifi-connecting`, `facility-wifi-retrying`, and `facility-wifi-failed`
- every `New enrollment` action prints the device id, fresh bootstrap token, and full enrollment link to Serial

Bench validation checklist:

1. Confirm boot output includes separate nav and select calibration logs with baseline and threshold values.
2. Confirm the OLED boots to a readable `OLED ready` frame and the home screen stays readable during runtime transitions.
3. Confirm nav tap moves the menu cursor and detail pages, while nav hold returns home or backs out cleanly.
4. Confirm select tap opens the menu from home and activates the current menu item.
5. Confirm `New enrollment`, `Clear Wi-Fi`, and `Factory reset` each show a confirm screen before executing.
6. Confirm the OLED highlight, detail layout, and confirm prompt are readable on the SH1106 panel without flicker.
7. Confirm the LED heartbeat, menu solid-on mode, enrollment-ready double pulse, pending transition pattern, and error triple-blink behave as expected.
8. Run `New enrollment` and confirm OLED, LED overlay, `[UI]` screen/input/confirm logs, bootstrap token, and full enrollment link all update together.
9. If the board inverts the built-in LED or needs touch threshold tuning, record the adjustment before wider flashing.

For the full contract and test flow, see `docs/runbooks/esp32-transport-harness.md`.
