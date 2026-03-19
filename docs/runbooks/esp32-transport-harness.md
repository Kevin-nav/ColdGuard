# ESP32 Transport Harness

This harness gives the ColdGuard app a real ESP32 target for BLE enrollment, grant verification, Wi-Fi AP handover, and `GET /api/v1/connection-test` without pulling in the full sensor stack.

## Files

- Sketch: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modules:
  - `firmware/esp32_transport_harness/src/device_state.cpp`
  - `firmware/esp32_transport_harness/src/action_ticket.cpp`
  - `firmware/esp32_transport_harness/src/ble_recovery.cpp`
  - `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Profile guidance: `docs/runbooks/firmware-profiles.md`

## Board and Core

- Board: standard ESP32 DevKit
- Tooling: Arduino IDE with Arduino-ESP32
- Flash size assumption: 4MB module
- Recommended Arduino IDE settings:
  - `Tools > Partition Scheme > No OTA (2MB APP/2MB SPIFFS)`
  - `Tools > Debug Level > None`

## Build Size Notes

The current transport harness links BLE, Wi-Fi, `WebServer`, `Preferences`, and `mbedtls` signature verification in one image. On the default `ESP32 Dev Module` partition layouts with a `1310720` byte app limit, the sketch can exceed available flash even before the full sensor stack is added.

If Arduino IDE reports:

```text
Sketch uses 1688171 bytes (...) of program storage space. Maximum is 1310720 bytes.
```

switch the partition scheme to `No OTA (2MB APP/2MB SPIFFS)` or `Huge APP (3MB No OTA/1MB SPIFFS)` before treating it as a code bug.

If the firmware keeps growing after that, the next reduction with the best payoff is migrating the BLE transport from classic ESP32 Bluedroid BLE to NimBLE, since this sketch only uses a basic GATT server and advertising flow.

The sketch only uses Arduino-ESP32 built-ins:

- `BLEDevice`
- `WiFi`
- `WebServer`
- `Preferences`
- `mbedtls`

## BLE Contract

Production direction:

- BLE is the provisioning and recovery transport
- Wi-Fi is the runtime transport for connection tests and normal device traffic
- do not add routine production telemetry exchange over BLE unless the product explicitly needs a fallback mode

### UUIDs

- Service UUID: `6B8F7B61-8B30-4A70-BD9A-44B4C1D7C110`
- Command characteristic: `6B8F7B61-8B30-4A70-BD9A-44B4C1D7C111`
- Response characteristic: `6B8F7B61-8B30-4A70-BD9A-44B4C1D7C112`

### Advertisement service data

```text
id=<deviceId>;state=<blank|enrolled>;pv=1
```

### Commands

- `hello`
- `enroll.begin`
- `enroll.commit`
- `grant.verify`
- `wifi.ticket.request`
- `device.decommission`

All BLE payloads are JSON strings written to the command characteristic. All responses are JSON strings notified on the response characteristic.

## Security Model

Current harness behavior:

- expects an `actionTicket` object for `enroll.begin`, `grant.verify`, and `device.decommission`
- validates:
  - `v`
  - `ticketId`
  - `deviceId`
  - `institutionId`
  - `action`
  - `issuedAt`
  - `expiresAt`
  - `counter`
  - `mac`
- recomputes the ticket MAC locally and rejects mismatched or replayed control state
- still requires the existing handshake proof tied to `deviceNonce`, `deviceId`, and `proofTimestamp`

Reference:

- the target ticket model is documented in `docs/plans/2026-03-11-device-action-ticket-spec.md`
- the current harness uses a shared harness master key for local verification and should be treated as transitional until per-device secret provisioning is in place

### Handshake proof

The app must send:

- `handshakeProof`
- `proofTimestamp`

The ESP32 verifies:

```text
HMAC_SHA256_HEX(handshakeToken, deviceNonce + "|" + deviceId + "|" + proofTimestamp)
```

`handshakeToken` is stored when the supervisor enrolls the device.

`proofTimestamp` is **not** a Unix epoch timestamp in this harness. It must be in the same
device-time domain as `hello.deviceTimeMs`, with the app deriving it from the last `hello`
response plus local elapsed time.

## Example BLE Payloads

### `hello`

```json
{
  "requestId": "req-1",
  "command": "hello"
}
```

### `enroll.begin`

```json
{
  "requestId": "req-2",
  "command": "enroll.begin",
  "deviceId": "CG-ESP32-A1B2C3",
  "bootstrapToken": "<token printed on the ESP32 serial console>",
  "institutionId": "institution-1",
  "nickname": "Cold Room Alpha",
  "handshakeToken": "clinic-secret-token",
  "actionTicket": {
    "v": 1,
    "ticketId": "ticket-1",
    "deviceId": "CG-ESP32-A1B2C3",
    "institutionId": "institution-1",
    "action": "enroll",
    "issuedAt": 1700000000000,
    "expiresAt": 1700000300000,
    "counter": 1,
    "operatorId": "firebase-user-1",
    "mac": "<ticket-mac>"
  }
}
```

### `enroll.commit`

```json
{
  "requestId": "req-3",
  "command": "enroll.commit"
}
```

### `grant.verify`

```json
{
  "requestId": "req-4",
  "command": "grant.verify",
  "deviceId": "CG-ESP32-A1B2C3",
  "actionTicket": {
    "v": 1,
    "ticketId": "ticket-2",
    "deviceId": "CG-ESP32-A1B2C3",
    "institutionId": "institution-1",
    "action": "connect",
    "issuedAt": 1700000000000,
    "expiresAt": 1700000300000,
    "counter": 2,
    "operatorId": "firebase-user-2",
    "mac": "<ticket-mac>"
  },
  "handshakeProof": "9a3381f1...",
  "proofTimestamp": 123456
}
```

### `wifi.ticket.request`

```json
{
  "requestId": "req-5",
  "command": "wifi.ticket.request"
}
```

### `device.decommission`

```json
{
  "requestId": "req-6",
  "command": "device.decommission",
  "actionTicket": {
    "v": 1,
    "ticketId": "ticket-3",
    "deviceId": "CG-ESP32-A1B2C3",
    "institutionId": "institution-1",
    "action": "decommission",
    "issuedAt": 1700000000000,
    "expiresAt": 1700000300000,
    "counter": 3,
    "operatorId": "firebase-user-1",
    "mac": "<ticket-mac>"
  },
  "handshakeProof": "9a3381f1...",
  "proofTimestamp": 123456
}
```

## Wi-Fi Contract

After `grant.verify` succeeds, `wifi.ticket.request` returns:

- `ssid`
- `password`
- `testUrl`
- `expiresInMs`

The Android bridge is expected to:

- fail the AP join after roughly 15 seconds if the ESP32 network never becomes available
- keep the process bound to the ESP32 Wi-Fi network only for the duration of the HTTP connection test
- explicitly release the bound network after success, timeout, or retry failure
- tolerate repeated connection-test attempts without leaking callbacks or stale bindings

The ESP32 starts a SoftAP and serves:

- `GET http://192.168.4.1/api/v1/connection-test`

