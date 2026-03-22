# Transport Monitoring Default Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Start SoftAP-first monitoring automatically during enrollment, keep device transport state alive in the background, and remove the idle device-page connection state.

**Architecture:** Enrollment will arm background monitoring immediately so the first BLE-to-SoftAP recovery happens during pairing rather than after a manual connection test. The device page will read and refresh persisted runtime session state, while Android recovery paths are hardened so BLE fallback can reconnect after the first session.

**Tech Stack:** Expo Router, React Native, react-native-ble-plx, Expo native module Kotlin, SQLite runtime config storage.

---

### Task 1: Bootstrap monitoring during enrollment

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `app/device/enroll.tsx`
- Test: `src/features/devices/services/connection-service.test.ts`

**Step 1:** Add a helper that arms default monitoring for an enrolled device.

**Step 2:** Call it from enrollment flow after registration succeeds.

**Step 3:** Update the enrollment screen to wait for monitoring bootstrap before redirect.

**Step 4:** Add tests for automatic monitoring bootstrap.

### Task 2: Keep device page synced to background transport state

**Files:**
- Modify: `app/device/[id].tsx`
- Test: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

**Step 1:** Add session polling on the device page.

**Step 2:** Auto-arm monitoring on page load when the device lacks an active monitored session.

**Step 3:** Refresh visible device data after background runtime updates.

**Step 4:** Add tests that the page auto-loads background session state.

### Task 3: Harden BLE reconnect after first pairing

**Files:**
- Modify: `src/features/devices/services/ble-client.ts`
- Modify: `src/features/devices/services/error-presenter.ts`
- Test: `src/features/devices/services/ble-client.test.ts`

**Step 1:** Treat cancellation-style BLE errors as transient reconnect failures.

**Step 2:** Reset the BLE manager between failed attempts so stale sessions do not poison reconnect.

**Step 3:** Simplify reconnect options to avoid post-pairing cancellation loops.

**Step 4:** Add tests for cancellation handling.

### Task 4: Resume default monitoring when the app is reopened

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Test: `src/features/notifications/providers/notification-provider.test.tsx`

**Step 1:** Detect persisted monitored devices whose native monitoring service is not running.

**Step 2:** Re-arm native monitoring for those devices on provider startup.

**Step 3:** Keep JS polling only as a fallback path.

**Step 4:** Add tests for native-monitor restart behavior.
