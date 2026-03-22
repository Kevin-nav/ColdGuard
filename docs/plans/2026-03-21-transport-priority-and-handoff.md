# Transport Priority And Handoff Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make ColdGuard reconnect reliably after enrollment and power loss by keeping ESP32 SoftAP continuously available, preferring proven facility Wi-Fi when healthy, and using BLE only for recovery/control.

**Architecture:** The ESP32 remains a simple connectivity provider that keeps SoftAP alive and reports truthful station state. The app and Android bridge own transport policy, permission handling, health tracking, and seamless handoff between facility Wi-Fi, SoftAP, and BLE-assisted recovery.

**Tech Stack:** Expo React Native app, SQLite runtime config storage, Android Expo module in Kotlin, ESP32 Arduino firmware, BLE plus Wi-Fi local transport.

---

### Task 1: Persist explicit transport health in app runtime config usage

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/connection-service.test.ts`
- Check: `lib/storage/sqlite/device-runtime-repository.ts`

**Step 1: Write the failing tests**

Add tests proving that:
- facility Wi-Fi is preferred only after a confirmed successful runtime fetch
- SoftAP is used when facility Wi-Fi is unproven or stale
- a facility Wi-Fi failure degrades the path and falls back to SoftAP

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/devices/services/connection-service.test.ts`
Expected: FAIL because the current policy does not clearly separate proven facility Wi-Fi from saved-but-unproven facility credentials.

**Step 3: Write minimal implementation**

Track and use:
- last successful facility Wi-Fi fetch time
- last successful SoftAP fetch time
- active transport
- last runtime error

Gate facility Wi-Fi preference on a recent confirmed success instead of mere credential presence.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/devices/services/connection-service.test.ts`
Expected: PASS

### Task 2: Request Wi-Fi permissions before SoftAP operations

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `app/device/[id].tsx`
- Modify: `src/features/devices/services/connection-service.test.ts`

**Step 1: Write the failing tests**

Add tests proving that:
- SoftAP connect paths request Wi-Fi permissions before binding
- permission denial returns a clear `WIFI_PERMISSION_REQUIRED` error
- reconnect and connection test flows surface permission failures cleanly

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/devices/services/connection-service.test.ts`
Expected: FAIL because the current permission behavior is either late or not user-visible enough in all branches.

**Step 3: Write minimal implementation**

Keep Wi-Fi permission checks at the start of SoftAP flows and ensure UI actions preserve and display that error directly.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/devices/services/connection-service.test.ts`
Expected: PASS

### Task 3: Harden BLE recovery against transient GATT/service-discovery failures

**Files:**
- Modify: `src/features/devices/services/ble-client.ts`
- Modify: `src/features/devices/services/ble-client.test.ts`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt`

**Step 1: Write the failing tests**

Add tests covering:
- retry on transient service discovery mismatch or device-id mismatch
- advertisement service-data matching for device identity
- failure only after bounded retries

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/devices/services/ble-client.test.ts`
Expected: FAIL because the current JS/client coverage does not fully assert these recovery semantics.

**Step 3: Write minimal implementation**

Use bounded retries, refresh GATT on reconnect, and prefer advertisement service-data matching over name-only heuristics. Mirror the same logic in the Android native BLE recovery path where practical.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/devices/services/ble-client.test.ts`
Expected: PASS

### Task 4: Make Android monitoring preserve transport fallback behavior

**Files:**
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiSessionController.kt`

**Step 1: Write the verification checklist**

Cover:
- monitoring starts on a device with proven facility Wi-Fi
- monitoring falls back to SoftAP when facility runtime fetch fails
- BLE recovery is only attempted after Wi-Fi paths fail
- permission-related errors remain visible in monitoring status

**Step 2: Implement the minimal native fix**

Align the service fallback order with the app:
- proven facility Wi-Fi
- stored SoftAP
- BLE-assisted SoftAP recovery

Preserve clear per-device status when permissions or BLE discovery fail.

**Step 3: Manually verify the checklist**

Expected:
- service uses the same transport order as foreground actions
- failures degrade to the next path instead of stalling

### Task 5: Keep enrolled SoftAP always available in firmware

**Files:**
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Write the bench checklist**

Cover:
- enrolled device boots with SoftAP available
- SoftAP remains available after ticket expiry
- SoftAP remains available while facility Wi-Fi is connected
- SoftAP returns after power cycle

**Step 2: Implement the minimal firmware fix**

Ensure enrolled devices:
- auto-start SoftAP on boot
- do not shut SoftAP down due to ticket expiry
- continue serving runtime endpoints while station mode is active

**Step 3: Manually verify the checklist**

Expected:
- nearby phone can always attempt local recovery through SoftAP

### Task 6: Make facility Wi-Fi provisioning and runtime reporting truthful

**Files:**
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/ble_recovery.cpp`
- Modify: `src/features/devices/services/connection-service.ts`

**Step 1: Write the verification checklist**

Cover:
- valid facility credentials
- invalid password
- AP unreachable
- runtime base URL returned only after real station success

**Step 2: Implement the minimal fix**

Return confirmed facility runtime details only after a real station join. Keep stored credentials if appropriate, but avoid presenting the path as proven until it succeeds.

**Step 3: Manually verify the checklist**

Expected:
- app no longer treats optimistic provisioning as a stable runtime path

### Task 7: Verify end-to-end reconnect priority

**Files:**
- Modify: `src/features/devices/services/connection-service.test.ts`
- Modify: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Add the final assertions**

Cover:
- reconnect priority is proven facility Wi-Fi, then SoftAP, then BLE recovery
- power-loss reconnect works because SoftAP persists
- connection test releases SoftAP binding in success and failure paths

**Step 2: Run tests and verification**

Run: `npm test -- src/features/devices/services/connection-service.test.ts src/features/devices/services/ble-client.test.ts`
Expected: PASS

**Step 3: Document bench verification**

Update the runbook with the final transport order and the expected reconnect behavior after power loss.
