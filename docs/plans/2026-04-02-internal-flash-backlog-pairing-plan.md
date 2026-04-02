# Internal Flash Backlog And Pairing Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace SD-backed firmware history with an internal flash-backed unsent backlog, remove explicit SD-card reporting from the app/runtime contract, and harden pairing so overlapping work does not make enrollment unreliable.

**Architecture:** The firmware will persist the latest snapshot and queue metadata in `Preferences`, store queued unsent telemetry rows in internal flash, and bring BLE up before telemetry/storage work. The app and Android bridge will stop depending on `sdCardMounted` and will serialize enrollment against other BLE/Wi-Fi operations.

**Tech Stack:** ESP32 Arduino (`Preferences`, BLE, WebServer), React Native/Expo, TypeScript, Kotlin Expo module, Jest

---

### Task 1: Save the approved design reference

**Files:**
- Create: `docs/plans/2026-04-02-internal-flash-backlog-pairing-design.md`
- Create: `docs/plans/2026-04-02-internal-flash-backlog-pairing-plan.md`

**Step 1: Save the approved design doc**

Write the design summary, storage model, boot-order changes, app contract cleanup, and pairing serialization requirements to the design doc.

**Step 2: Save this implementation plan**

Write the implementation plan with exact file targets and verification steps.

**Step 3: Verify the docs exist**

Run: `Get-ChildItem docs/plans/2026-04-02-internal-flash-backlog-pairing-*`
Expected: both design and plan files are listed

### Task 2: Replace SD-backed firmware history with an internal flash backlog

**Files:**
- Modify: `firmware/esp32_transport_harness/src/runtime_mock_data.cpp`
- Modify: `firmware/esp32_transport_harness/src/runtime_mock_data.h`
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_state.h`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.h`
- Modify: `firmware/esp32_transport_harness/README.md`
- Modify: `firmware/README.md`

**Step 1: Write the failing expectations as targeted firmware checks**

Capture expected behaviors in comments or lightweight validation notes before refactoring:

- history no longer depends on `SD.begin`
- runtime payloads omit `sdCardMounted`
- history remains sequence-based
- oldest buffered rows are evicted when capacity is reached

**Step 2: Introduce internal backlog helpers**

Implement helpers that:

- append a telemetry row to internal flash
- page rows after `afterSequence`
- prune acknowledged or evicted rows
- persist queue metadata in `Preferences`

**Step 3: Update runtime sampling and history generation**

Make telemetry sampling write the latest snapshot plus backlog row, and make `/api/v1/runtime/history` read from the internal backlog instead of the SD card.

**Step 4: Remove explicit SD reporting**

Delete `sdCardMounted` from firmware runtime snapshot and history responses and update any firmware status text or docs that still describe SD as the active contract.

**Step 5: Verify firmware sources compile logically**

Run: `rg -n "sdCardMounted|SD.begin|/telemetry.csv" firmware/esp32_transport_harness`
Expected: no active SD-backed contract remains except intentional documentation/history notes

### Task 3: Make BLE pairing available before telemetry startup work

**Files:**
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `firmware/esp32_transport_harness/src/runtime_mock_data.cpp`

**Step 1: Reorder setup**

Move BLE initialization ahead of telemetry initialization so the device advertises before storage/sampling work.

**Step 2: Reduce blocking telemetry work**

Ensure initial telemetry/storage setup can fail without preventing boot and avoid long blocking paths in early startup where practical.

**Step 3: Verify the new boot order**

Run: `Get-Content firmware/esp32_transport_harness/esp32_transport_harness.ino`
Expected: BLE initialization occurs before telemetry initialization

### Task 4: Remove SD-card assumptions from app models and storage handling

**Files:**
- Modify: `src/features/devices/types.ts`
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/lib/storage/sqlite/reading-repository.ts`
- Modify: `src/lib/storage/sqlite/reading-repository.test.ts`
- Modify: `src/lib/storage/sqlite/device-repository.ts`
- Modify: `src/lib/storage/sqlite/device-repository.test.ts`
- Modify: related dashboard/device tests if they still require `sdCardMounted`

**Step 1: Write failing tests**

Add or update tests so runtime payload parsing and local persistence succeed when `sdCardMounted` is absent.

**Step 2: Update TypeScript models**

Remove `sdCardMounted` as a required runtime field and stop propagating it through runtime snapshot building and repository updates.

**Step 3: Update affected tests and fixtures**

Fix test data and expectations that still require `sdCardMounted`.

**Step 4: Run targeted app tests**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/lib/storage/sqlite/reading-repository.test.ts src/lib/storage/sqlite/device-repository.test.ts`
Expected: PASS

### Task 5: Serialize enrollment against competing BLE and Wi-Fi work

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/wifi-bridge.ts`
- Modify: `src/features/devices/services/connection-service.test.ts`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt`
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridge.types.ts`

**Step 1: Add a JS-side enrollment lock**

Prevent overlapping enrollment attempts and block recovery/monitoring flows for a device while enrollment is active.

**Step 2: Add native enrollment serialization**

Prevent simultaneous Android native enrollment work from competing with shared Wi-Fi/BLE session resources.

**Step 3: Preserve progress and cleanup behavior**

Keep enrollment stage events and resource release behavior intact after serialization is added.

**Step 4: Run targeted pairing tests**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/features/devices/services/wifi-bridge.test.ts`
Expected: PASS

### Task 6: Run cross-track verification

**Files:**
- Modify as needed based on failures from earlier tasks

**Step 1: Run focused grep validation**

Run: `rg -n "sdCardMounted" firmware src modules app`
Expected: only intentionally retained compatibility/storage references remain, or none if the cleanup is complete

**Step 2: Run the targeted test suite**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/features/devices/services/wifi-bridge.test.ts src/lib/storage/sqlite/reading-repository.test.ts src/lib/storage/sqlite/device-repository.test.ts`
Expected: PASS

**Step 3: Summarize residual risks**

Record any firmware-on-device validation still required, especially around ESP32 internal flash behavior and boot-time BLE availability.
