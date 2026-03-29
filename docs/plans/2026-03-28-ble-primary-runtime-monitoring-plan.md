# BLE-Primary Runtime Monitoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make background monitoring keep BLE-primary ownership active while collecting firmware-generated runtime updates through facility Wi-Fi, SoftAP, and degraded BLE-first fallback behavior.

**Architecture:** Extend the firmware transport harness so runtime endpoints emit changing simulated values, then wire the Android monitoring service to combine BLE-primary lease maintenance with runtime collection and alert handling. Preserve JS fallback polling only for devices not actively covered by native monitoring, and postpone cleanup until the final wired path is proven by tests.

**Tech Stack:** TypeScript, React Native, Expo modules, Kotlin Android service code, ESP32 transport harness C++, Jest

---

### Task 1: Document the BLE-primary-first monitoring contract in tests

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.test.ts`

**Step 1: Write the failing tests**

Add tests that describe:

- monitoring startup keeps `transport: "ble_fallback"` when no proven IP path exists
- monitoring startup still passes facility Wi-Fi and SoftAP recovery context to native code
- native monitoring status can report BLE-primary ownership even when runtime transport is degraded

**Step 2: Run test to verify failure**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts`
Expected: FAIL for the new BLE-primary-first monitoring assertions.

**Step 3: Write minimal implementation updates if needed**

Adjust `connection-service.ts` only enough to satisfy the new contract around monitoring startup/status shape.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/devices/services/connection-service.test.ts src/features/devices/services/connection-service.ts
git commit -m "test: lock ble primary monitoring contract"
```

### Task 2: Add firmware-side simulated runtime update generation

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/runtime_mock_data.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/runtime_mock_data.h`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Test: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/ble_recovery.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/docs/runbooks/esp32-transport-harness.md`

**Step 1: Write the failing firmware/runtime tests**

Add or extend harness coverage so simulated runtime data proves:

- temperature changes over time
- battery level changes over time
- door-open and battery/temperature incidents appear in runtime alerts
- resolved alerts disappear or mark resolved when the generated state recovers

**Step 2: Run test to verify failure**

Run the firmware/harness test command used by the repo for the transport harness.
Expected: FAIL because runtime values are still static or do not emit alert transitions.

**Step 3: Write minimal implementation**

Implement a deterministic simulation clock/state generator in `runtime_mock_data.*` and route `wifi_runtime.cpp` runtime endpoints through it so `/api/v1/runtime/status` and `/api/v1/runtime/alerts` return changing values without app-side mocks.

**Step 4: Run test to verify it passes**

Run the same firmware/harness test command.
Expected: PASS

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/runtime_mock_data.cpp firmware/esp32_transport_harness/src/runtime_mock_data.h firmware/esp32_transport_harness/src/wifi_runtime.cpp docs/runbooks/esp32-transport-harness.md
git commit -m "feat: add firmware generated runtime simulation"
```

### Task 3: Wire the Android monitoring service to collect runtime updates

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`

**Step 1: Write the failing native monitoring tests**

Add tests or a targeted coverage harness that proves each poll cycle:

- renews or reclaims BLE primary
- attempts facility Wi-Fi runtime fetch first when proven
- falls back to stored SoftAP
- requests fresh SoftAP over BLE when needed
- remains active in BLE-only degraded mode when no IP path is available

**Step 2: Run test to verify failure**

Run the Android/native module test command available in the repo.
Expected: FAIL because `pollOnce` currently updates lease status only.

**Step 3: Write minimal implementation**

Update `pollOnce` so it:

- performs lease maintenance first
- invokes `resolveRuntimePoll`
- uses the result to track active transport and alert cursors
- handles degraded BLE-only monitoring when `resolveRuntimePoll` cannot produce an IP runtime path

Do not remove unused helpers yet.

**Step 4: Run test to verify it passes**

Run the same Android/native test command.
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt
git commit -m "feat: collect runtime updates in native monitoring"
```

### Task 4: Persist collected monitoring updates into the app-visible runtime state

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.test.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/providers/notification-provider.tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/providers/notification-provider.test.tsx`

**Step 1: Write the failing tests**

Add tests that prove:

- native monitoring status is merged into app-visible runtime state
- JS fallback polling skips devices already covered by native monitoring
- devices outside native monitoring still use the fallback JS poll path

**Step 2: Run test to verify failure**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/features/notifications/providers/notification-provider.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

Update service/provider logic so native monitoring remains the source of truth for covered devices while the fallback JS loop continues for uncovered devices only.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/features/notifications/providers/notification-provider.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/devices/services/connection-service.ts src/features/devices/services/connection-service.test.ts src/features/notifications/providers/notification-provider.tsx src/features/notifications/providers/notification-provider.test.tsx
git commit -m "feat: align app runtime state with native monitoring updates"
```

