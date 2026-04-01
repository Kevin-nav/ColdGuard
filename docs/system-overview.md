# ColdGuard System Overview

## Purpose

ColdGuard is a cold-chain monitoring system for vaccine and medicine storage. The current repository contains:

- a mobile application built with Expo and React Native
- a Convex backend for institutions, users, devices, assignments, and incidents
- an Android native bridge for BLE, Wi-Fi, and background monitoring
- ESP32 firmware and a transport harness used to exercise enrollment, connectivity, and runtime monitoring flows
- a small Next.js web app in `coldguard-web/` for public/legal pages

The product goal is simple: let a clinic staff member enroll a device, connect to it securely in the field, monitor runtime state, and surface incidents even when connectivity is unreliable.

## System At A Glance

```text
ColdGuard user
  -> signs in with Firebase Auth
  -> links to an institution through Convex
  -> receives device roster / grants / tickets from Convex
  -> uses the mobile app to talk to the ESP32

Mobile app
  -> BLE for discovery, enrollment, lease ownership, and SoftAP recovery
  -> Wi-Fi / SoftAP HTTP for runtime status, alerts, and connection tests
  -> SQLite for cached profile, devices, monitoring state, and notifications
  -> SecureStore for the clinic handshake token and monitoring client identity

Convex backend
  -> source of truth for institutions, users, devices, assignments, audit events, and notification incidents
  -> issues signed grants and HMAC-based action tickets

ESP32 device / harness
  -> advertises over BLE
  -> verifies handshake proof and action tickets
  -> exposes local HTTP runtime endpoints over Wi-Fi / SoftAP
  -> supports BLE-primary monitoring with Wi-Fi as the runtime data path
```

## Main Components

### 1. Mobile app

The mobile app lives in the root Expo project. It is responsible for:

- authentication and institution onboarding
- local caching and offline-first behavior
- supervisor and nurse device workflows
- calling Convex for backend state
- talking to ESP32 devices through BLE and Wi-Fi
- running Android foreground monitoring
- presenting incidents through the inbox, local notifications, and push registration

Important app areas:

- `app/`: route files for onboarding, tabs, device detail, enrollment, notifications, and incident detail
- `src/features/auth/`: Firebase + Convex auth bootstrap
- `src/features/onboarding/`: institution linking
- `src/features/devices/`: enrollment, connection, monitoring, device directory, transport logic
- `src/features/notifications/`: inbox, local notification mirroring, push registration, incident actions
- `src/lib/storage/sqlite/`: offline cache and sync job persistence
- `src/lib/storage/secure-store.ts`: clinic handshake token and monitoring client identity

### 2. Convex backend

Convex is the system of record for shared operational state. The schema currently includes:

- `institutions`
- `institutionCredentials`
- `institutionCredentialAttempts`
- `users`
- `devices`
- `deviceAssignments`
- `deviceAuditEvents`
- `notificationIncidents`
- `notificationEvents`
- `notificationUserState`
- `userPushDevices`
- `userNotificationPreferences`

In practice, Convex handles:

- user bootstrap after Firebase sign-in
- institution linking and role assignment
- device roster and assignment visibility
- signed device grants and short-lived action tickets
- enrollment registration and decommission bookkeeping
- connection test audit events
- server-side incident lifecycle and notification delivery planning

### 3. Android native bridge

The custom Expo module in `modules/coldguard-wifi-bridge/` exists because the mobile app needs platform-specific capabilities that plain Expo APIs do not fully cover.

It provides:

- native BLE enrollment orchestration
- Android Wi-Fi AP joining
- runtime snapshot fetching from the device
- a foreground monitoring service that keeps monitoring alive in the background

The key native service is `ColdGuardDeviceMonitoringService.kt`. It polls every 30 seconds and treats BLE as the control channel while using Wi-Fi or SoftAP as the preferred data channel.

### 4. Firmware and transport harness

The firmware folder contains both profile guidance and a development harness. The harness is the current practical test target for the app-side transport stack.

The harness supports:

- BLE advertisement and command handling
- enrollment and decommission flows
- action-ticket verification
- temporary or shared SoftAP access
- runtime status and alert endpoints
- simple on-device UI for pairing and recovery operations

This is important: the repo is not only documenting a concept. The transport harness is already wired into the app and native monitoring flow as a real target for the current stack.

## End-To-End User And Device Lifecycle

