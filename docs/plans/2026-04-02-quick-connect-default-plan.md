# Quick Connect Default Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make quick connect the default firmware/app path, move developer tooling behind advanced settings, display MKT as the primary nurse-facing metric, and upload raw telemetry as soon as the app can.

**Architecture:** Reuse the existing SoftAP runtime API and local SQLite telemetry pipeline, but promote persistent SoftAP access and a manual quick-connect UX to the front. Firmware will calculate MKT for OLED display, while the app will treat raw readings as the source of truth, compute MKT for presentation, and push raw telemetry upstream immediately after local persistence when connectivity allows.

**Tech Stack:** ESP32 Arduino (`Preferences`, `WiFi`, OLED UI, runtime web server), Expo Router, React Native, TypeScript, SQLite, Convex, Jest

---

### Task 1: Save the approved design reference

**Files:**
- Create: `docs/plans/2026-04-02-quick-connect-default-design.md`
- Create: `docs/plans/2026-04-02-quick-connect-default-plan.md`

**Step 1: Save the approved design doc**

Write the approved quick-connect-first product behavior, telemetry contract, OLED/default-path changes, nurse-facing UX cleanup, and immediate-upload requirement into the design doc.

**Step 2: Save this implementation plan**

Write the implementation plan with exact file targets and verification steps.

**Step 3: Verify the docs exist**

Run: `Get-ChildItem docs/plans/2026-04-02-quick-connect-default-*`
Expected: both design and plan files are listed

### Task 2: Make quick connect the default firmware path

**Files:**
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `firmware/esp32_transport_harness/src/device_state.h`
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.h`
- Modify: `firmware/esp32_transport_harness/README.md`

**Step 1: Add persistent quick-connect configuration to device state**

Store the default/demo SoftAP identity and credential in `Preferences`, restore them on boot, and keep them stable until explicitly changed.

**Step 2: Bring up quick-connect SoftAP as the default boot path**

Reorder or adjust boot/runtime initialization so quick-connect SoftAP is the default nearby access path rather than a secondary or temporary tool.

**Step 3: Keep advanced pairing logic intact but de-emphasized**

Retain existing enrollment and developer state in firmware, but stop making those flows the first-screen default.

**Step 4: Verify the new default path**

Run: `rg -n "New enrollment|Pairing code|quick|softap|accessPointStarted" firmware/esp32_transport_harness/src`
Expected: quick-connect and SoftAP logic is now the primary home-path behavior, while enrollment remains available behind menu/settings logic

### Task 3: Refactor the OLED flow into nurse-facing default screens plus advanced settings

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_ui.h`

**Step 1: Redesign the default home/status screens**

Show device name, quick-connect-ready state, SoftAP info, and MKT instead of claim-token or developer-first transport details.

**Step 2: Move developer/service surfaces behind settings**

Restructure menu items so enrollment token views, diagnostics, and lower-level developer tooling sit behind an explicit settings/advanced path.

**Step 3: Keep credential editing accessible**

Add or repurpose a settings screen for viewing/changing quick-connect credentials without exposing developer-only details on the default screens.

**Step 4: Verify UI routing in code**

Run: `Get-Content firmware/esp32_transport_harness/src/device_ui.cpp`
Expected: the default screen tree is quick-connect/MKT-first, while diagnostics and enrollment are reachable through a settings-style branch

### Task 4: Add firmware-side MKT calculation for OLED display

**Files:**
- Modify: `firmware/esp32_transport_harness/src/runtime_mock_data.cpp`
- Modify: `firmware/esp32_transport_harness/src/runtime_mock_data.h`
- Modify: `firmware/esp32_transport_harness/src/device_state.h`
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Add a rolling MKT calculation path in firmware**

Calculate WHO-style MKT from telemetry history or the active backlog needed by the OLED display.

**Step 2: Persist any minimum state needed for reboot continuity**

If the OLED MKT display depends on rolling calculation state, store the minimum durable state required to survive reboot without losing the displayed value unexpectedly.

**Step 3: Keep runtime payloads raw-first**

Do not replace raw temperature in the runtime/status/history contract just because the OLED is now showing MKT.

**Step 4: Verify the runtime contract remains raw-first**

Run: `rg -n "\"currentTempC\"|mktStatus|MKT|Mean Kinetic" firmware/esp32_transport_harness/src`
Expected: OLED/UI code uses firmware-side MKT, but runtime payloads still expose raw temperature fields needed by the app

### Task 5: Create an app-side quick connect flow and make it the default device action

