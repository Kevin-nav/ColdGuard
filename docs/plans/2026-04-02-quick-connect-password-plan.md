# Quick Connect Password Shortening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current long quick-connect SoftAP password with an 8-digit numeric code that is short enough for operators to type while still satisfying the ESP32 SoftAP minimum length requirement.

**Architecture:** Keep the quick-connect flow unchanged in the app and on the device UI, but change firmware password generation so newly created or repaired quick-connect passwords are exactly 8 numeric digits. Reuse the existing persisted `wifi_pw` preference and normalize any stored password that is missing or too short by regenerating it in the new format.

**Tech Stack:** ESP32 Arduino firmware, `Preferences`, Wi-Fi SoftAP runtime, Expo/React Native Jest tests

---

### Task 1: Update firmware quick-connect password generation

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`

**Step 1: Write the failing expectation**

Document that `generateWifiPassword()` should now return exactly 8 numeric digits instead of a long hexadecimal string.

**Step 2: Implement the minimal generator change**

Change `generateWifiPassword()` to build an 8-character string from random decimal digits.

**Step 3: Keep stored password repair behavior aligned**

Continue regenerating `wifi_pw` when the stored value is absent or shorter than 8 so older invalid state still self-heals on boot.

### Task 2: Keep runtime startup aligned with the new password shape

**Files:**
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`

**Step 1: Verify SoftAP startup still uses the same minimum-length guard**

Keep the guard at 8 because the SoftAP path still requires at least 8 characters.

**Step 2: Confirm there is no stale assumption about hexadecimal or long passwords**

Review the runtime path and device UI surfaces to ensure they only display the password and do not depend on its previous format.

### Task 3: Refresh focused tests and fixtures

**Files:**
- Modify: `src/features/dashboard/__tests__/devices-screen.test.tsx`
- Modify: `src/features/devices/services/connection-service.test.ts`

**Step 1: Replace old sample passwords**

Update representative quick-connect passwords like `demo-pass-1` to 8-digit numeric fixtures.

**Step 2: Keep intent the same**

Do not widen test scope. Only update fixtures where the old password format is incidental to the behavior under test.

### Task 4: Verify the change

**Files:**
- No additional file changes expected

**Step 1: Run targeted tests**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/devices-screen.test.tsx src/features/devices/services/connection-service.test.ts`

Expected: PASS

**Step 2: Run a final grep**

Run: `rg -n "demo-pass-1|wifiPassword.length\\(\\) < 8|wifiPassword.length\\(\\) >= 8|generateWifiPassword" firmware src app`

Expected: remaining references reflect the 8-digit numeric firmware behavior and valid 8-character minimum checks.
