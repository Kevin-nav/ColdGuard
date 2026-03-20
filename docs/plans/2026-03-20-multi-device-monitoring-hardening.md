# Multi-Device Monitoring And Transport Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make one phone reliably background-monitor multiple ColdGuard devices while fixing the current protocol, notification, lifecycle, and firmware correctness issues uncovered in review.

**Architecture:** Android becomes the primary background monitoring engine through one multi-device foreground service with per-device status tracking. The app stops duplicate monitored-device polling, the backend and firmware align on one action-ticket contract, and firmware stops reporting optimistic runtime success states.

**Tech Stack:** Expo React Native app, Expo Router, SQLite, Convex backend, Android Expo module in Kotlin, ESP32 Arduino firmware, BLE plus Wi-Fi local transport.

---

### Task 1: Fix the notification identity model

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Modify: `src/features/notifications/services/inbox-sync.ts`
- Modify: `src/features/notifications/services/inbox-sync.test.ts`

**Step 1: Write the failing tests**

Add tests proving that:
- local derived notifications query devices by institution ID, not institution name
- cached remote incidents still display institution name correctly
- offline-derived incidents merge with remote incidents for the same device and incident type

**Step 2: Run the tests to verify failure**

Run: `npm test -- src/features/notifications/services/inbox-sync.test.ts`

Expected: FAIL because derived-notification loading still uses institution name as a repository key.

**Step 3: Implement the minimal fix**

Change notification loading to carry both:
- `institutionId` for data lookups
- `institutionName` for display

Update provider state and sync helpers accordingly.

**Step 4: Re-run the tests**

Run: `npm test -- src/features/notifications/services/inbox-sync.test.ts`

Expected: PASS.

### Task 2: Stop device detail auto-connect and keep device actions explicit

**Files:**
- Modify: `app/device/[id].tsx`
- Modify: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

**Step 1: Write the failing screen tests**

Add tests proving that:
- opening the screen does not call `connectOrRecoverDevice`
- manual button presses still call `connectOrRecoverDevice`
- runtime session state is loaded from cached status only on mount

**Step 2: Run the tests**

Run: `npm test -- src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: FAIL because the screen auto-connects on mount.

**Step 3: Implement the minimal UI change**

Remove the mount-driven reconnect effect and keep:
- manual reconnect
- manual connection test
- manual monitoring enable

**Step 4: Re-run the tests**

Run: `npm test -- src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: PASS.

### Task 3: Guarantee SoftAP release in JS connection flows

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/connection-service.test.ts`
- Modify: `src/features/devices/services/wifi-bridge.ts`

**Step 1: Write the failing service tests**

Add tests proving that:
- SoftAP binding is released after successful recovery
- SoftAP binding is released after runtime fetch failure
- manual connection test and reconnect flows both release bindings

**Step 2: Run the tests**

Run: `npm test -- src/features/devices/services/connection-service.test.ts`

Expected: FAIL because `release()` is not guaranteed today.

**Step 3: Implement the minimal lifecycle fix**

Wrap SoftAP connection work in `try/finally` and call bridge release in all exit paths.

**Step 4: Re-run the tests**

Run: `npm test -- src/features/devices/services/connection-service.test.ts`

Expected: PASS.

### Task 4: Align action-ticket version semantics between backend and firmware-facing app flows

**Files:**
- Modify: `convex/devices.ts`
- Modify: `convex/devices.test.ts`
- Modify: `src/features/devices/services/device-directory.ts`
- Modify: `src/features/devices/services/device-directory.test.ts`

**Step 1: Write the failing backend tests**

Add tests covering:
- first post-enrollment connect ticket validity
- post-assignment connect ticket validity
- decommission ticket validity
- version or counter changes after reassignment/decommission where intended

**Step 2: Run the tests**

Run: `npm test -- convex/devices.test.ts src/features/devices/services/device-directory.test.ts`

Expected: FAIL because current issuance semantics do not match firmware expectations.

**Step 3: Implement the minimal contract fix**

Choose one consistent rule and apply it everywhere:
- either issue the next counter and require strictly newer
- or accept equal current-version tickets and stop rotating on verification

Keep the backend, app cache, and firmware contract consistent.

**Step 4: Re-run the tests**

Run: `npm test -- convex/devices.test.ts src/features/devices/services/device-directory.test.ts`

Expected: PASS.

### Task 5: Fix action-ticket time semantics in firmware

**Files:**
- Modify: `firmware/esp32_transport_harness/src/action_ticket.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Write the firmware verification checklist**