### 1. Sign-in and user bootstrap

ColdGuard uses Firebase Auth for identity. The app supports Google sign-in and email/password. After Firebase auth succeeds:

- the app authenticates the Convex client with the Firebase ID token
- Convex upserts the user profile
- the app loads the linked institution profile into SQLite for local use

This split is intentional:

- Firebase answers, "Who is this user?"
- Convex answers, "Which institution are they linked to, and what can they do?"

### 2. Institution linking

Institution linking is handled in two different ways:

- QR institution selection: used to recognize the institution code
- credential-based linking: used to actually bind the user to an institution, role, and staff ID

The credential path is the critical one for device operations because it returns the institution handshake token. The app stores that handshake token in SecureStore so it can later prove institution possession during offline device communication.

### 3. Device enrollment

The current enrollment flow is Android-first and BLE-first.

High-level sequence:

1. A supervisor puts the ESP32 into pairing mode on the device UI.
2. The device exposes a QR enrollment link containing `deviceId` and a bootstrap claim token.
3. The app scans the QR and requests an admin action ticket from Convex.
4. The app discovers the device over BLE.
5. The app performs an authenticated enrollment exchange using:
   - the QR bootstrap token
   - the institution handshake token
   - a backend-issued action ticket
6. The device stores institution configuration and becomes enrolled.
7. The app requests temporary SoftAP access and runs a runtime smoke test.
8. The app registers the enrolled device in Convex and caches runtime connection details locally.

Enrollment is supervisor-only. It is both a hardware claim operation and a backend registration operation.

### 4. Device assignment

After enrollment, supervisors assign devices to nurses.

The assignment model currently supports:

- one primary assignee
- zero or more viewers
- supervisors retaining full management visibility

Assignments are stored in Convex and copied into the app cache. Grant versions are bumped when assignments change so stale credentials can no longer be reused indefinitely.

### 5. Routine device connection

For an already enrolled device, the app does not simply connect blindly. It prepares authorization material first.

The app may fetch and cache:

- a signed connection grant
- a short-lived action ticket for the current operation

The device then verifies:

- the ticket contents
- the device ID and institution ID
- the MAC over the action ticket canonical string
- the handshake proof derived from the institution handshake token

Only after BLE-side authorization succeeds does the app proceed to Wi-Fi / SoftAP runtime access.

### 6. Monitoring

Monitoring keeps a logical control relationship active between the phone and the device.

The current rule is:

- BLE is the primary control channel
- Wi-Fi is the preferred runtime data path
- SoftAP is the local fallback
- BLE recovery is used to regain SoftAP access when needed
- BLE-only degraded mode keeps monitoring alive when richer runtime data is unavailable

This is the most important communication rule in the current architecture. Wi-Fi is used for throughput and runtime payloads, but it does not replace BLE ownership.

### 7. Incident handling

Runtime state eventually turns into incidents. There are two paths today:

- server-side incidents in Convex
- local derived incidents built from cached device state

The app merges both so the inbox remains useful even when network availability is poor or when backend incident ingest is not the only source of state.

## Communication Model

### A. App <-> Firebase

Firebase is used only for identity and session authentication. It does not act as the operational backend for devices.

The flow is:

1. user authenticates with Firebase
2. app obtains Firebase token
3. Convex client uses that token for backend-authenticated queries and mutations

### B. App <-> Convex

Convex is the operational backend. The app uses it for:

- linked profile lookup
- institution linking
- device list and assignment sync
- issuing connection grants and action tickets
- device enrollment registration
- device decommissioning
- connection test audit logging
- notification inbox, preferences, acknowledgements, resolution, and push registration

Convex data is mirrored locally into SQLite so the app can still function with partial or intermittent connectivity.

### C. App <-> ESP32 over BLE

BLE is used for:

- discovery
- secure enrollment setup
- grant and ticket verification
- primary lease claim and heartbeat
- SoftAP ticket recovery
- decommission commands

The app-side BLE protocol defines a service UUID and command/response characteristics. Messages are JSON payloads encoded over BLE, with a handshake proof based on:

- `deviceNonce`
- `deviceId`
- `proofTimestamp`
- the stored institution handshake token

This lets the app prove institution possession even when offline.

### D. App <-> ESP32 over Wi-Fi / SoftAP

Once BLE authorization is complete, the app uses Wi-Fi HTTP endpoints for runtime work. Current runtime paths include:

