# Native Enrollment With Temporary SoftAP Smoke Test Design

## Summary

ColdGuard enrollment will move from the current JavaScript BLE orchestration into a native Android enrollment controller. The native layer will own the full pairing transaction so the most failure-prone sequence stays inside one runtime:

1. scan and connect over BLE
2. perform the enrollment handshake
3. request a temporary SoftAP session over BLE
4. join the device SoftAP
5. bind Android traffic to that network
6. verify the device runtime endpoint
7. tear down the temporary SoftAP session and return success

Enrollment is successful only when both the BLE enrollment flow and the temporary SoftAP smoke test succeed.

## Why This Changes

The device model has changed:

- BLE advertising is the always-on control and discovery path
- SoftAP is on-demand only
- SoftAP is used for temporary high-bandwidth or configuration workflows
- enrollment still needs a SoftAP smoke test so we know the device can open that path when requested

This means enrollment should not establish a permanent SoftAP connection, but it should prove that a temporary SoftAP session can be created and used successfully.

## Goals

- make enrollment more reliable by moving BLE and Wi-Fi handoff into Android native code
- keep the app’s BLE connection active until the SoftAP smoke test is complete
- provide verbose stage-by-stage diagnostics for debugging
- give users a clear progress modal and better user-facing errors
- allow developers to copy detailed diagnostics from the failure UI

## Non-Goals

- redesign the post-enrollment monitoring architecture
- make SoftAP the default runtime transport after enrollment
- add iOS parity in this change set
- change the ESP32 transport contract beyond what is needed for temporary SoftAP smoke testing

## Current State

The current enrollment flow is JavaScript-driven:

- [app/device/enroll.tsx](/C:/Users/Kevin/Projects/LabVIEW/ColdGuard/app/device/enroll.tsx) starts enrollment
- [src/features/devices/services/connection-service.ts](/C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.ts) orchestrates registration
- [src/features/devices/services/ble-client.ts](/C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/ble-client.ts) runs BLE via `react-native-ble-plx`

The existing Android native module already handles BLE-assisted Wi-Fi recovery:

- [modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt](/C:/Users/Kevin/Projects/LabVIEW/ColdGuard/modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt)

That recovery controller is the starting point for the native enrollment transaction, but it does not currently own the actual enrollment flow or emit UI-facing progress updates.

## Proposed Architecture

### Native Enrollment Transaction

Add a dedicated native Android enrollment controller and Expo module API for enrollment. The native layer owns:

- BLE scan and connection
- GATT service discovery
- `hello`
- `enroll.begin`
- `enroll.commit`
- enrolled-state verification if needed
- `grant.verify` and `wifi.ticket.request` for temporary SoftAP access
- SoftAP join and Android network binding
- runtime smoke test fetch
- release of BLE and network resources

The JS layer only:

- starts the transaction
- subscribes to stage/progress updates
- maps success/failure into UI state
- persists the enrolled device after native success returns

### Enrollment Success Criteria

The app must not register or present the device as enrolled until all of the following are true:

- BLE handshake and enrollment succeeded
- the device issued a temporary SoftAP ticket
- Android joined the device SoftAP
- the process/network binding succeeded
- the runtime smoke test succeeded

If any step fails, enrollment fails.

### Retry Model

Retries should be local to the native transaction so cross-layer timing does not race:

- BLE scan/connect/discovery: bounded retries
- notification/descriptor setup: bounded retries
- SoftAP join and binding: bounded retries
- runtime smoke test fetch: bounded retries

Each retry attempt must be logged with stage, attempt count, and raw error.

## UI Changes

### Enrollment Progress Modal

Replace the current button-only busy state with a modal popup that stays visible for the enrollment transaction.

The modal should include:

- spinner while work is active
- current stage title
- short descriptive text for the stage
- explicit note when the phone is about to switch to the device Wi-Fi for the temporary smoke test

Example stage text:

- Finding device
- Connecting over Bluetooth
- Establishing secure channel
- Completing pairing
- Requesting temporary device Wi-Fi
- Connecting to device Wi-Fi
- Verifying device connection
- Finishing setup

### Failure State

If enrollment fails, the modal switches to an error state and shows:

- a user-facing error message from the app error presenter
- an optional short recovery hint
- a `Copy developer details` action

The copied developer payload should include:

- stage
- attempt counts
- deviceId when available
- BLE name / SSID / runtime URL when available
- raw native error message
- summarized timeline data

## Logging and Diagnostics

Verbose logging is a requirement for this feature while reliability is being established.

The native transaction should log:

- stage entry and exit
- elapsed time per stage
- retry number
- BLE status/error codes
- Wi-Fi association/binding failures
- runtime fetch failures
- cleanup actions

The JS layer should log:

- stage updates received from native
- modal transitions
- copied developer diagnostics payload generation

The logs should be high-signal, not silent. The goal is attribution of failures to a precise handoff boundary.

## Error Handling

User-facing errors should be simpler than raw native failures. The app should map known classes of failure into language like:

- Bluetooth connection could not be completed.
- The device was paired, but its temporary Wi-Fi link could not be verified.
- The device Wi-Fi check was interrupted before setup finished.

The raw native message remains available through the developer copy action.

## Data Flow

1. User starts enrollment in [app/device/enroll.tsx](/C:/Users/Kevin/Projects/LabVIEW/ColdGuard/app/device/enroll.tsx).
2. JS requests native enrollment start with device QR data and required tokens.
3. Native controller emits progress events throughout the transaction.
4. JS updates the modal stage text in real time.
5. On native success, JS registers the device and persists the smoke-tested SoftAP metadata if returned.
6. On native failure, JS displays the mapped error and exposes developer diagnostics copy.

## Risks

- Android network binding can be brittle across device vendors and OS versions.
- Keeping BLE active while switching to SoftAP may require careful ordering and cleanup.
- If `enroll.commit` succeeds but the smoke test fails, the device may already be enrolled on the ESP32 side even though the app must treat the flow as failed.
- The native Expo bridge will need a robust event shape so the UI does not drift from the transaction state.

## Open Decision For Implementation

If the ESP32 accepts `enroll.commit` but the temporary SoftAP smoke test fails, the app will treat enrollment as failed. The implementation plan must explicitly decide whether native code should attempt any cleanup on the device side or simply return a failure that can be retried against an already-enrolled unit.
