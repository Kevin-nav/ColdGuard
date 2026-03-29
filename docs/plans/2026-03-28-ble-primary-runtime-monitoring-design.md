# BLE-Primary Runtime Monitoring Design

## Goal

Make background monitoring collect real device updates while keeping Bluetooth primary ownership active at all times. Runtime data must come from firmware-generated values and flow through the same BLE, facility Wi-Fi, and SoftAP paths used in production.

## Core Rule

Bluetooth primary is always the control channel for a monitored phone.

- BLE primary stays active for ownership and liveness.
- Facility Wi-Fi is preferred for runtime fetch when it is already proven reachable.
- Stored SoftAP is the next runtime fetch path.
- BLE-requested fresh SoftAP recovery comes after that.
- BLE-only degraded monitoring is the final fallback when no IP transport is available.

Wi-Fi and SoftAP never replace BLE primary ownership. They are optional runtime data channels layered on top of the BLE-primary monitoring session.

## Current State

The current enrollment flow is already BLE-first and native on Android:

- BLE enrollment/authentication
- BLE request for a temporary SoftAP ticket
- phone joins the SoftAP
- runtime smoke test over `/api/v1/runtime/status`

The current Android monitoring service already maintains BLE-primary lease ownership. It does not yet use its runtime polling helpers from the active poll loop, so the service can stay primary without actually collecting runtime updates and alerts.

The repo also already contains:

- firmware support for `primary.claim`, `primary.heartbeat`, `primary.status`
- SoftAP ticket issuance and shared access semantics
- service-layer fallback helpers for facility Wi-Fi and SoftAP runtime fetch
- JS fallback polling for devices not currently covered by native monitoring

## Desired Monitoring Flow

Each monitored cycle should follow this order:

1. renew or reclaim BLE primary
2. attempt runtime collection over the best available data path
3. persist the newest device snapshot and runtime metadata
4. surface alert notifications
5. keep monitoring active even if runtime collection falls back to BLE-only degraded mode

The intended transport behavior is:

1. BLE primary always active
2. facility Wi-Fi runtime fetch when proven reachable
3. stored SoftAP runtime fetch
4. BLE-requested SoftAP recovery
5. BLE-only degraded monitoring if no IP path is available

In degraded mode, the monitoring session remains valid and keeps lease ownership alive even if richer runtime fetch is unavailable.

## Firmware Simulation Requirement

Mock updates must be generated from firmware-side code, not from JS or app-side fake data.

That means the firmware transport harness should expose a simulation mode that produces changing runtime values over time, including:

- temperature
- battery level
- door state
- MKT or temperature status changes
- alert records on the runtime alerts endpoint

The app and native Android bridge should consume those values through the same runtime endpoints and BLE-primary flow used for real hardware. No app-only monitoring mock path should be introduced.

## Architecture

### 1. Firmware runtime generation

Extend the ESP32 transport harness runtime layer so that it can generate changing status and alert payloads for testing. The generated values should be visible through the existing runtime HTTP endpoints and optionally through a minimal BLE-readable status path for degraded-mode visibility.

This simulation should be deterministic enough for tests but realistic enough to exercise:

- normal temperature updates
- warning and critical transitions
- door-open incidents
- low battery incidents
- recovery/resolution behavior

### 2. Native Android monitoring loop

Update `ColdGuardDeviceMonitoringService` so the poll loop does more than lease maintenance.

For each cycle it should:

- claim or heartbeat BLE primary
- resolve the preferred runtime path
- fetch runtime status and alerts when an IP path is available
- persist/update monitoring state based on the fetched result
- emit alert notifications for new unresolved alerts
- remain in BLE-only degraded mode when runtime transport is unavailable

The service should treat runtime transport failure as a recoverable data-path issue, not as loss of ownership, as long as BLE primary is still active.

### 3. App/service persistence flow

The service and JS layer should keep one coherent local view of:

- latest device snapshot
- active transport actually used for runtime fetch
- control role
- last monitor success/error
- primary lease metadata

When native monitoring is active, JS fallback should not duplicate polling for those same devices. The JS fallback remains necessary for devices not currently covered by native monitoring.

### 4. Pairing and SoftAP confirmation

The current native pairing path remains the reference path and should not be replaced:

- enrollment over BLE
- SoftAP ticket request over BLE
- SoftAP join
- runtime smoke test

SoftAP recovery helpers should stay until the new monitoring loop is fully wired and verified. Cleanup of dead code happens only after confirming that those helpers are no longer on any active path.

## Error Handling

The service should distinguish between:

- BLE ownership failure
- runtime transport failure
- alert parsing/persistence failure

Expected behavior:

- if BLE primary cannot be renewed, the device is no longer actively controlled and status should reflect that clearly
- if BLE primary is active but Wi-Fi/SoftAP runtime fetch fails, monitoring remains active in degraded mode
- if stored SoftAP fails, attempt BLE-requested SoftAP recovery
- if all IP paths fail, stay BLE-primary and continue degraded monitoring until the next cycle

## Testing Strategy

### Firmware tests

Add focused tests for the transport harness simulation so runtime values and alert transitions are predictable and validate:

- changing runtime status values over time
- alert creation and resolution
- BLE-primary ownership remaining independent from IP transport availability

### Native/service tests

Add tests that prove the Android monitoring loop now:

- maintains BLE primary every cycle
- prefers facility Wi-Fi when proven
- falls back to stored SoftAP
- requests fresh SoftAP over BLE when needed
- stays active in BLE-only degraded mode if no IP path is available
- emits or tracks alerts from fetched runtime data

### App tests

Add or update tests that prove:

- local device snapshots update as runtime values change
- monitoring state reflects BLE-primary ownership plus current runtime data path
- fallback JS polling still covers non-native contexts without conflicting with native monitoring

## Cleanup Rule

Do not remove existing monitoring helpers, SoftAP recovery logic, or runtime polling code until the BLE-primary-first update collection path is implemented and verified by tests. Cleanup should be a follow-up step driven by observed dead paths, not by assumption.
