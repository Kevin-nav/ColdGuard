# INA219 Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove INA219-derived telemetry from firmware, app, and backend code paths without breaking temperature/runtime monitoring.

**Architecture:** First shrink the firmware telemetry contract so INA219 fields disappear at the source. Then update app/backend parsing, storage, UI, and notification logic to consume the reduced contract and stop generating battery-based behavior.

**Tech Stack:** Arduino/C++, TypeScript, React Native, Convex, SQLite, Jest

---

### Task 1: Remove INA219 from firmware telemetry

**Files:**
- Modify: `firmware/esp32_transport_harness/src/runtime_mock_data.h`
- Modify: `firmware/esp32_transport_harness/src/runtime_mock_data.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_state.h`
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `firmware/README.md`
- Modify: `firmware/esp32_transport_harness/README.md`

**Step 1: Remove INA219 state and payload fields**

- Delete INA219 include/init/read paths.
- Remove battery/power members from firmware state and runtime snapshot structs.
- Remove battery-low alerts and power sensor health handling.

**Step 2: Simplify telemetry logging/history**

- Rewrite CSV headers and history JSON rows so they only include timestamp, temperature, status, RTC, and SD-card fields.
- Update history parsing code to match the new CSV layout.

**Step 3: Update device UI text**

- Replace battery summaries with temperature/runtime/SD summaries.
- Stop flagging missing INA219 as degraded telemetry.

**Step 4: Verify firmware references**

Run: `rg -n "INA219|batteryPercentEstimate|batteryVoltageV|shuntVoltageMv|currentMa|powerMw|powerSensorHealthy" firmware/esp32_transport_harness/src firmware/README.md firmware/esp32_transport_harness/README.md`

Expected: no active INA219 usage remains; only intentionally preserved wording, if any.

### Task 2: Remove INA219-derived fields from app models and parsing

**Files:**
- Modify: `src/features/devices/types.ts`
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/device-directory.ts`
- Modify: `src/features/devices/services/mock-hardware-registry.ts`
- Modify: `src/lib/storage/sqlite/device-repository.ts`
- Modify: `src/lib/storage/sqlite/reading-repository.ts`

**Step 1: Shrink runtime payload and reading types**

- Remove battery/power fields from app-side telemetry interfaces.

**Step 2: Update runtime parsing and history ingestion**

- Parse only the remaining firmware fields from runtime status/history.
- Persist only temperature/runtime fields that still exist.

**Step 3: Update local repository adapters**

- Remove battery/power requirements from device and reading repository types and SQL statements while leaving legacy columns untouched if unnecessary to drop.

**Step 4: Verify app references**

Run: `rg -n "batteryPercentEstimate|batteryVoltageV|shuntVoltageMv|currentMa|powerMw|batteryLevel" src/features src/lib/storage`

Expected: remaining hits are either intentionally retained legacy plumbing or none.

### Task 3: Remove INA219-derived UI and notification behavior

**Files:**
- Modify: `app/device/[id].tsx`
- Modify: `src/features/dashboard/components/device-card.tsx`
- Modify: `src/features/dashboard/services/dashboard-seed.ts`
- Modify: `src/features/notifications/types.ts`
- Modify: `src/features/notifications/services/policy.ts`
- Modify: `src/features/notifications/services/notification-seed.ts`
- Modify: `app/(tabs)/settings.tsx`
- Modify tests that cover these surfaces

**Step 1: Remove battery/power metrics from UI**

- Delete battery/power rows from dashboard cards and device detail views.
- Update seed/mock data to the smaller device shape.

**Step 2: Remove battery-low notifications**

- Delete the `battery_low` incident type from app-side notification logic and settings.
- Keep temperature and offline notifications unchanged.

**Step 3: Update tests**

- Rewrite fixtures and expectations so they no longer require battery/power telemetry or battery-low incidents.

### Task 4: Remove backend battery telemetry assumptions

**Files:**
- Modify: `convex/devices.ts`
- Modify: `convex/notifications.ts`
- Modify: `convex/schema.ts`
- Modify related `convex/*.test.ts`

**Step 1: Remove battery/power fields from ingest and query shapes**

- Stop requiring INA219-derived telemetry in Convex telemetry ingestion and list/read mappings.

**Step 2: Remove battery-low incident generation**

- Delete battery-low signal creation and recovery evaluation.
- Update preference validators if they still expose battery-only toggles.

**Step 3: Run targeted verification**

Run: `npm test -- --runInBand convex/notifications.test.ts src/features/devices/services/connection-service.test.ts src/lib/storage/sqlite/device-repository.test.ts src/lib/storage/sqlite/reading-repository.test.ts`

Expected: targeted tests pass with the reduced telemetry contract.
