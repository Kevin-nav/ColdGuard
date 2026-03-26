# BLE-Primary Shared SoftAP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Wi-Fi-led background monitoring with a BLE-primary lease model, keep SoftAP for authorized secondary access, and preserve facility Wi-Fi as an optional runtime transport.

**Architecture:** Extend the firmware transport harness with explicit BLE-primary lease ownership and heartbeat handling, then realign the Android native monitoring layer and app runtime/session model around control-role state instead of transport-first monitoring. Enrollment stays BLE-first, SoftAP remains available for explicit shared access, and UI surfaces dynamic ownership rather than a permanent primary user setting.

**Tech Stack:** Arduino ESP32 C++, Expo React Native, Kotlin Android service/module code, SQLite, Jest, Arduino CLI

---

### Task 1: Add firmware lease state to the transport harness

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_state.h`
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`
- Test: `firmware/esp32_transport_harness/src/ble_recovery.cpp`

**Step 1: Add failing compile references for primary lease fields**

Add new `DeviceState` fields used by upcoming lease code:

- `primaryControllerUserId`
- `primaryControllerClientId`
- `primaryLeaseSessionId`
- `primaryLeaseExpiresAtMs`
- `primaryLeaseHeartbeatIntervalMs`
- `primaryLeaseTimeoutMs`

**Step 2: Run a firmware compile to verify missing field errors**

Run: `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_transport_harness`

Expected: FAIL with missing `DeviceState` member errors

**Step 3: Implement persisted/default state wiring**

Initialize the fields in defaults and persist them in the preferences load/save helpers with safe reset behavior on boot.

**Step 4: Re-run firmware compile**

Run: `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_transport_harness`

Expected: PASS or fail later on lease command references, but not on missing state fields

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_state.h firmware/esp32_transport_harness/src/device_state.cpp
git commit -m "feat: add firmware primary lease state"
```

### Task 2: Add BLE-primary claim and heartbeat firmware commands

**Files:**
- Modify: `firmware/esp32_transport_harness/src/ble_recovery.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_state.h`
- Test: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Add failing command dispatch for lease commands**

Add new BLE command branches for:

- `primary.claim`
- `primary.heartbeat`
- `shared.access.request`
- `primary.status`

Return placeholder errors first.

**Step 2: Compile to verify command plumbing**

Run: `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_transport_harness`

Expected: PASS with placeholder implementations

**Step 3: Implement minimal lease rules**

Implement:

- claim succeeds when there is no active lease or the lease is expired
- claim records user/client/session identifiers and new expiry
- heartbeat only succeeds for the current active session
- `shared.access.request` rejects when requester is not authorized or requester is primary
- `primary.status` reports whether this caller is primary, secondary-only, or blocked by another primary

**Step 4: Re-run firmware compile**

Run: `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_transport_harness`

Expected: PASS

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/ble_recovery.cpp firmware/esp32_transport_harness/src/device_state.h docs/runbooks/esp32-transport-harness.md
git commit -m "feat: add firmware ble primary lease commands"
```

### Task 3: Gate SoftAP shared access by primary lease state

**Files:**
- Modify: `firmware/esp32_transport_harness/src/ble_recovery.cpp`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/runtime_mock_data.cpp`

**Step 1: Write minimal failing behavior via status payload expectations**

Update runtime payload generation assumptions so payloads can distinguish:

- `bluetooth_primary`
- `temporary_shared_access`
- `facility_runtime`

with primary lease-aware status text.

**Step 2: Compile to verify no API mismatch**

Run: `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_transport_harness`

Expected: PASS or fail on payload field mismatches

**Step 3: Implement SoftAP gating**

Make `wifi.ticket.request` and shared SoftAP issuance honor:

- primary may request transport/runtime recovery for itself
- secondary authorized users may request shared access only while another primary is active
- unauthorized users are rejected

**Step 4: Re-run firmware compile**

Run: `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_transport_harness`

Expected: PASS

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/ble_recovery.cpp firmware/esp32_transport_harness/src/wifi_runtime.cpp firmware/esp32_transport_harness/src/runtime_mock_data.cpp
git commit -m "feat: gate shared softap by ble primary lease"
```

### Task 4: Extend app types and persistence for control role state

**Files:**
- Modify: `src/features/devices/types.ts`
- Modify: `src/lib/storage/sqlite/schema.ts`
- Modify: `src/lib/storage/sqlite/device-runtime-repository.ts`
- Test: `src/lib/storage/sqlite/device-runtime-repository.test.ts`

**Step 1: Add a failing repository test for control-role persistence**

Add expectations for persisted fields such as:

- `controlRole`
- `primaryLeaseSessionId`
- `primaryLeaseExpiresAt`
- `primaryControllerUserId`

**Step 2: Run the repository test to verify failure**

Run: `npm test -- --runInBand src/lib/storage/sqlite/device-runtime-repository.test.ts`

Expected: FAIL because new fields are not persisted yet

**Step 3: Implement schema and repository changes**

Add the new columns, map them into `DeviceRuntimeConfig`, and preserve backward-compatible defaults.

**Step 4: Re-run the repository test**