- `/api/v1/connection-test`
- `/api/v1/runtime/status`
- `/api/v1/runtime/alerts`
- `/api/v1/runtime/heartbeat`

The app and native service use these endpoints to:

- verify connectivity after enrollment
- fetch current temperature / battery / door / MKT status
- fetch alert records
- post heartbeats during active monitoring

### E. Android native bridge <-> ESP32

The Android bridge exists to make Wi-Fi and long-running monitoring practical on device.

It can:

- join the ESP32 SoftAP
- fetch runtime JSON natively
- maintain a foreground monitoring service
- keep monitoring state visible to JS through a status map

Without this bridge, background monitoring would be much less reliable and BLE/Wi-Fi handoff would be harder to manage on Android.

## Monitoring Design

### Primary rule

ColdGuard currently treats monitoring as BLE-primary.

That means:

- the phone tries to claim or renew a BLE primary lease
- runtime data is then collected over the best available data path
- loss of Wi-Fi does not automatically mean loss of monitoring ownership
- degraded monitoring is still considered active if BLE ownership survives

### Runtime transport priority

The current transport order is:

1. proven facility Wi-Fi
2. stored SoftAP credentials
3. BLE-requested SoftAP recovery
4. BLE-only degraded monitoring if no IP path works

This logic exists both in app-side transport services and in the Android monitoring service.

### Native monitoring service behavior

`ColdGuardDeviceMonitoringService` currently:

- runs as an Android foreground service
- requires notification permission before startup
- polls monitored devices every 30 seconds
- claims or renews the BLE primary lease
- attempts runtime polling over the preferred IP path
- posts runtime heartbeats when an IP path is active
- emits local Android alert notifications for newly seen runtime alerts
- exposes status back to JS, including:
  - `isRunning`
  - `transport`
  - `controlRole`
  - `primaryLeaseSessionId`
  - `primaryLeaseExpiresAt`
  - `error`

### JS fallback monitoring

The React layer still plays a role:

- it restarts native monitoring for devices that should already be monitored
- it polls devices directly when those devices are not currently covered by the native service
- it refreshes the merged notification inbox after monitoring cycles

So the current model is not "native only." It is native-first on Android, with a JS safety net.

## Data And Storage Model

### SecureStore

SecureStore currently holds:

- the clinic handshake token
- a generated monitoring client ID
- pending enrollment state

This is sensitive or device-specific data that should not live in general SQLite tables.

### SQLite

SQLite is the app's offline cache and local runtime store. It currently stores:

- profile cache
- device roster and last-known runtime snapshot
- connection grants
- action tickets
- per-device runtime config
- notification cache and per-user read/archive state
- notification preferences
- queued sync jobs

Important local tables:

- `devices`
- `device_runtime_config`
- `connection_grants`
- `device_action_tickets`
- `notification_cache`
- `notification_state_cache`
- `sync_jobs`

This local layer is what allows the app to keep working when connectivity is weak.

### Convex as source of truth

SQLite is not the source of truth for institution-level shared state. Convex is.

The intended division is:

- Convex: authoritative institutional state
- SQLite: cached operational state on this phone
- SecureStore: sensitive local secrets

## Notifications And Incident Logic

ColdGuard already has a substantial incident model, not just simple toast alerts.

### Server-side incident model

Convex models incidents by:

- institution
- device
- incident type

Supported incident types today:

- temperature
- door open
- device offline
- battery low

Server-side logic handles:

- open / acknowledged / resolved lifecycle
- reopen windows
- recovery rules
- unread and archived state per user
- delivery planning for push notifications
- escalation windows for unacknowledged critical incidents

### Local derived incidents

The app can also derive incidents locally from cached device state using the same practical thresholds:

- temperature based on `mktStatus`
- door-open duration thresholds
- offline thresholds based on `lastSeenAt`
- battery thresholds

This means the user can still see meaningful incident state even if the remote inbox is stale.

### Delivery surfaces

The current notification surfaces are:

- in-app inbox
- local mobile notifications
- push token registration and server-side push planning

The app mirrors notification state locally and queues user actions such as:

- mark read
- archive
- acknowledge
- resolve
- update notification preferences

If the user is offline, those actions are written to `sync_jobs` and replayed later.

## Security And Authorization Model

The current security model is layered:

### User identity

