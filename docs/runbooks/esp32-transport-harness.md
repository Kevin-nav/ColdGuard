# ESP32 Transport Harness

This harness gives the ColdGuard app a real ESP32 target for BLE enrollment, grant verification, Wi-Fi AP handover, and `GET /api/v1/connection-test` without pulling in the full sensor stack.

## Files

- Sketch: `firmware/esp32_transport_harness/esp32_transport_harness.ino`

## Board and Core

- Board: standard ESP32 DevKit
- Tooling: Arduino IDE with Arduino-ESP32

The sketch only uses Arduino-ESP32 built-ins:

- `BLEDevice`
- `WiFi`
- `WebServer`
- `Preferences`
- `mbedtls`

## BLE Contract

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

### Signed grant

`verifySignedGrant()` is isolated in the sketch so the app team can replace the harness verifier later without rewriting the transport flow.

Current harness behavior:

- expects a JWT-like token:
  - `header.payload.signature`
- decodes `payload` from base64url JSON
- validates:
  - `alg`
  - `kid`
  - `iss`
  - `deviceId`
  - `institutionId`
  - `exp`
  - `permission`
  - `grantVersion`
- verifies the signature as:
  - `ES256(header + "." + payload)` using the embedded ColdGuard public key

The app-side backend must sign grants with the private key from `COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY_PKCS8_B64`. The harness no longer accepts shared-secret HS256 grants.

### Handshake proof

The app must send:

- `handshakeProof`
- `proofTimestamp`

The ESP32 verifies:

```text
HMAC_SHA256_HEX(handshakeToken, deviceNonce + "|" + deviceId + "|" + proofTimestamp)
```

`handshakeToken` is stored when the supervisor enrolls the device.

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
  "grantToken": "header.payload.signature"
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
  "grantToken": "header.payload.signature",
  "handshakeProof": "9a3381f1...",
  "proofTimestamp": 1700000123456
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
  "grantToken": "header.payload.signature",
  "handshakeProof": "9a3381f1...",
  "proofTimestamp": 1700000123456
}
```

## Wi-Fi Contract

After `grant.verify` succeeds, `wifi.ticket.request` returns:

- `ssid`
- `password`
- `testUrl`
- `expiresAt`

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
2. Select your ESP32 DevKit board and serial port.
3. Flash the sketch.
4. Open Serial Monitor at `115200`.
5. Note the generated `deviceId`.
6. Note the generated `Bootstrap Token` from Serial Monitor.
7. Create the QR URL:

```text
https://coldguard.org/device/<deviceId>?claim=<bootstrapToken>&v=1
```

8. Scan from the ColdGuard app and complete the BLE enrollment flow.

## Notes for App Integration

- The app should request a larger MTU before sending grants over BLE.
- The response characteristic carries both success and error payloads.
- Wi-Fi is only started after `grant.verify` succeeds.
