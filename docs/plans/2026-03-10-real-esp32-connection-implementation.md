# Real ESP32 Connection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Android-only real-device ColdGuard transport path with QR deep links, in-app camera scanning, real BLE plus Wi-Fi connection testing, and a transport-only ESP32 DevKit firmware harness.

**Architecture:** Keep Convex as the source of truth for grants and device state, replace the mock runtime transport path with real Android BLE and Wi-Fi modules, and add a transport-only Arduino sketch that exposes the same enrollment and reconnect contract the app expects.

**Tech Stack:** Expo SDK 55, Expo Router, Firebase Auth, Convex, SQLite cache, expo-camera, Android App Links, Android native Wi-Fi bridge, BLE client library, Arduino-ESP32, ESP32 BLE, WiFi SoftAP, WebServer, Preferences/NVS, mbedTLS.

---

### Task 1: Document the approved real-device design

**Files:**
- Create: `docs/plans/2026-03-10-real-esp32-connection-design.md`
- Create: `docs/plans/2026-03-10-real-esp32-connection-implementation.md`

**Step 1: Write the approved design and plan artifacts**

- Capture QR/deep-link flow, permissions, BLE plus Wi-Fi transport, website fallback, security model, and firmware scope.

**Step 2: Review the docs for consistency**

Run: `Get-Content docs/plans/2026-03-10-real-esp32-connection-design.md`
Expected: design sections match the approved discussion

**Step 3: Commit the planning artifacts**

```bash
git add docs/plans/2026-03-10-real-esp32-connection-design.md docs/plans/2026-03-10-real-esp32-connection-implementation.md
git commit -m "docs: add real esp32 connection design and plan"
```

### Task 2: Add real QR scan and deep-link entry

**Files:**
- Modify: `app.json`
- Modify: `package.json`
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`
- Modify: `app/(tabs)/devices.tsx`
- Create: `app/device/enroll.tsx`
- Create: `src/features/devices/services/device-linking.ts`
- Create: `src/features/devices/services/device-linking.test.ts`

**Step 1: Write the failing tests**

- Add tests for parsing HTTPS device links and preserving pending device payloads.

**Step 2: Install and configure scanner/deep-link dependencies**

Run: `npm install expo-camera react-native-ble-plx`
Expected: dependencies added without Expo version conflicts

**Step 3: Update app config**

- Add `expo-camera` plugin and Android camera permission text.
- Add Android intent filters / App Links for `coldguard.org`.

**Step 4: Implement pending-link service**

- Add storage for a pending device enrollment payload.
- Add parse helpers that accept both `https://coldguard.org/device/...` and `coldguard://device/...`.

**Step 5: Implement enrollment route**

- Add `app/device/enroll.tsx` to:
  - read deep-link params
  - require auth
  - block non-supervisors
  - route supervisors into enrollment UI

**Step 6: Add in-app QR scanner**

- Add camera-permission-driven scanner entry on the devices tab.
- Keep manual payload entry as a fallback path.

**Step 7: Run focused tests**

Run: `node node_modules\\jest\\bin\\jest.js --runInBand src/features/devices/services/device-linking.test.ts src/features/dashboard/__tests__/devices-screen.test.tsx`
Expected: PASS

### Task 3: Replace mock BLE transport with a real app-side BLE client

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Create: `src/features/devices/services/ble-client.ts`
- Create: `src/features/devices/services/ble-client.test.ts`
- Modify: `src/features/devices/types.ts`

**Step 1: Write the failing BLE tests**

- Add tests for:
  - device discovery by service UUID
  - command/response serialization
  - enrollment hello / enroll flow
  - reconnect grant verification / Wi-Fi ticket flow

**Step 2: Implement BLE client**

- Add real BLE scan/connect/read/write handling behind `ColdGuardBleClient`.
- Use JSON messages over command/response characteristics.

**Step 3: Wire the real client into connection-service**

- Make the production path use the real BLE client by default.
- Keep mock transport available only via an explicit dev override.

**Step 4: Run focused tests**

Run: `node node_modules\\jest\\bin\\jest.js --runInBand src/features/devices/services/ble-client.test.ts src/features/devices/services/connection-service.test.ts`
Expected: PASS

### Task 4: Replace the Wi-Fi stub with a real Android bridge

**Files:**
- Modify: `src/features/devices/services/wifi-bridge.ts`
- Create: `modules/coldguard-wifi-bridge/`
- Create: `src/features/devices/services/wifi-bridge.test.ts`

**Step 1: Write the failing bridge test**

- Add tests for ticket-to-connect call mapping and fallback behavior.

**Step 2: Add local native Wi-Fi module**

- Create a local module that exposes `connectToAccessPoint({ ssid, password })`.
- Use `WifiNetworkSpecifier` and return SSID plus local IP to JS.

**Step 3: Wire the JS bridge**

- Use the native bridge on Android and fail loudly when unavailable in production mode.

**Step 4: Run focused tests**

Run: `node node_modules\\jest\\bin\\jest.js --runInBand src/features/devices/services/wifi-bridge.test.ts`
Expected: PASS

### Task 5: Improve the enrollment and connection UI

**Files:**
- Modify: `app/(tabs)/devices.tsx`
- Modify: `app/device/[id].tsx`
- Modify: `src/features/dashboard/components/device-card.tsx`
- Modify: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

**Step 1: Write or update failing screen tests**

- Cover:
  - supervisor scanner launch
  - role block messaging
  - stage-specific connection errors
  - deep-link driven enrollment route

**Step 2: Update UI**

- Add scanner CTA and status copy.
- Surface exact failure stage in connection-test flow.
- Preserve supervisor/nurse restrictions.

**Step 3: Run focused tests**

Run: `node node_modules\\jest\\bin\\jest.js --runInBand src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx`
Expected: PASS

### Task 6: Add the ESP32 transport-only Arduino firmware harness

**Files:**
- Create: `firmware/coldguard_transport_harness/coldguard_transport_harness.ino`
- Create: `firmware/coldguard_transport_harness/README.md`

**Step 1: Create the sketch**

- Implement:
  - BLE advertise
  - command and response characteristics
  - Preferences-backed enrollment state
  - SoftAP startup
  - `/api/v1/connection-test`
  - grant and HMAC verification hooks

**Step 2: Document flashing and configuration**

- Add README with:
  - Arduino board setup
  - required libraries
  - compile/upload steps
  - example QR payload
  - expected app test flow

**Step 3: Manually review firmware contract**

- Ensure the BLE and HTTP payloads match the app-side message expectations exactly.

### Task 7: Final verification

**Files:**
- Modify as needed based on test failures

**Step 1: Run the targeted suite**

Run: `node node_modules\\jest\\bin\\jest.js --runInBand src/features/devices/services/device-linking.test.ts src/features/devices/services/ble-client.test.ts src/features/devices/services/wifi-bridge.test.ts src/features/devices/services/connection-service.test.ts src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx src/lib/storage/sqlite/device-repository.test.ts`
Expected: PASS

**Step 2: Run lint if practical**

Run: `npm run lint`
Expected: PASS or actionable output to fix

**Step 3: Review the diff**

Run: `git status --short`
Expected: only the intended app, config, docs, and firmware files are changed
