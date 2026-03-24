# Native Enrollment With Temporary SoftAP Smoke Test Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move ColdGuard enrollment into the native Android stack so BLE pairing and the temporary SoftAP smoke test run as one reliable transaction with stage reporting, verbose logs, and improved failure UI.

**Architecture:** Add a native Android enrollment controller exposed through the existing Expo Wi-Fi bridge module, keep JavaScript as the UI/state shell, and only persist enrollment success after native code confirms the BLE enrollment flow and temporary SoftAP verification both completed. The UI will subscribe to progress stages and render a modal with stage text, user-friendly errors, and copyable developer diagnostics.

**Tech Stack:** React Native, Expo modules, TypeScript, Kotlin, `react-native-ble-plx` for existing JS BLE references, Android BluetoothGatt, Android Wi-Fi/network binding, Jest

---

### Task 1: Define Native Enrollment Contract

**Files:**
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridge.types.ts`
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.ts`
- Test: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts`

**Step 1: Write the failing test**

Add tests for a new native API surface that exposes:

- `startEnrollmentAsync(...)`
- `getEnrollmentStatusAsync(...)` or an event-based progress channel
- returned payload with final enrollment result and developer diagnostics

**Step 2: Run test to verify it fails**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: FAIL because the enrollment API is not exported yet.

**Step 3: Write minimal implementation**

Add TypeScript types for:

- enrollment request payload
- stage event payload
- enrollment success payload
- enrollment failure diagnostics payload

Expose stub methods in the module wrapper.

**Step 4: Run test to verify it passes**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/src/ColdGuardWifiBridge.types.ts modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.ts modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts
git commit -m "feat: define native enrollment bridge contract"
```

### Task 2: Add Native Enrollment Stage Model

**Files:**
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`
- Create: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardEnrollmentTypes.kt`
- Test: `modules/coldguard-wifi-bridge/android/src/test/...` if Android tests exist, otherwise verify through TypeScript-driven integration later

**Step 1: Write the failing test**

Add TypeScript or module-wrapper tests that expect enrollment stage payloads to contain:

- stage key
- human-readable stage label
- attempt number
- timestamp or elapsed ms
- optional detail text

**Step 2: Run test to verify it fails**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: FAIL because stage payloads are not shaped yet.

**Step 3: Write minimal implementation**

Create shared Kotlin models/enums for native enrollment stages and diagnostics serialization.

**Step 4: Run test to verify it passes**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardEnrollmentTypes.kt modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts
git commit -m "feat: add native enrollment stage types"
```

### Task 3: Implement Native BLE Enrollment Controller

**Files:**
- Create: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`

**Step 1: Write the failing test**

Add or update JS-facing tests to expect the native flow to emit the BLE stages:

- finding device
- connecting
- discovering services
- establishing secure channel
- completing pairing

**Step 2: Run test to verify it fails**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: FAIL because the native controller does not emit BLE enrollment stages yet.

**Step 3: Write minimal implementation**

Implement the native BLE enrollment transaction:

- scan device by expected deviceId
- connect GATT
- discover services
- `hello`
- `enroll.begin`
- `enroll.commit`

Keep the GATT session open after BLE enrollment succeeds.

**Step 4: Run test to verify it passes**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt
git commit -m "feat: move ble enrollment into native controller"
```

### Task 4: Add Temporary SoftAP Smoke Test To Native Enrollment

**Files:**
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`
- Modify: any existing Wi-Fi/network binding helpers under `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/`

**Step 1: Write the failing test**

Add tests expecting the native enrollment flow to emit and complete:

- requesting temporary device Wi-Fi
- connecting to device Wi-Fi
- verifying device connection

and to fail enrollment if the smoke test fails.

**Step 2: Run test to verify it fails**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: FAIL because enrollment currently ends before SoftAP verification.

**Step 3: Write minimal implementation**

Extend native enrollment to:

- issue `grant.verify` if required by current contract
- request `wifi.ticket.request`
- join the returned SoftAP
- bind network traffic
- fetch runtime smoke-test endpoint
- release network binding after the verification completes

Keep BLE alive until the smoke test is complete.

**Step 4: Run test to verify it passes**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt
git commit -m "feat: add softap smoke test to native enrollment"
```

### Task 5: Add Verbose Native Diagnostics

**Files:**
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`

**Step 1: Write the failing test**

Add JS-facing tests expecting developer diagnostics payloads to include:

- final stage
- attempt counts
- raw error message
- identifiers like deviceId and SSID when available

**Step 2: Run test to verify it fails**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: FAIL because diagnostics payloads are incomplete.

**Step 3: Write minimal implementation**

Add verbose structured logging and diagnostics serialization for:

- stage start/end
- retry attempts
- BLE errors
- Wi-Fi join/binding failures
- runtime fetch failures
- cleanup