### Task 5: Surface firmware-generated alert updates through the local notification flow

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/services/inbox-sync.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/services/inbox-sync.test.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/services/local-notifications.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/services/local-notifications.test.ts`

**Step 1: Write the failing tests**

Add tests for locally derived incidents based on newly collected runtime updates so generated firmware alerts appear consistently in the app inbox and local notification delivery path.

**Step 2: Run test to verify failure**

Run: `npm test -- --runInBand src/features/notifications/services/inbox-sync.test.ts src/features/notifications/services/local-notifications.test.ts`
Expected: FAIL if the new monitoring-produced alerts are not represented correctly.

**Step 3: Write minimal implementation**

Adjust local incident derivation only as needed so runtime snapshots collected by native monitoring become visible in the inbox and notification surfaces.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/notifications/services/inbox-sync.test.ts src/features/notifications/services/local-notifications.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/notifications/services/inbox-sync.ts src/features/notifications/services/inbox-sync.test.ts src/features/notifications/services/local-notifications.ts src/features/notifications/services/local-notifications.test.ts
git commit -m "feat: surface monitored runtime alerts locally"
```

### Task 6: Verify pairing and SoftAP recovery still match the approved flow

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/wifi-bridge.test.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.test.ts`

**Step 1: Write the failing tests**

Add regression tests that confirm:

- pairing remains BLE-first
- SoftAP smoke test still runs after enrollment
- stored SoftAP and BLE-requested SoftAP recovery are still active monitoring paths

**Step 2: Run test to verify failure**

Run: `npm test -- --runInBand src/features/devices/services/wifi-bridge.test.ts src/features/devices/services/connection-service.test.ts`
Expected: FAIL if monitoring rewiring broke the original pairing/recovery flow.

**Step 3: Write minimal implementation**

Only adjust code if the monitoring changes introduced regressions in the native enrollment or recovery path.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/devices/services/wifi-bridge.test.ts src/features/devices/services/connection-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardBleEnrollmentController.kt src/features/devices/services/wifi-bridge.test.ts src/features/devices/services/connection-service.test.ts
git commit -m "test: verify pairing and softap recovery flow"
```

### Task 7: Full verification across monitoring, notifications, and runtime state

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/docs/plans/2026-03-28-ble-primary-runtime-monitoring-design.md`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/docs/plans/2026-03-28-ble-primary-runtime-monitoring-plan.md`

**Step 1: Run the focused full test suite**

Run:

```bash
npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/features/devices/services/wifi-bridge.test.ts src/features/notifications/providers/notification-provider.test.tsx src/features/notifications/services/inbox-sync.test.ts src/features/notifications/services/local-notifications.test.ts src/lib/storage/sqlite/device-runtime-repository.test.ts
```

Expected: PASS

**Step 2: Run the firmware/harness verification command**

Run the transport harness verification command for the runtime simulation path.
Expected: PASS

**Step 3: Update docs with any final behavioral clarifications**

Record any deltas discovered during implementation, especially around degraded BLE-only monitoring and runtime fetch fallback.

**Step 4: Commit**

```bash
git add docs/plans/2026-03-28-ble-primary-runtime-monitoring-design.md docs/plans/2026-03-28-ble-primary-runtime-monitoring-plan.md
git commit -m "docs: finalize ble primary runtime monitoring behavior"
```

### Task 8: Remove confirmed dead code only after verification

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.ts`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/providers/notification-provider.tsx`

**Step 1: Identify truly unused monitoring helpers**

Confirm through tests and call-site review that any candidate helper is not part of:

- BLE-primary lease maintenance
- facility Wi-Fi runtime fetch
- stored SoftAP runtime fetch
- BLE-requested SoftAP recovery
- JS fallback polling for uncovered devices

**Step 2: Write the failing regression tests if needed**

Add tests for any path at risk before deleting code.

**Step 3: Remove the dead code**

Delete only code proven unused by the final wired flow.

**Step 4: Re-run the focused full test suite**

Use the verification commands from Task 7.
Expected: PASS

**Step 5: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt src/features/devices/services/connection-service.ts src/features/notifications/providers/notification-provider.tsx
git commit -m "refactor: remove dead monitoring paths"
```
