# Transport Priority And Handoff Design

**Date:** 2026-03-21

## Goal

Make ColdGuard transport behavior product-grade by keeping the ESP32 reachable after pairing and after power loss, while allowing the mobile client to move smoothly between persistent SoftAP, facility Wi-Fi, and BLE recovery without leaving the device stranded.

## Current Problem

The current stack has the right pieces but the wrong runtime behavior:

- initial pairing can succeed, but the app does not reliably maintain a usable transport afterward
- after ESP32 power loss and reboot, reconnection is not guaranteed on any path
- the app can fail during BLE recovery with service-discovery errors
- Wi-Fi permission prompting is not happening predictably from the user’s perspective
- facility Wi-Fi and SoftAP are treated more like one-off flows than long-lived transport options
- BLE is being forced into roles it should not own in normal runtime operation

This creates a product failure mode where the device can be enrolled but not dependably reachable later.

## Product Decision

Approved product behavior:

- enrolled devices keep SoftAP available continuously
- this remains true after reboot and after facility Wi-Fi has been configured
- facility Wi-Fi should be used when it is the less demanding stable path
- SoftAP should remain the immediate local fallback
- BLE should be reserved for recovery and control when Wi-Fi paths cannot be used
- transport transitions must be smooth and automatic

## Architecture Options

### Option 1: SoftAP-first always

Always prefer SoftAP whenever it is available.

Advantages:

- simplest local recovery model
- avoids dependence on facility network quality
- makes the device consistently reachable nearby

Disadvantages:

- keeps the phone on a local AP more than necessary
- can compete with normal internet use on the phone
- wastes the value of working facility Wi-Fi

### Option 2: Facility Wi-Fi preferred after proof

Keep SoftAP alive continuously, but let the app prefer facility Wi-Fi only after it has proven stable for that device. Fall back to SoftAP immediately when that path degrades.

Advantages:

- preserves always-available local recovery
- reduces ongoing local AP usage when facility Wi-Fi is actually healthy
- keeps transport policy on the phone, where state and OS APIs already exist
- matches the product requirement for seamless handoff

Disadvantages:

- requires transport health tracking in app/native code
- needs careful release and rebinding of Wi-Fi sessions

### Option 3: Dynamic scoring with full multi-signal routing

Continuously score facility Wi-Fi, SoftAP, and BLE based on latency, recent failures, permission state, and recovery cost.

Advantages:

- potentially best long-term adaptability
- can optimize for real-world network conditions

Disadvantages:

- more complexity than the current stack can safely absorb in one pass
- unnecessary to fix the current product blockers

## Recommendation

Adopt Option 2 now, with a simple app-side health model that can evolve toward dynamic scoring later.

The ESP32 should not own transport preference decisions beyond keeping its interfaces available and reporting truthful state. The mobile app and Android native layer should decide which path to use.

## Approved Design

### 1. Transport Roles

Transport responsibilities are:

- `SoftAP`: persistent local runtime path and immediate fallback
- `facility_wifi`: preferred runtime path once verified healthy
- `BLE`: recovery, ticket refresh, and control only

ColdGuard should not depend on BLE for routine runtime monitoring when either Wi-Fi path is viable.

### 2. ESP32 Behavior

For enrolled devices:

- keep SoftAP running continuously
- restore SoftAP automatically after reboot
- keep attempting facility Wi-Fi when credentials exist
- serve runtime HTTP endpoints from whichever Wi-Fi interface is currently usable
- expose truthful runtime state showing:
  - whether SoftAP is up
  - whether station join is active
  - current runtime base URL
  - last known transport health indicators

The ESP32 remains a connectivity provider, not a transport policy engine.

### 3. App And Android Transport Policy

Transport choice lives on the phone.

The phone should:

- track whether facility Wi-Fi has recently succeeded for a device
- prefer facility Wi-Fi only when that proof exists and remains fresh
- otherwise connect through stored SoftAP credentials
- use BLE only when a new SoftAP ticket or recovery control exchange is required

The minimum practical priority order becomes:

1. proven facility Wi-Fi
2. stored SoftAP
3. BLE-assisted SoftAP recovery

This preserves the user requirement that SoftAP is always present while still using the less demanding path when facility Wi-Fi has actually earned trust.

### 4. Smooth Handoff Rules

Every runtime action that can move transports must use explicit acquire/release boundaries.

For any SoftAP recovery or test:

1. ensure Wi-Fi permissions are granted
2. bind to the SoftAP network
3. fetch runtime state
4. update transport health state
5. release the binding in all exit paths

For facility Wi-Fi:

1. use the saved runtime base URL only if the path has succeeded recently enough
2. mark the path degraded immediately on fetch failure
3. transition to SoftAP without requiring manual repair

For BLE recovery:

1. rediscover the device
2. verify control/auth state
3. request or refresh SoftAP access if needed
4. return to Wi-Fi as quickly as possible

### 5. Permission Model

The app must request Wi-Fi and BLE permissions before those transports are first needed, not only after falling into a failing recovery branch.

Required behavior:

- device detail and monitoring flows should surface missing permissions early
- the app should not hide Wi-Fi failures behind BLE or runtime errors
- monitoring startup should preserve permission-related status instead of collapsing to a generic failure

### 6. BLE Reliability Fixes

BLE recovery must tolerate transient discovery problems.

Required behavior:

- retry scan/connect/service discovery on `BLE_SERVICE_NOT_FOUND` and similar transient GATT failures
- clear or refresh stale GATT state when reconnecting
- rely on service-data device identification when possible rather than only name suffix matching

BLE remains important, but only as the last recovery tier.

### 7. Truthful Facility Wi-Fi Provisioning

Facility Wi-Fi provisioning must not claim success until the station join actually succeeds.

The firmware should either:

- return confirmed success with a usable facility runtime URL, or
- store credentials and report a pending or failed join state explicitly

The app should only treat facility Wi-Fi as transport-ready after confirmed success.

### 8. Transport Health State

The app/runtime config should persist enough state to make stable decisions:

- last successful facility Wi-Fi runtime fetch
- last successful SoftAP runtime fetch
- last active transport
- last runtime error by transport
- whether facility Wi-Fi is considered proven

This is intentionally a simple app-side health model, not a heavy ESP32 scoring engine.

## Testing And Verification

Required verification focus:

- reconnect after ESP32 power loss and reboot
- SoftAP available after enrollment and after reboot
- facility Wi-Fi only preferred after real success
- clean fallback from facility Wi-Fi to SoftAP
- BLE service-discovery retries recover from transient failures
- Wi-Fi permission prompt appears before first SoftAP bind when needed

## Result

This design makes the ESP32 continuously reachable, keeps policy complexity off the microcontroller, and turns the mobile side into the transport decision-maker. That is the right split for a production-grade ColdGuard connection stack.
