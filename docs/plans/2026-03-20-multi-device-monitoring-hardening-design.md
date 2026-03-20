# Multi-Device Monitoring And Transport Hardening Design

**Date:** 2026-03-20

## Goal

Evolve ColdGuard from a single-device-oriented monitoring and recovery implementation into a production-ready multi-device mobile client that can background-monitor several devices per phone, deliver reliable alerts while the app is not foregrounded, and keep the app, backend, Android bridge, and ESP32 firmware aligned on one transport contract.

## Current Problem

The project already has most of the required product surface:

- Firebase authentication
- Convex-backed institution and device records
- local SQLite caching
- BLE enrollment and recovery
- SoftAP handoff
- facility Wi-Fi provisioning
- runtime HTTP polling
- notifications
- Android foreground monitoring service

The weakness is no longer feature breadth. It is integration correctness.

The current implementation has several structural mismatches:

- the app models monitoring as per-device while Android exposes a singleton service
- the JS layer still polls monitored devices even when native monitoring exists
- SoftAP process binding is not always released
- notification derivation mixes institution name and institution ID
- firmware and backend disagree on action-ticket version and time semantics
- firmware reports Wi-Fi provisioning success too early

These issues make multi-device monitoring unreliable and can cause false success states, stale authorization failures, duplicate polling, or notification loss.

## Product Direction

### Multi-Device Background Monitoring

One phone must be able to background-monitor multiple ColdGuard devices at the same time.

The target user behavior is:

- a nurse or supervisor can leave the app screen
- the phone can be locked
- monitoring continues in the background
- alerts are still surfaced as device incidents and Android notifications

This does not imply operation while the phone is powered off. It means the Android app must remain operational under normal background execution using a foreground service.

### Monitoring Authority

Android native code becomes the primary background monitoring engine.

The React/JS layer remains responsible for:

- rendering device and incident state
- requesting monitoring changes
- syncing UI-visible data
- handling user actions

The native service becomes responsible for:

- maintaining the active monitored-device set
- per-device runtime polling and recovery
- triggering local notifications from runtime alerts
- exposing per-device monitoring status back to the app

JS must not duplicate the same polling work while native monitoring is active.

## Architecture Options

### Option 1: One foreground service with internal multi-device scheduling

This option keeps a single Android foreground service but changes it from a singleton-device worker into a multi-device worker with an internal registry of monitored devices.

Advantages:

- matches Android expectations for persistent background work
- avoids one-service-per-device lifecycle problems
- scales better for many devices on one phone
- keeps notifications centralized
- allows one persistent user-facing “ColdGuard monitoring active” notification

Disadvantages:

- requires bridge API changes
- needs explicit per-device status modeling inside the service

### Option 2: One foreground service per monitored device

Advantages:

- simpler mental model per device

Disadvantages:

- higher OS and battery overhead
- more complex lifecycle coordination
- worse notification UX
- easier to hit Android background execution limits

### Option 3: JS-driven polling only

Advantages:

- fewer native changes

Disadvantages:

- less reliable in background
- duplicates work already present natively
- weaker long-term foundation for production monitoring

### Recommendation

Adopt Option 1.

ColdGuard should use one Android foreground service that manages a per-device monitoring registry and publishes per-device statuses.

## Approved Design

### 1. Monitoring Model

Monitoring is a per-device capability backed by a single multi-device Android service.

Each monitored device has its own state:

- `deviceId`
- desired monitoring mode
- active transport
- runtime base URL
- last poll time
- last successful heartbeat
- last monitor error
- alert dedupe state

SQLite remains the local source of truth for per-device monitoring configuration, but the Android service is the source of truth for live background execution status.

The bridge API should expose:

- `startMonitoringDevicesAsync(devices[])`
- `stopMonitoringDeviceAsync(deviceId)`
- `getMonitoringStatusesAsync()`
- `getMonitoringStatusAsync(deviceId)` for convenience if desired

The old singleton `startMonitoringServiceAsync` / `stopMonitoringServiceAsync` / `getMonitoringServiceStatusAsync` contract should be replaced or wrapped for compatibility during migration.

### 2. Polling Ownership

Only one layer should own active runtime polling for monitored devices.

Rules:

- if a device is actively monitored by the Android service, JS must not poll it on its own
- JS may still run on-demand foreground operations such as a manual connection test or diagnostics
- notification refresh should consume persisted status and incident state rather than re-running recovery loops from JS

This reduces duplicate BLE scans, duplicate HTTP requests, duplicate Wi-Fi handoffs, and battery drain.

### 3. SoftAP Session Lifecycle

SoftAP recovery must be treated as an explicit session with acquire and release boundaries.

For every SoftAP recovery or connection test:

1. request or recover a Wi-Fi ticket
2. bind to the ESP32 AP
3. perform required runtime fetches
4. post heartbeat if needed
5. release the network binding