Document bench cases for:
- expired ticket rejection
- valid ticket acceptance
- clock drift tolerance
- nonce freshness behavior

**Step 2: Implement the minimal firmware fix**

Use a consistent time basis for issued timestamps and expiry checks.

If the firmware continues to use device uptime for freshness, it must compare relative windows instead of absolute epoch timestamps.

**Step 3: Manually verify the checklist**

Expected:
- expired tickets are rejected
- valid tickets are accepted
- no epoch-vs-uptime false positives

### Task 6: Make firmware Wi-Fi provisioning truthful

**Files:**
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/ble_recovery.cpp`

**Step 1: Write the bench checklist**

Cover:
- successful facility join
- failed password
- AP unreachable
- returned runtime base URL after success

**Step 2: Implement the minimal provisioning fix**

Change `provisionFacilityWifi` so the response distinguishes:
- confirmed join success
- credentials stored but join pending or failed

Do not return a facility runtime URL as confirmed unless the station join actually succeeded.

**Step 3: Manually verify the checklist**

Expected:
- false success is eliminated
- the app only persists confirmed facility runtime endpoints

### Task 7: Make firmware runtime payloads internally consistent

**Files:**
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `src/features/devices/services/connection-service.test.ts`

**Step 1: Add the failing expectations**

Add tests or harness expectations that:
- `mktStatus` matches emitted temperature state
- alert cursors remain stable for an ongoing condition
- repeated unchanged alerts do not look like new incidents every poll

**Step 2: Implement the minimal runtime fix**

Replace `millis()`-only alert identities with stable per-condition cursors and emit a truthful `mktStatus`.

**Step 3: Re-run the relevant tests**

Run: `npm test -- src/features/devices/services/connection-service.test.ts`

Expected: PASS for app-side parsing expectations.

### Task 8: Replace singleton monitoring service APIs with multi-device APIs

**Files:**
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridge.types.ts`
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.ts`
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts`

**Step 1: Write the failing bridge tests**

Cover:
- starting monitoring for multiple devices
- stopping one device without clearing all devices
- returning per-device monitoring status maps

**Step 2: Run the tests**

Run: `npm test -- modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts`

Expected: FAIL because the bridge is singleton-only.

**Step 3: Implement the minimal bridge contract**

Introduce multi-device bridge functions and internal status mapping while preserving a clean JS API.

**Step 4: Re-run the tests**

Run: `npm test -- modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts`

Expected: PASS.

### Task 9: Rework the Android foreground service into a per-device registry