Sample JSON shape:

```json
{
  "deviceId": "CG-ESP32-A1B2C3",
  "firmwareVersion": "cg-transport-0.1.0",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "currentTempC": 4.3,
  "batteryLevel": 91,
  "doorOpen": false,
  "mktStatus": "safe",
  "statusText": "BLE authentication and Wi-Fi handover completed.",
  "lastSeenAt": 1700000123456,
  "nickname": "Cold Room Alpha",
  "institutionId": "institution-1"
}
```

## Flash and Test

1. Open `firmware/esp32_transport_harness/esp32_transport_harness.ino` in Arduino IDE.
2. Select `ESP32 Dev Module` or your equivalent ESP32 DevKit board profile.
3. Set `Tools > Partition Scheme > No OTA (2MB APP/2MB SPIFFS)`.
4. Confirm `Tools > Debug Level > None`.
5. Flash the sketch.
6. Open Serial Monitor at `115200`.
7. Note the generated `deviceId`.
8. Note the generated `Bootstrap Token` from Serial Monitor.
9. Create the QR URL:

```text
https://coldguard.org/device/<deviceId>?claim=<bootstrapToken>&v=1
```

10. Scan from the ColdGuard app and complete the BLE enrollment flow.

## Notes for App Integration

- The app should request a larger MTU before sending grants over BLE.
- The response characteristic carries both success and error payloads.
- Wi-Fi is only started after `grant.verify` succeeds.