- Firebase proves user identity
- Convex maps identity to role and institution

### Institution possession

- credential-based institution linking returns the institution handshake token
- the app stores that token in SecureStore
- the token is used to build handshake proof for device communication

### Device operation authorization

Convex issues two related but distinct kinds of authorization material:

- signed grants
- short-lived action tickets

Grants represent permission scope such as connect or manage. Action tickets are operation-specific and short-lived for commands such as:

- enroll
- connect
- decommission
- reassign
- Wi-Fi provision

The device also tracks counters and grant versions so stale assignment state cannot remain valid forever.

## Roles And Access

The current product logic distinguishes primarily between:

- `Supervisor`
- `Nurse`

Supervisors can:

- enroll devices
- assign devices
- decommission devices
- manage full device visibility

Nurses can:

- see only devices assigned to them, unless they are supervisors
- obtain connection material for permitted devices
- monitor and interact with incidents within the linked institution

## Current Operational Logic By Area

### Authentication and onboarding

- Firebase session starts first
- Convex profile is bootstrapped after auth
- linked profile is cached locally
- credential linking stores the institution handshake token for later offline hardware auth

### Device directory

- the app syncs visible devices from Convex
- supervisors receive the manageable device list
- nurses receive only assigned devices
- the result is stored in SQLite and reused when online fetches fail

### Connection material reuse

- grants and action tickets are cached locally
- cached authorization is reused until close to expiry
- ticket reuse is rejected if the local device grant version no longer matches

### Connection and recovery

- facility Wi-Fi is preferred only when it has recently been proven reachable
- stored SoftAP credentials are reused when possible
- BLE is used to recover a fresh Wi-Fi ticket when other paths fail
- runtime config tracks active transport, session status, and recent failures

### Monitoring

- monitoring start requires notification permission on mobile
- Android native monitoring is foreground-service based
- JS fallback skips devices already covered by native monitoring
- last-known runtime values are written back into the local device cache

### Notifications

- the app merges remote incident cache and locally derived incidents
- local notification mirroring is driven from the merged inbox
- user actions sync online immediately or queue offline

## Repo Map For New Readers

If someone needs to understand the system quickly, these are the most useful files:

- `README.md`: repo entry point
- `docs/system-overview.md`: this document
- `src/features/devices/services/connection-service.ts`: app-side connection and monitoring orchestration
- `src/features/devices/services/device-directory.ts`: grants, tickets, device sync, assignment-facing app logic
- `src/features/notifications/providers/notification-provider.tsx`: notification refresh and monitoring integration
- `src/features/notifications/services/inbox-sync.ts`: local/remote incident merge and offline sync behavior
- `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`: Android native monitoring loop
- `convex/devices.ts`: backend device management and authorization material
- `convex/notifications.ts`: incident lifecycle and delivery logic
- `convex/users.ts`: institution linking and linked profile behavior
- `firmware/esp32_transport_harness/README.md`: firmware transport harness usage
- `docs/runbooks/esp32-transport-harness.md`: firmware communication contract and bench flow

## Current Scope And Constraints

The repo reflects a working in-progress platform, not a finished nationwide deployment stack. Important current constraints:

- Android is the primary hardware path for native enrollment and monitoring
- the firmware transport harness is the active development target for the app/device contract
- the app still relies on hybrid local and remote incident generation
- SQLite acts as a strong offline cache, but Convex remains the shared source of truth
- BLE is intentionally retained as the control plane even when Wi-Fi is healthy
- the separate `coldguard-web/` app is not the monitoring client; it is supporting web/public content

## Supporting Documents

Useful deeper references already in the repo:

- `coldguard-esp32-app-connection-protocol-plan.md`
- `coldguard-notification-system-design.md`
- `docs/plans/2026-03-28-ble-primary-runtime-monitoring-design.md`
- `docs/runbooks/esp32-transport-harness.md`
- `firmware/README.md`

## Practical Summary

ColdGuard today is a hybrid mobile-plus-device system built around one central idea:

- authenticate the human with Firebase and Convex
- authorize the phone and device relationship with tickets, grants, and a stored clinic handshake token
- use BLE for secure nearby control and lease ownership
- use Wi-Fi or SoftAP for runtime data transfer
- keep the phone operational offline with SQLite and SecureStore
- turn device state into incidents that can be acknowledged, resolved, and synchronized later

That is the current logic the repository implements.
