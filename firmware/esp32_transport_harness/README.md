# ESP32 Transport Harness

Use `esp32_transport_harness.ino` as the local firmware target for ColdGuard BLE enrollment and Wi-Fi connection testing.

Setup notes:
- the device prints both `Device ID` and `Bootstrap Token` to Serial on boot
- the QR payload must use that printed bootstrap token, not a shared default token
- grant verification now expects ES256 tokens signed by the backend private key from `COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY_PKCS8_B64`

For the full contract and test flow, see `docs/runbooks/esp32-transport-harness.md`.
