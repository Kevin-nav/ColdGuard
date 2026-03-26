# BLE-Primary Shared SoftAP Design

**Goal:** Realign ColdGuard transport ownership around a single BLE-primary controller with offline failover, while keeping SoftAP for authorized secondary access and facility Wi-Fi as an optional runtime data path.

**Architecture:** The ESP32 will maintain one BLE-primary lease at a time for the current nearby authorized phone. That primary session is dynamic and offline-capable: it is acquired by the first authorized nearby phone, renewed by BLE heartbeats, and released by lease expiry rather than by manual user settings. Additional authorized nearby phones never preempt an active BLE-primary lease; they may only use temporary SoftAP shared access. Facility Wi-Fi remains a runtime transport when reachable, but it no longer defines ownership or background monitoring behavior.

**Tech Stack:** Arduino ESP32 transport harness, Expo React Native, Android native Kotlin bridge/service layer, SQLite runtime/session storage, offline action tickets and grants.

---

## Target Operating Model

The device must separate three concepts that are currently conflated:

- **Authorization:** which users and phones are allowed to access the ESP32 offline
- **Primary control session:** the single phone that currently owns BLE-primary
- **Runtime transport:** the pipe used to move runtime data after authorization

The intended behavior is:

- The first authorized nearby phone claims BLE-primary.
- The primary phone renews a BLE lease with lightweight heartbeats.
- While the lease is active, no other phone may take BLE-primary.
- Other authorized nearby phones may still connect, but only through temporary SoftAP shared access.
- If BLE-primary heartbeats stop and the lease expires, the next authorized nearby phone may claim BLE-primary offline.
- Facility Wi-Fi may be used for runtime transport when available, but it does not establish or transfer ownership.

## Session Rules

Recommended default lease behavior:

- BLE heartbeat interval: 10 seconds
- Primary lease timeout: 35 seconds
- Same-phone reconnect before lease expiry resumes primary control without contention
- Secondary phones never preempt an active lease
- Secondary phones may request SoftAP shared access only if they are offline-authorized

The ESP32 should explicitly track:

- `primaryControllerUserId`
- `primaryControllerClientId`
- `primaryLeaseExpiresAtMs`
- `primaryLeaseSessionId`
- `sharedSoftApEnabled`

The app should explicitly track:

- whether this phone is the current BLE-primary controller
- whether this phone only has secondary/shared access
- which runtime transport is currently active for data access

## Pairing and Enrollment Impact

Current enrollment remains BLE-first and can keep the native Android BLE transaction. The current SoftAP smoke test can remain as a provisioning verification step, but it should no longer imply that Wi-Fi or SoftAP becomes the steady-state background monitoring model.

The realigned post-enrollment behavior is:

1. Supervisor enrolls the device over BLE.
2. Enrollment distributes offline-capable authorization to all intended field users.
3. The first authorized nearby phone claims BLE-primary.
4. Background ownership is maintained by BLE lease renewals, not by Wi-Fi/SoftAP polling.
5. SoftAP is opened only for explicit secondary/shared access.
6. Facility Wi-Fi remains a runtime transport option, not an ownership mechanism.

## Runtime Usage Model

### Primary nearby authorized phone

- claims BLE-primary
- keeps the lease alive with BLE heartbeats
- may fetch runtime data over facility Wi-Fi when reachable
- may fall back to BLE data retrieval in the field when Wi-Fi is unavailable

### Secondary nearby authorized phone

- cannot take BLE-primary while the lease is active
- may request temporary shared access
- receives temporary SoftAP access if authorized
- remains secondary only

### Primary departure and failover

- BLE heartbeats stop when the primary phone leaves
- lease expires after timeout
- next authorized nearby phone may claim BLE-primary offline

This supports portable field workflows where the storage unit moves between staff without guaranteed internet access.

## Current Code Realignment Required

### 1. Background monitoring architecture

Current code still treats background monitoring as Wi-Fi/SoftAP-led:

- `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`
- `src/features/devices/services/connection-service.ts`
- `src/features/notifications/providers/notification-provider.tsx`

Realignment:

- replace Wi-Fi/SoftAP-first background monitoring with BLE-primary lease ownership
- stop automatic runtime polling from driving ownership
- make Wi-Fi runtime access explicit and transport-scoped

### 2. Runtime/session state model

Current runtime config tracks transport and monitoring mode but not ownership role cleanly.

Realignment:

- add explicit session role/state for `primary`, `secondary`, or `none`
- add lease metadata for the current phone
- separate control transport from data transport

### 3. Firmware session ownership

Current firmware already has BLE auth, ticket verification, SoftAP issuance, and Bluetooth-primary runtime metadata.

Realignment:

- add BLE-primary lease ownership to device state
- add heartbeat and lease expiry handling
- gate SoftAP shared access based on authorization and active primary ownership
- allow the next authorized phone to claim BLE-primary only after lease expiry

### 4. UI and authorization presentation

Current UI wording is moving toward Bluetooth-primary semantics, but ownership behavior is not represented.

Realignment:

- remove any notion of manually selecting a permanent primary user
- present dynamic state such as:
  - `You are the primary controller`
  - `Another authorized device is primary; shared access only`
  - `Primary unavailable; claim control`
- use assignment UI to manage authorization lists, not to pick a permanent owner

## What Remains Valid

The redesign is a realignment, not a restart. These current building blocks remain useful:

- BLE enrollment/authentication pipeline
- offline action tickets and grants
- SoftAP handoff machinery
- facility Wi-Fi provisioning
- runtime payload metadata that marks Bluetooth as primary
- Android native BLE/Wi-Fi bridge infrastructure

## Recommended Implementation Direction

Implement a BLE-primary single-owner lease with offline failover, keep SoftAP for authorized secondary access, and treat facility Wi-Fi purely as a runtime transport path. Remove the assumption that post-enrollment background monitoring should be Wi-Fi/SoftAP-led.
