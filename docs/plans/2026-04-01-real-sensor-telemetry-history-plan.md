# Real Sensor Telemetry And History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace simulated firmware runtime data with real DS18B20, RTC, INA219, OLED, buzzer, and microSD-backed telemetry, sync all unsynced SD history into the app and Convex, and remove door/reed-switch handling across the stack.

**Architecture:** Add a firmware telemetry/storage layer that samples sensors and appends CSV records to SD, expose both the latest snapshot and paged historical export through the existing runtime transport, then update the mobile and Convex layers to ingest idempotent historical batches keyed by `deviceId + sequence`. Remove the `doorOpen` signal everywhere so notifications and UI are driven by temperature, battery, and offline state only.

**Tech Stack:** ESP32 Arduino C++, React Native, Expo modules, TypeScript, SQLite, Convex, Jest

---

### Task 1: Replace firmware simulation with real telemetry state

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_state.h`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/runtime_mock_data.h`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/runtime_mock_data.cpp`

**Step 1: Write the failing test or contract assertions**

Lock the runtime snapshot shape in code comments or targeted unit coverage so the firmware no longer models `doorOpen` and instead includes sequence/time/power fields.

**Step 2: Run the firmware build to verify failure**

Run the Arduino build command used by the repo for the transport harness.
Expected: FAIL because the runtime payload shape still assumes simulated battery/door fields.

**Step 3: Write minimal implementation**

Add real telemetry state models for:

- DS18B20 temperature
- RTC-derived timestamps
- INA219 voltage/current/power readings
- battery percentage estimate
- SD mount and sequence state
- hardware health flags

Remove `doorOpen` from runtime structs and derived state.

**Step 4: Run the firmware build again**

Run the same firmware build command.
Expected: PASS

### Task 2: Add SD logging and historical export endpoints

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/wifi_runtime.h`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/runtime_mock_data.h`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/runtime_mock_data.cpp`

**Step 1: Write the failing test or contract assertions**

Describe the new endpoints and expected JSON response shape for:

- `/api/v1/runtime/status`
- `/api/v1/runtime/history?afterSequence=<n>&limit=<n>`

**Step 2: Run the firmware build to verify failure**

Run the Arduino build command.
Expected: FAIL or remain incomplete because the history endpoint does not exist yet.

**Step 3: Write minimal implementation**

Implement:

- SD initialization on `SCK=18`, `MISO=19`, `MOSI=23`, `CS=5`
- CSV append for each telemetry sample
- paged SD CSV parsing and JSON history response
- latest snapshot response with `latestSequence`, `sdCardMounted`, voltage/current/power fields

**Step 4: Run the firmware build again**

Run the same firmware build command.
Expected: PASS

### Task 3: Update OLED and buzzer behavior for the new runtime state

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.h`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Write the failing UI contract checks**

Document the expected UI and buzzer behavior:

- OLED shows temperature, power/battery summary, RTC time, sync/runtime state
- buzzer signals SD or sensor failures and critical alerts

**Step 2: Run the firmware build to verify failure**

Run the Arduino build command.
Expected: FAIL or remain behaviorally incomplete because the UI still references old runtime labels.

**Step 3: Write minimal implementation**

Update the OLED screens and buzzer control logic to use the real telemetry snapshot and fault states. Remove any door-related wording.

**Step 4: Run the firmware build again**

Run the same firmware build command.
Expected: PASS

### Task 4: Expand mobile runtime types and SQLite storage

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/types.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/lib/storage/sqlite/device-repository.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/lib/storage/sqlite/reading-repository.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/device-directory.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.test.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/lib/storage/sqlite/device-repository.test.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/lib/storage/sqlite/reading-repository.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- new runtime payload parsing
- snapshot persistence without `doorOpen`
- historical telemetry row persistence keyed by `deviceId + sequence`

**Step 2: Run test to verify failure**

Run:

```bash
npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/lib/storage/sqlite/device-repository.test.ts src/lib/storage/sqlite/reading-repository.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