The JS app must always release network binding in both success and failure paths.

The Android native service should also avoid reconnecting to SoftAP on every poll if the session is still valid; it should reuse the bound network where possible and reconnect only when required.

### 4. Protocol Contract

The backend and firmware need one consistent action-ticket contract.

The contract must align on:

- time base
- expiry semantics
- grant or counter version semantics
- replay expectations
- per-action scopes

Required changes:

- ticket validation must compare timestamps using the same clock domain
- firmware must not reject valid tickets due solely to equal-version semantics when the backend intentionally issues current-version tickets
- enrollment, connect, Wi-Fi provision, and decommission paths must all use the same versioning rule

The simplest safe rule is:

- action tickets are valid when their MAC is correct, their expiry window is valid, and their counter matches the currently enrolled device state contract
- assignment or enrollment operations that rotate grants increment device state on the backend, then subsequent tickets reflect that new state consistently

Whether this becomes “equal is valid” or “strictly newer is valid” is an implementation detail, but the same rule must be enforced in both backend issuance and firmware verification.

### 5. Firmware Runtime Truthfulness

The firmware must stop reporting optimistic success.

Required behavior:

- `wifi.provision` should only report a facility runtime target as usable after a real station join succeeds, or it should explicitly return a pending state instead of `ok: true`
- runtime payloads should report a real `mktStatus` consistent with temperature and alert data
- alert identifiers or cursors should be stable per ongoing condition, not regenerated from `millis()` every poll

This ensures downstream monitoring and notification logic can reason about state changes instead of synthetic churn.

### 6. Notification Data Identity

Incident derivation and local cache merges must use stable identifiers rooted in institution ID and device ID, not human-readable institution name.

Institution name may remain display-only.

This change affects:

- notification syncing
- local derived incidents
- device repository queries
- merge logic for offline incidents

### 7. UI And UX Changes

The app should stop auto-connecting just because the device detail screen opened.

Foreground device actions should become explicit:

- `Run connection test`
- `Reconnect`
- `Enable monitoring`
- `Disable monitoring`
- `Save facility Wi-Fi`

Opening a screen should load cached runtime state only.

This improves performance, reduces surprise BLE permission prompts, and scales better when many users and devices are active.

## Data Flow

### Start Monitoring

```text
user enables monitoring for device N
  -> app validates local prerequisites
  -> app fetches or reuses required action ticket / handshake material
  -> app stores desired monitoring state in SQLite
  -> app sends device config to native bridge
  -> native service adds or updates device N in monitored registry
  -> native service begins per-device polling loop
  -> bridge reports per-device status back to app
```

### Background Recovery

```text
native poll fails on facility Wi-Fi
  -> native service attempts SoftAP recovery for that device
  -> BLE requests new Wi-Fi ticket
  -> service binds to SoftAP
  -> runtime fetch succeeds or fails
  -> service persists device status
  -> service releases SoftAP binding
  -> if alerts changed, service posts local notification
```

### UI Refresh

```text
dashboard / notifications screen opens
  -> JS loads cached device + incident state
  -> JS requests native per-device monitoring statuses
  -> JS merges statuses into UI model
  -> JS syncs remote inbox / metadata when online
  -> JS does not poll monitored devices directly
```

## Error Handling

### Per-Device Failures

One failing monitored device must not stop monitoring for others.

The native service should isolate each device poll result and update only that device's error state.

### Monitoring Persistence

If the app process restarts, the native service and SQLite config should be able to reconstruct which devices were intended to be monitored.

### Notification Permissions

If Android notification permission is denied, monitoring configuration can still exist, but the service should report a clear degraded state rather than silently pretending background alerting works.

## Testing Strategy

### App / JS

Add or update tests for:

- notification institution ID consistency
- no duplicate JS polling when native monitoring is active
- explicit user-triggered connection actions
- SoftAP release on both success and failure
- multi-device status merge behavior

### Android Bridge

Add tests or harness coverage for:

- multi-device registry updates
- stopping one device without stopping all devices
- per-device status reporting
- SoftAP binding release
- alert dedupe behavior

### Backend

Add tests for:

- action-ticket counter semantics
- expiry semantics
- ticket issuance after enrollment and assignment changes

### Firmware

Add targeted tests or bench checks for:

- ticket version acceptance rules
- epoch versus uptime expiry handling
- station join success criteria during Wi-Fi provision
- stable alert cursor generation
- truthful `mktStatus` generation

## Non-Goals

- iOS background monitoring in this pass
- full server-side replacement of all phone-side monitoring
- shipping the harness firmware as-is to field devices
- changing the product requirement that one phone can manage many devices

## Recommendation

Implement multi-device monitoring as a single Android foreground service with a per-device registry, remove duplicate JS polling, fix SoftAP lifecycle handling, align backend and firmware on one action-ticket contract, and make firmware runtime reporting truthful before adding additional transport features.
