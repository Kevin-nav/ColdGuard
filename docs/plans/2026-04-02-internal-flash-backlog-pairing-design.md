# Internal Flash Backlog And Pairing Reliability Design

## Goal

Replace the firmware transport harness's SD-backed history with an internal flash-backed unsent backlog, remove explicit SD-card reporting from the runtime contract, and harden device pairing so unrelated firmware or app work does not make enrollment unreliable.

## Requirements

- The firmware should keep only telemetry that has not yet been sent to the app.
- If internal storage fills up, the firmware should evict the oldest buffered rows and keep accepting new samples.
- The app-side user flow should remain stable.
- The system should no longer expose or depend on an `sdCardMounted` signal.
- Pairing should not be delayed or destabilized by unrelated startup work, background monitoring, or overlapping BLE/Wi-Fi operations.

## Firmware Architecture

### 1. Storage model

The firmware should stop treating history as SD-backed CSV and instead treat it as a bounded internal backlog of unsynced telemetry rows.

Use two storage layers:

- `Preferences`/NVS for durable metadata and the latest runtime snapshot
- internal flash file storage for the queued unsent rows

Recommended metadata in `Preferences`:

- latest telemetry snapshot fields
- next sequence number
- queue head and tail sequence metadata
- last acknowledged sequence
- queue count and/or storage version

Recommended queued row fields:

- `sequence`
- `recordedAtEpochMs`
- `rtcIso`
- `timeSource`
- `vaccineTempC`
- `mktStatus`
- `temperatureSensorHealthy`
- `rtcHealthy`

Rows older than the last acknowledged sequence should be prunable. If capacity is reached during append, the oldest rows should be evicted before writing the new row.

### 2. Runtime transport contract

Keep the existing runtime endpoints:

- `/api/v1/runtime/status`
- `/api/v1/runtime/history`
- `/api/v1/runtime/alerts`

Behavior changes:

- `/api/v1/runtime/status` returns the newest snapshot from internal storage
- `/api/v1/runtime/history` returns queued rows newer than `afterSequence`
- the firmware no longer returns `sdCardMounted`

The app can continue syncing by `sequence` without a protocol redesign.

### 3. Boot and pairing priority

Pairing-critical BLE startup should happen before slow telemetry initialization.

Recommended boot order:

1. Load device state
2. Start BLE server and advertising
3. Initialize the minimal UI
4. Initialize telemetry and internal backlog storage
5. Begin regular sampling

Telemetry and storage failures must not block BLE advertising or pairing availability.

## App And Native Architecture

### 1. App contract cleanup

The mobile app should stop assuming runtime payloads contain `sdCardMounted`.

This requires:

- removing `sdCardMounted` as a required field from runtime and reading types
- stopping UI and repository logic from depending on that field
- tolerating older cached rows until migrations or follow-up cleanup remove the column entirely

### 2. Pairing serialization

Enrollment should be treated as a protected single-flight operation.

Required protections:

- an app-level enrollment lock in the connection service
- blocking runtime recovery or monitoring startup for the target device while enrollment is active
- native Android enrollment should be mutually exclusive with other BLE/Wi-Fi bridge activity using the same process resources

This reduces race conditions between:

- BLE enrollment
- runtime ping/recovery
- native monitoring startup
- temporary SoftAP verification

## Error Handling

### Firmware

- If internal backlog initialization fails, BLE enrollment must still come up.
- If app history fetches return no rows, the history endpoint should return an empty page cleanly.
- If backlog append fails due to capacity, evict oldest rows and retry.
- If backlog storage fails completely, continue serving the latest runtime snapshot.

### App

- Missing `sdCardMounted` must not be treated as an error.
- If a pairing operation is already active, overlapping operations should fail explicitly instead of racing.
- Native enrollment failures should continue surfacing detailed stage diagnostics.

## Testing Strategy

### Firmware

- verify BLE advertises immediately on boot
- verify telemetry/storage init no longer blocks pairing availability
- verify history rows are appended, paged, and pruned by sequence
- verify oldest-row eviction when the backlog reaches capacity

### App and native

- verify enrollment still succeeds when runtime payloads omit `sdCardMounted`
- verify overlapping enrollment and monitoring/recovery attempts are blocked or serialized
- verify Android native enrollment still emits progress stages and releases resources cleanly

## Scope

This change should be implemented in one focused pass:

- firmware internal backlog and startup ordering
- app/native pairing lock and contract cleanup
- targeted tests for both tracks

No UX redesign is required.