Update TypeScript types and SQLite repositories to store:

- latest temperature, RTC time, time source, voltage, current, power, battery estimate, latest sequence
- historical telemetry rows without `doorOpen`

**Step 4: Run test to verify it passes**

Run the same test command.
Expected: PASS

### Task 5: Implement mobile historical sync from the firmware history endpoint

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/wifi-bridge.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/modules/coldguard-wifi-bridge/src/ColdGuardWifiBridge.types.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/wifi-bridge.test.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.test.ts`

**Step 1: Write the failing tests**

Add coverage for:

- paged history fetching after a last synced sequence
- retry behavior where the cursor advances only after successful upload
- native bridge fetch support for the new history endpoint if needed

**Step 2: Run test to verify failure**

Run:

```bash
npm test -- --runInBand src/features/devices/services/wifi-bridge.test.ts src/features/devices/services/connection-service.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

Implement history fetch helpers and sync orchestration that:

- loads the device sync cursor
- fetches all unsynced rows from the firmware
- stores them locally
- uploads them to Convex in batches
- only advances the cursor after success

**Step 4: Run test to verify it passes**

Run the same test command.
Expected: PASS

### Task 6: Add Convex historical telemetry ingestion and latest snapshot updates

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/convex/schema.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/convex/devices.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/convex/devices.test.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/convex/notifications.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/convex/notifications.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- telemetry row batch upsert by `deviceId + sequence`
- latest snapshot updates only when incoming sequence is newer
- notification evaluation without `door_open`

**Step 2: Run test to verify failure**

Run:

```bash
npm test -- --runInBand convex/devices.test.ts convex/notifications.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

Add:

- latest snapshot fields to `devices`
- `deviceTelemetryReadings` table
- batch ingestion mutation/query helpers
- door-open removal from notification logic and preferences

**Step 4: Run test to verify it passes**

Run the same test command.
Expected: PASS

### Task 7: Remove door/reed-switch handling from mobile UI and settings

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/app/device/[id].tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/app/(tabs)/settings.tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/dashboard/components/device-card.tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/dashboard/services/dashboard-seed.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/types.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/services/inbox-sync.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/dashboard/__tests__/device-details-screen.test.tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/dashboard/__tests__/devices-screen.test.tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/dashboard/__tests__/home-screen.test.tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/dashboard/__tests__/settings-screen.test.tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/services/inbox-sync.test.ts`

**Step 1: Write the failing tests**

Update tests so door state is absent and the device detail screen shows the new telemetry fields instead.

**Step 2: Run test to verify failure**

Run:

```bash
npm test -- --runInBand src/features/dashboard/__tests__/device-details-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/settings-screen.test.tsx src/features/notifications/services/inbox-sync.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

Remove door UI and settings, replace the hardware section with current/power/voltage/battery summary, and align mock data and inbox logic with the new telemetry model.

**Step 4: Run test to verify it passes**

Run the same test command.
Expected: PASS

### Task 8: End-to-end verification and cleanup

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/README.md`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/README.md`

**Step 1: Run focused verification**

Run:

```bash
npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/features/devices/services/wifi-bridge.test.ts src/lib/storage/sqlite/device-repository.test.ts src/lib/storage/sqlite/reading-repository.test.ts src/features/dashboard/__tests__/device-details-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/settings-screen.test.tsx src/features/notifications/services/inbox-sync.test.ts convex/devices.test.ts convex/notifications.test.ts
```

Expected: PASS

**Step 2: Run the firmware build**

Run the firmware build command for `firmware/esp32_transport_harness`.
Expected: PASS

**Step 3: Update docs**

Document the new hardware pinout, SD sync model, and removed reed-switch behavior in the main README files.

**Step 4: Re-run the impacted tests/build**

Re-run the same test and firmware build commands.
Expected: PASS

Plan complete and saved to `docs/plans/2026-04-01-real-sensor-telemetry-history-plan.md`. Execution mode selected: `Subagent-Driven (this session)`.