Run: `npm test -- --runInBand src/lib/storage/sqlite/device-runtime-repository.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/devices/types.ts src/lib/storage/sqlite/schema.ts src/lib/storage/sqlite/device-runtime-repository.ts src/lib/storage/sqlite/device-runtime-repository.test.ts
git commit -m "feat: persist device control role state"
```

### Task 5: Add BLE-primary control APIs to the native/app bridge

**Files:**
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridge.types.ts`
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.ts`
- Modify: `src/features/devices/services/ble-client.ts`
- Test: `src/features/devices/services/ble-client.test.ts`

**Step 1: Add a failing BLE client test for primary claim/heartbeat**

Cover:

- `primary.claim`
- `primary.heartbeat`
- `primary.status`
- `shared.access.request`

**Step 2: Run the BLE client test to verify failure**

Run: `npm test -- --runInBand src/features/devices/services/ble-client.test.ts`

Expected: FAIL because commands are not implemented

**Step 3: Implement TypeScript command support**

Extend transport payload typing and BLE client helpers to send and parse the new commands.

**Step 4: Re-run the BLE client test**

Run: `npm test -- --runInBand src/features/devices/services/ble-client.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/src/ColdGuardWifiBridge.types.ts modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.ts src/features/devices/services/ble-client.ts src/features/devices/services/ble-client.test.ts
git commit -m "feat: add ble primary session client commands"
```

### Task 6: Replace Wi-Fi-led monitoring with BLE-primary lease maintenance

**Files:**
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`
- Modify: `src/features/devices/services/connection-service.ts`
- Test: `src/features/devices/services/connection-service.test.ts`

**Step 1: Add a failing service-layer test for BLE-primary monitoring**

Cover:

- starting monitoring claims or resumes BLE-primary
- active lease prevents shared phones from becoming primary
- monitoring no longer starts by preferring `facility_wifi` or `softap`

**Step 2: Run the service test to verify failure**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts`

Expected: FAIL because monitoring is still transport-first

**Step 3: Implement minimal BLE-primary monitoring flow**

Change monitoring semantics so:

- the foreground service maintains BLE-primary heartbeat state
- Wi-Fi access is not polled by default just because monitoring is enabled
- background state reflects control-role ownership rather than transport preference

**Step 4: Re-run the service test**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt src/features/devices/services/connection-service.ts src/features/devices/services/connection-service.test.ts
git commit -m "feat: switch monitoring to ble primary lease"
```

### Task 7: Update app reopen/resume behavior to respect control roles

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Test: `src/features/notifications/providers/notification-provider.test.tsx`

**Step 1: Add a failing provider test for primary-role restart behavior**

Verify that app reopen:

- resumes BLE-primary monitoring only for devices this phone owns or can reclaim
- does not restart Wi-Fi-led polling loops for already monitored devices

**Step 2: Run the provider test to verify failure**

Run: `npm test -- --runInBand src/features/notifications/providers/notification-provider.test.tsx`

Expected: FAIL because current restart behavior assumes transport-led monitoring

**Step 3: Implement role-aware restart behavior**

Resume BLE lease monitoring, keep fallback JS polling only for non-native contexts, and stop transport-first restart logic.

**Step 4: Re-run the provider test**

Run: `npm test -- --runInBand src/features/notifications/providers/notification-provider.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/notifications/providers/notification-provider.tsx src/features/notifications/providers/notification-provider.test.tsx
git commit -m "feat: resume ble primary monitoring on app reopen"
```

### Task 8: Update device UI to show dynamic ownership and shared access

**Files:**
- Modify: `app/device/[id].tsx`
- Test: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

**Step 1: Add a failing UI test for dynamic ownership labels**

Cover:

- current phone is primary
- another authorized device is primary and this phone gets shared access only
- primary unavailable and this phone can claim control

**Step 2: Run the UI test to verify failure**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: FAIL because the screen only shows transport/session labels today

**Step 3: Implement the UI changes**

Update the screen to reflect:

- dynamic BLE ownership state
- shared-access eligibility
- explicit shared SoftAP actions
- no permanent “primary user” setting

**Step 4: Re-run the UI test**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add app/device/[id].tsx src/features/dashboard/__tests__/device-details-screen.test.tsx
git commit -m "feat: surface dynamic ble ownership in device ui"
```

### Task 9: Update transport docs and run focused validation

**Files:**
- Modify: `docs/runbooks/esp32-transport-harness.md`
- Modify: `firmware/README.md`
- Modify: `README.md`

**Step 1: Update docs to match BLE-primary/shared-SoftAP behavior**

Document:

- BLE-primary lease ownership
- SoftAP secondary/shared access rules
- facility Wi-Fi as transport-only
- offline failover expectations

**Step 2: Run focused validation**

Run:

- `npm test -- --runInBand src/features/devices/services/ble-client.test.ts src/features/devices/services/connection-service.test.ts src/features/notifications/providers/notification-provider.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx src/lib/storage/sqlite/device-runtime-repository.test.ts`
- `arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32_transport_harness`

Expected: PASS

**Step 3: Commit**

```bash
git add docs/runbooks/esp32-transport-harness.md firmware/README.md README.md
git commit -m "docs: align transport docs with ble primary model"
```
