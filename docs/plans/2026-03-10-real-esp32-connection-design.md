# ColdGuard Real ESP32 Connection Design

**Date:** 2026-03-10

## Goal

Replace the current app-side mock hardware path with a production-shaped Android flow that uses:

- real QR entry from `coldguard.org`
- real in-app QR scanning with camera permissions
- real BLE discovery and command exchange with an ESP32 DevKit
- real Wi-Fi AP handover and HTTP verification
- real signed grants plus institution-secret proof

The ESP32 firmware remains transport-only for this slice. It does not include sensors, SD logging, or OLED logic.

## Product Decisions

- Platform target is Android only for this first real-device slice.
- The app requires an Expo development build, not Expo Go.
- The printed device QR should use:
  - `https://coldguard.org/device/<deviceId>?claim=<bootstrapToken>&v=1`
- Scanning that QR with the normal camera should open ColdGuard directly when installed.
- If the user is signed out, the app should preserve the pending device payload and resume after auth.
- If the user is not a `Supervisor`, the app should show an explicit access-denied screen.
- If the app is not installed, `coldguard.org` should show a landing page with install and open-app actions.

## App Architecture

### QR and Deep Link Entry

- Add Android App Links for `coldguard.org`.
- Add a dedicated enrollment route that accepts the device deep-link payload.
- Add an in-app QR scanner that requests camera permission only when opened.
- Keep manual payload entry only as a fallback for denied permission or debugging.

### Real BLE Transport

- Replace the current mock BLE client default path with a real BLE transport implementation.
- The app scans for the ColdGuard service UUID, matches `deviceId`, connects, and exchanges JSON command/response payloads.
- BLE is used for:
  - discovery
  - enrollment metadata exchange
  - signed grant verification request
  - Wi-Fi ticket request
  - decommission command

### Real Wi-Fi Handover

- After BLE verification, the app requests a Wi-Fi ticket from the ESP32.
- Android joins the ESP32 SoftAP via a native bridge using `WifiNetworkSpecifier`.
- The app calls `http://192.168.4.1/api/v1/connection-test` and renders the returned JSON result.

### Failure Reporting

- The UI must surface the exact failed stage:
  - QR parse
  - camera permission
  - BLE scan
  - BLE auth
  - AP join
  - HTTP test

## Security Model

### Signed Grant

- Backend issues a short-lived signed grant with fields such as:
  - `iss`
  - `sub`
  - `deviceId`
  - `institutionId`
  - `scope`
  - `grantVersion`
  - `exp`
  - `role`
- ESP32 stores a ColdGuard public key and verifies the signature locally.
- Recommended format is ES256/JWS.

### Institution Proof

- The app also proves possession of the clinic handshake token using:
  - `HMAC-SHA256(handshakeToken, deviceNonce || deviceId || timestamp)`
- ESP32 stores the handshake token during enrollment and verifies it on reconnect.

### Enrollment

- Supervisor app uses the printed bootstrap token plus a signed admin grant.
- Bootstrap tokens must be unique per device and regenerated when the harness returns to blank state.
- ESP32 verifies the signed admin grant, stores institution data, stores the handshake token, and marks itself enrolled.

### Reconnect

- App sends a signed connection grant and HMAC proof.
- ESP32 verifies signature, scope, expiry, version, `deviceId`, `institutionId`, and HMAC before issuing a Wi-Fi ticket.

## ESP32 Test Firmware Scope

The `.ino` test harness must provide:

- BLE advertisement with protocol metadata
- BLE command/response characteristics
- NVS-backed enrollment state
- SoftAP startup
- HTTP `/api/v1/connection-test` endpoint
- signed-grant verification hook
- institution-secret HMAC verification
- decommission wipe and reboot path

The firmware intentionally excludes:

- temperature sensors
- SD logging
- OLED output
- door sensor logic
- battery telemetry integration

## Website / No-App Flow

- `coldguard.org/device/:deviceId` should act as the QR landing page.
- If the app is installed, Android App Links should open the app directly.
- If the app is missing, the page shows:
  - device ID
  - install action
  - open app action after install
- The original `claim` and `deviceId` must remain preserved in the URL.

## Acceptance Criteria

- Supervisor can scan the printed QR with either the normal camera or the in-app scanner.
- Deep link opens directly into the supervisor enrollment flow.
- Signed-out users resume the device flow after login.
- Non-supervisors are blocked inside the app.
- App discovers the ESP32 over BLE and completes enrollment.
- App requests a Wi-Fi ticket, joins the ESP32 AP, and calls `/api/v1/connection-test`.
- Connection test result comes from the real ESP32 HTTP endpoint.
- Decommission returns the ESP32 to the blank state.
- No app-side mock hardware path is used in the production connection flow.