**Files:**
- Modify: `app/(tabs)/devices.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/device/[id].tsx`
- Create or Modify: quick-connect route/component in `app/device/` or `src/features/devices/`
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/wifi-bridge.ts`
- Modify: related dashboard/device tests

**Step 1: Add a manual quick-connect entry point**

Build the default app flow around entering device identifier plus SoftAP credential and opening the runtime session without initial BLE.

**Step 2: Persist quick-connect runtime config locally**

Save the connected SoftAP SSID, credential, runtime base URL, and related local session metadata in the existing runtime-config store.

**Step 3: Move BLE enrollment under advanced settings**

Keep the existing enrollment flow reachable, but move it out of the primary `Devices` entry point and into an advanced/settings path.

**Step 4: Verify the default CTA changed**

Run: `Get-Content app/(tabs)/devices.tsx`
Expected: the top-level device action is quick connect, not QR/BLE enrollment

### Task 6: Add app-side MKT computation from raw readings

**Files:**
- Create: `src/features/devices/services/mkt.ts`
- Create: `src/features/devices/services/mkt.test.ts`
- Modify: `src/lib/storage/sqlite/reading-repository.ts`
- Modify: `src/lib/storage/sqlite/reading-repository.test.ts`
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/types.ts`

**Step 1: Write failing tests for MKT calculation**

Add targeted tests for WHO-style MKT calculation based on ordered raw reading history and expected fallback behavior when data is insufficient.

**Step 2: Implement the minimal MKT utility**

Create a focused utility that consumes stored raw readings and returns a display-ready MKT value and any needed status/fallback metadata.

**Step 3: Keep raw readings as the stored source of truth**

Do not change SQLite history storage to save computed MKT as canonical telemetry. Compute it on demand for display.

**Step 4: Run the targeted MKT tests**

Run: `npm test -- --runInBand src/features/devices/services/mkt.test.ts src/lib/storage/sqlite/reading-repository.test.ts`
Expected: PASS

### Task 7: Refactor nurse-facing app screens to show MKT first and hide developer-heavy content

**Files:**
- Modify: `src/features/dashboard/components/device-card.tsx`
- Modify: `app/(tabs)/devices.tsx`
- Modify: `app/device/[id].tsx`
- Modify: `src/features/dashboard/__tests__/devices-screen.test.tsx`
- Modify: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

**Step 1: Update device cards**

Replace raw-temperature-first presentation with MKT-first presentation and simpler nurse-facing connection/status language.

**Step 2: Simplify the main device detail screen**

Promote MKT, last update, and simple runtime state; demote raw temperature, developer transport wording, and detailed diagnostics into a lower-visibility advanced section.

**Step 3: Preserve advanced access**

Retain diagnostics/developer affordances for service use, but keep them visually separate from the nurse-facing default path.

**Step 4: Run the nurse-facing UI tests**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx`
Expected: PASS

### Task 8: Push raw telemetry upstream as soon as the app can

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/lib/storage/sqlite/sync-job-repository.ts`
- Modify: `convex/devices.ts`
- Modify: `convex/devices.test.ts`
- Modify: related device/connection tests

**Step 1: Audit the current raw-reading upload trigger points**

Confirm where local history is saved and where `ingestDeviceTelemetryBatch` is currently called or skipped.

**Step 2: Trigger immediate best-effort upload after local save**

After successful runtime/history persistence, attempt upload immediately whenever the app has enough connectivity to do so instead of waiting for a fixed later window.

**Step 3: Preserve retry behavior**

If upload fails, leave the queued local readings intact and retry on the next successful connection/sync opportunity.

**Step 4: Run the telemetry ingest tests**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts convex/devices.test.ts`
Expected: PASS

### Task 9: Final verification and documentation cleanup

**Files:**
- Modify as needed based on verification failures

**Step 1: Run focused grep validation**

Run: `rg -n "Bluetooth primary|temporary shared access|Pairing code|developer code|MKT|quick connect" app src firmware/esp32_transport_harness`
Expected: nurse-facing surfaces now foreground quick connect and MKT, while developer wording is isolated to advanced/service areas

**Step 2: Run the targeted test suite**

Run: `npm test -- --runInBand src/features/devices/services/mkt.test.ts src/features/devices/services/connection-service.test.ts src/lib/storage/sqlite/reading-repository.test.ts src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx convex/devices.test.ts`
Expected: PASS

**Step 3: Summarize device-on-hardware follow-up checks**

Record any real-device validation still needed for:

- SoftAP boot behavior
- OLED MKT display correctness
- credential persistence across reboot
- quick-connect usability on Android
- immediate telemetry upload after local persistence
