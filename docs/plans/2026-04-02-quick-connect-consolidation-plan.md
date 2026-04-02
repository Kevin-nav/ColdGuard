# Quick Connect Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current manual quick-connect flow with a code-only demo flow that asks for a single 8-digit code and discovers nearby ColdGuard networks automatically.

**Architecture:** Add nearby ColdGuard Wi-Fi discovery to the Android bridge, then refactor the app’s quick-connect path so JS receives nearby candidates, tries the entered code against them, and persists the discovered device using the runtime payload as the source of truth. Keep the existing runtime snapshot/history pipeline and local persistence model.

**Tech Stack:** Expo Router, React Native, TypeScript, Android Kotlin bridge module, Jest

---

### Task 1: Add nearby ColdGuard Wi-Fi discovery to the native bridge

**Files:**
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridge.types.ts`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`
- Modify: `src/features/devices/services/wifi-bridge.ts`
- Modify: `src/features/devices/services/wifi-bridge.test.ts`

**Step 1: Add a bridge contract for nearby ColdGuard Wi-Fi discovery**

Expose a native method that returns nearby `ColdGuard_*` SSIDs.

**Step 2: Implement Android-side discovery**

Use Android Wi-Fi APIs to return a de-duplicated list of nearby `ColdGuard_*` networks, with best-effort scan refresh.

**Step 3: Add JS wrapper coverage**

Expose the new bridge method through `wifi-bridge.ts` and test the wrapper behavior.

### Task 2: Refactor quick connect into a code-only orchestration flow

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/connection-service.test.ts`

**Step 1: Replace manual SSID input with code-only quick connect**

Change `quickConnectColdGuardDevice(...)` to accept only the quick-connect code plus profile and optional nickname.

**Step 2: Discover candidates and try nearby networks**

Ask the bridge for nearby ColdGuard SSIDs, attempt connection with the entered code, and stop on the first candidate that returns a valid runtime snapshot.

**Step 3: Persist the discovered device identity**

Use the runtime payload device identity instead of a user-entered device ID when saving the local quick-connect device and runtime config.

**Step 4: Add clear failure modes**

Return plain-English errors for no nearby candidates, invalid code, and runtime fetch failures.

### Task 3: Simplify the devices screen quick-connect UI

**Files:**
- Modify: `app/(tabs)/devices.tsx`
- Modify: `src/features/dashboard/__tests__/devices-screen.test.tsx`

**Step 1: Remove manual device ID and SSID fields**

Keep only a single code input and a primary connect button.

**Step 2: Add app-owned progress copy**

Show staged progress such as looking for nearby devices, connecting, and reading live data.

**Step 3: Keep advanced BLE enrollment separate**

Do not regress the advanced enrollment path for supervisors.

### Task 4: Simplify quick-connect detail copy

**Files:**
- Modify: `app/device/[id].tsx`
- Modify: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

**Step 1: Keep quick-connect devices framed as local sessions**

Reduce transport-heavy wording on the quick-connect detail path.

**Step 2: Preserve existing runtime actions**

Retain refresh/reconnect behavior while making labels easier to understand for demo users.

### Task 5: Verify the consolidated flow

**Files:**
- No additional file changes expected

**Step 1: Run focused tests**

Run: `npm test -- --runInBand src/features/devices/services/wifi-bridge.test.ts src/features/devices/services/connection-service.test.ts src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: PASS

**Step 2: Run a final grep**

Run: `rg -n "SoftAP name|CG-ESP32-A100|device ID, SoftAP name|Quick connect" app src modules/coldguard-wifi-bridge`

Expected: the demo quick-connect entry point no longer asks for manual device ID and SSID, while advanced/device-detail copy remains intentional.