**Step 4: Run test to verify it passes**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleRecoveryController.kt modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt
git commit -m "feat: add verbose native enrollment diagnostics"
```

### Task 6: Replace JS Enrollment BLE Path With Native Bridge

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/ble-client.ts`
- Test: `src/features/devices/services/connection-service.test.ts`

**Step 1: Write the failing test**

Add tests expecting `enrollColdGuardDevice(...)` to use the native enrollment bridge on Android and to persist device data only after native success.

**Step 2: Run test to verify it fails**

Run: `npm test -- connection-service.test.ts`
Expected: FAIL because enrollment still uses the JS BLE client.

**Step 3: Write minimal implementation**

Update the connection service to:

- call native enrollment on Android
- fall back only where intentionally supported
- register the device after native success returns the required metadata

Do not persist enrollment success before the temporary SoftAP smoke test result is known.

**Step 4: Run test to verify it passes**

Run: `npm test -- connection-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/devices/services/connection-service.ts src/features/devices/services/ble-client.ts src/features/devices/services/connection-service.test.ts
git commit -m "feat: route enrollment through native android bridge"
```

### Task 7: Add Enrollment Progress Modal And Failure UX

**Files:**
- Modify: `app/device/enroll.tsx`
- Modify: `src/features/devices/services/error-presenter.ts`
- Test: `src/features/devices/services/error-presenter.test.ts`
- Test: add screen tests if present for enrollment UI

**Step 1: Write the failing test**

Add tests expecting:

- a modal/popup during enrollment
- stage text updates from native events
- a temporary Wi-Fi warning stage
- better user-facing messages
- copyable developer diagnostics

**Step 2: Run test to verify it fails**

Run: `npm test -- error-presenter.test.ts`
Expected: FAIL because the current UI does not expose modal stages or enhanced diagnostics copy.

**Step 3: Write minimal implementation**

Update the enrollment screen to show:

- spinner
- live stage text
- failure view with user-safe copy
- `Copy developer details` button

Expand `presentDeviceError(...)` mappings for native enrollment and temporary SoftAP smoke-test failures.

**Step 4: Run test to verify it passes**

Run: `npm test -- error-presenter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/device/enroll.tsx src/features/devices/services/error-presenter.ts src/features/devices/services/error-presenter.test.ts
git commit -m "feat: add enrollment progress modal and diagnostics copy"
```

### Task 8: Wire Stage Updates End-To-End

**Files:**
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.ts`
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `app/device/enroll.tsx`
- Test: relevant module/service/UI tests

**Step 1: Write the failing test**

Add tests expecting native stage events to propagate from the module wrapper through the service layer into the enrollment screen.

**Step 2: Run test to verify it fails**

Run: `npm test -- connection-service.test.ts`
Expected: FAIL because progress callbacks are not threaded through yet.

**Step 3: Write minimal implementation**

Thread progress callbacks through the service and UI layers without duplicating stage state logic in multiple places.

**Step 4: Run test to verify it passes**

Run: `npm test -- connection-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.ts src/features/devices/services/connection-service.ts app/device/enroll.tsx
git commit -m "feat: wire native enrollment stage updates through app"
```

### Task 9: Update Documentation

**Files:**
- Modify: `docs/runbooks/esp32-transport-harness.md`
- Modify: `firmware/esp32_transport_harness/README.md`
- Modify: `README.md` if enrollment architecture is described there

**Step 1: Write the failing documentation check**

List the outdated statements:

- enrollment driven by JS BLE flow
- permanent SoftAP expectations
- missing temporary SoftAP smoke-test explanation

**Step 2: Verify docs are currently outdated**

Run: manual review
Expected: docs still describe the old model.

**Step 3: Write minimal documentation updates**

Document:

- native Android enrollment ownership
- temporary SoftAP smoke test during pairing
- user-visible Wi-Fi switch behavior
- required debug log sources during testing

**Step 4: Verify docs are coherent**

Run: manual review
Expected: docs match the new architecture.

**Step 5: Commit**

```bash
git add docs/runbooks/esp32-transport-harness.md firmware/esp32_transport_harness/README.md README.md
git commit -m "docs: describe native enrollment and softap smoke test"
```

### Task 10: Final Verification

**Files:**
- Verify modified files above

**Step 1: Run targeted tests**

Run: `npm test -- ColdGuardWifiBridgeModule.test.ts connection-service.test.ts error-presenter.test.ts`
Expected: PASS

**Step 2: Run any available Android module verification**

Run: project-specific Android test/build command if configured
Expected: PASS or known warnings only

**Step 3: Manual device verification**

Verify on Android hardware:

- enrollment modal stages progress correctly
- user is warned before temporary device Wi-Fi switch
- BLE enrollment succeeds
- temporary SoftAP smoke test succeeds
- failure path exposes developer diagnostics copy
- final success only occurs after smoke test success

**Step 4: Review logs**

Confirm logs show:

- stage boundaries
- retry counts
- precise failure attribution

**Step 5: Commit**

```bash
git add .
git commit -m "feat: ship native enrollment with softap smoke test"
```
