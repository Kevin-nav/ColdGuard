# ColdGuard ESP32 App Connection Protocol Plan

## Summary
- Build an Android-first, offline-capable device flow where `Supervisor` users enroll, assign, and decommission ESP32 devices; assigned nurses can reconnect only to devices assigned to them.
- Use BLE for discovery, secure control, and session setup; use ESP32 Wi-Fi AP only after BLE auth for the handover test and later large-payload sync.
- Make Convex the source of truth for device roster, assignments, and audit events; keep SQLite as the app cache and stop treating seeded devices as the default runtime source.

## Approaches Considered
- Recommended: Hybrid BLE + Wi-Fi with QR bootstrap, signed offline access grants, and BLE-authenticated Wi-Fi handover. This matches `about_software.md`, proves both radios early, and gives a real supervisor/nurse workflow.
- Rejected: BLE-only. Simpler, but it does not validate the Wi-Fi handover you explicitly want for large payloads.
- Rejected: Wi-Fi-first onboarding. Better throughput, worse discovery/UX, and weaker fit for nearby secure enrollment.

## Protocol Design
- Each ESP32 ships with a unique `deviceId` and printed QR payload: `coldguard://device/<deviceId>?claim=<bootstrapToken>&v=1`.
- Enrollment starts from a blank device state. The QR `bootstrapToken` is the physical proof needed to claim that device offline.
- The app must hold two things to enroll: the institution handshake token already stored during onboarding, and a backend-issued signed supervisor device-admin grant cached on the phone.
- BLE enrollment flow:
  1. Supervisor scans device QR.
  2. App discovers matching BLE advertisement by ColdGuard service UUID and `deviceId`.
  3. Device sends `deviceNonce`, firmware info, and provisioning state.
  4. App opens an encrypted BLE session using the QR bootstrap token plus nonce exchange.
  5. App sends the signed supervisor grant and institution token inside that encrypted session.
  6. ESP32 verifies the signed grant with an embedded ColdGuard public key, stores institution config, and marks itself enrolled.
- Reconnect flow for already enrolled devices:
  1. Assigned supervisor or assigned nurse selects a device from the app.
  2. App connects over BLE and requests a challenge.
  3. App sends a signed per-device connection grant plus proof of institution-token possession.
  4. ESP32 validates grant signature, `deviceId`, grant version, expiry, and proof.
  5. App requests a Wi-Fi handover ticket and then performs the Android Wi-Fi AP switch.
- Wi-Fi handover design:
  - ESP32 exposes a local-only AP.
  - The app gets a short-lived Wi-Fi ticket over BLE after successful auth.
  - The Android app uses `WifiNetworkSpecifier` through a local native bridge to request connection to the ESP32 AP.
  - Once connected, the app calls a simple local HTTP endpoint such as `/api/v1/connection-test` to fetch mock payload and confirm the path works.
- Decommission flow:
  - Supervisor authenticates over BLE with an admin grant.
  - App sends decommission command.
  - ESP32 wipes institution token, Wi-Fi config, cached grant version, and returns to blank-device state.
  - Backend marks device decommissioned and invalidates old grants.

## Public APIs, Interfaces, and Types
- Convex additions:
  - `devices` table with `deviceId`, `institutionId`, `nickname`, `firmwareVersion`, `status`, `grantVersion`, `lastSeenAt`, `createdByUserId`, `decommissionedAt`.
  - `deviceAssignments` table with one active `primary` nurse and zero or more active `viewer` assignments.
  - `deviceAuditEvents` table for enroll, assign, reconnect test, and decommission history.
- Convex functions:
  - `devices.listManageableDevices`
  - `devices.listMyAssignedDevices`
  - `devices.listAssignableNurses`
  - `devices.issueSupervisorAdminGrant`
  - `devices.issueConnectionGrant`
  - `devices.registerEnrollment`
  - `devices.assignDevice`
  - `devices.decommissionDevice`
- App interfaces:
  - `ColdGuardBleClient`
  - `ColdGuardWifiBridge`
  - `ColdGuardConnectionService`
  - `ColdGuardConnectionGrant`
  - `ColdGuardDiscoveredDevice`
  - `ColdGuardWifiTicket`
- Profile/device model changes:
  - Extend linked profile responses and local profile cache to include `institutionId`, not only `institutionName`.
  - Replace the current local-only seeded device roster with backend-backed device cache plus an explicit mock mode.
  - Keep institution handshake token in SecureStore; cache signed device grants locally with expiry and grant version.

## App and Repo Changes
- Add a new device-management slice in the existing app, not a hidden lab:
  - Supervisors get `Add device`, `Assign nurses`, `Run connection test`, and `Remove device`.
  - Nurses only see assigned devices and `Reconnect/Test connection` for those devices.
- Add BLE transport and Wi-Fi bridge modules behind interfaces so tests can use mocks without hardware.
- Add a local Android native bridge for Wi-Fi connection requests; keep `expo-network` only for observing network state and IP details.
- Add a real backend-backed device list to the Devices tab and device details route.
- Remove automatic `seedDashboardDataForInstitution()` fallback from normal runtime; keep seeded data only behind explicit dev/test entry points.

## Firmware Contract
- BLE advertisement includes protocol version, device state (`blank` or `enrolled`), and `deviceId`.
- GATT service exposes command/response characteristics for:
  - `hello`
  - `enroll.begin`
  - `enroll.commit`
  - `grant.verify`
  - `wifi.ticket.request`
  - `connection.ping`
  - `device.decommission`
- Wi-Fi test server returns mock JSON now; real CSV/log transfer plugs into the same authenticated handover later.

## Test Cases and Acceptance Scenarios
- Supervisor can enroll a blank ESP32 offline by scanning QR, completing BLE auth, and registering the device in Convex.
- Supervisor can assign one primary nurse and additional viewers to the device.
- Assigned nurse can reconnect from a separate phone and complete the BLE-to-Wi-Fi connection test successfully.
- Unassigned nurse cannot obtain a connection grant and cannot start hardware connection from the UI.
- Decommissioned device wipes itself and rejects previously cached grants.
- App restart preserves cached assignments and allows reconnect if grants are still valid.
- Mock transport tests cover BLE challenge handling, grant validation state, Wi-Fi ticket flow, and decommission state transitions.

## Assumptions and Defaults
- Android-only in this slice.
- Development builds are required; Expo Go is not sufficient once BLE/native Wi-Fi modules are added.
- For this first slice, the app should always exercise Wi-Fi after successful BLE auth so the full handover is tested, even though the payload is mock.
- The offline security model proves possession of a valid ColdGuard-issued signed grant plus institution secret and device QR token. It does not prove untampered app binary identity; hardware attestation or online integrity checks are a later concern.
- Nurse assignment is enforced in backend/app grants. One primary nurse is tracked for accountability; additional assigned nurses can reconnect but cannot enroll, reassign, or decommission devices.