**Files:**
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiSessionController.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt`

**Step 1: Write the native verification checklist**

Cover:
- multiple monitored devices active together
- one device failing does not stop others
- SoftAP reuse and release
- per-device alert dedupe
- status updates remain device-specific

**Step 2: Implement the minimal service refactor**

Add:
- a monitored-device registry
- per-device poll scheduling
- per-device status persistence in memory
- per-device alert dedupe state

Keep one foreground notification for the service as a whole.

**Step 3: Manually verify the checklist**

Expected:
- service can monitor several devices concurrently
- per-device status is accurate
- stopping one device leaves others running

### Task 10: Stop duplicate JS polling when native monitoring is active

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Modify: `src/features/devices/services/wifi-bridge.ts`
- Modify: `src/lib/storage/sqlite/device-runtime-repository.ts`
- Modify: `src/features/notifications/__tests__/notifications-screen.test.tsx`

**Step 1: Write the failing tests**

Add tests proving that:
- JS does not call `pollMonitoredDeviceRuntime` for devices already owned by the native monitoring service
- notification refresh still updates inbox state

**Step 2: Run the tests**

Run: `npm test -- src/features/notifications/__tests__/notifications-screen.test.tsx src/features/notifications/services/inbox-sync.test.ts`

Expected: FAIL because JS still loops through monitored devices.

**Step 3: Implement the minimal ownership change**

Fetch native monitoring status and skip JS runtime polling for devices currently monitored natively.

**Step 4: Re-run the tests**

Run: `npm test -- src/features/notifications/__tests__/notifications-screen.test.tsx src/features/notifications/services/inbox-sync.test.ts`

Expected: PASS.

### Task 11: Update app-side monitoring commands for multi-device use

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/wifi-bridge.ts`
- Modify: `app/device/[id].tsx`
- Modify: `src/features/devices/services/connection-service.test.ts`

**Step 1: Write the failing tests**

Cover:
- enabling monitoring for one device does not overwrite another
- disabling one device leaves other monitored devices intact
- `getDeviceRuntimeSession` merges per-device native status correctly

**Step 2: Run the tests**

Run: `npm test -- src/features/devices/services/connection-service.test.ts src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: FAIL because monitoring commands are singleton-oriented.

**Step 3: Implement the minimal multi-device command changes**

Update app service calls and screen behavior to use per-device monitoring actions and per-device status queries.

**Step 4: Re-run the tests**

Run: `npm test -- src/features/devices/services/connection-service.test.ts src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: PASS.

### Task 12: Replace network-status polling with event-driven updates

**Files:**
- Modify: `src/features/network/network-status.ts`
- Modify: `src/features/network/network-status.test.ts`

**Step 1: Write the failing tests**

Add tests proving:
- connectivity changes are driven by listeners or subscriptions
- there is no fixed 7-second polling loop

**Step 2: Run the tests**

Run: `npm test -- src/features/network/network-status.test.ts`

Expected: FAIL because the current implementation polls.

**Step 3: Implement the minimal network-status fix**

Use the platform network listener and keep a one-time initial load.

**Step 4: Re-run the tests**

Run: `npm test -- src/features/network/network-status.test.ts`

Expected: PASS.

### Task 13: Repair the existing onboarding regression and noisy tests

**Files:**
- Modify: `app/(onboarding)/profile.tsx`
- Modify: `src/features/onboarding/__tests__/profile-screen.test.tsx`
- Modify: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

**Step 1: Reproduce the failures**

Run: `npm test -- src/features/onboarding/__tests__/profile-screen.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected:
- profile screen navigation failure
- `act(...)` warnings from async device details effects

**Step 2: Implement the minimal fixes**

Fix the profile navigation path behavior and update tests to await async screen effects correctly.

**Step 3: Re-run the tests**

Run: `npm test -- src/features/onboarding/__tests__/profile-screen.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: PASS with warnings removed or reduced to known unavoidable cases.

### Task 14: Run the targeted regression suite

**Files:**
- No code changes required

**Step 1: Run the full targeted suite**

Run:

```bash
npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/features/notifications/services/inbox-sync.test.ts src/features/network/network-status.test.ts src/features/dashboard/__tests__/device-details-screen.test.tsx src/features/onboarding/__tests__/profile-screen.test.tsx convex/devices.test.ts modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts
```

Expected: PASS.

**Step 2: Run the full app test suite**

Run: `npm test -- --runInBand`

Expected: all suites pass or any remaining failures are understood and documented.

**Step 3: Record manual verification notes**

Document:
- multi-device monitoring behavior
- background notification behavior on Android
- firmware provisioning outcomes
- remaining known risks
