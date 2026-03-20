# Verify Notification Context, Wi-Fi Runtime, And Permission Status Findings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify the reported notification-provider, firmware Wi-Fi runtime, web bridge, and Android permission-status findings and fix only the issues that still exist.

**Architecture:** Keep the app-side notification fix narrowly focused on requiring both institution fields before storing context. In firmware, use one sampled runtime snapshot for status plus alerts and force station reconnection when credentials change while already connected. In Android, preserve permission-required monitoring statuses across service teardown instead of clearing them unconditionally.

**Tech Stack:** React/TypeScript, Jest, Kotlin Android service code, ESP32 Arduino C++

---

## Task 1: Verify the live issues

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`

**Step 1: Inspect the provider institution guards**

Confirm the provider still stores an institution context when only `institutionName` is present and `institutionId` may be empty.

**Step 2: Inspect the firmware runtime sampling and reprovisioning paths**

Confirm `buildRuntimeStatusPayload` samples runtime values separately from `buildAlertsJson`, and confirm provisioning still updates `state->facilityWifiSsid` before reconnect logic without forcing a disconnect from a different active AP.

**Step 3: Inspect Android teardown behavior**

Confirm `markNotificationPermissionRequired(...)` is followed by `stopSelf()` and that `onDestroy()` still clears all monitoring statuses unconditionally.

## Task 2: Apply the minimal fixes

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Modify: `src/features/notifications/providers/notification-provider.test.tsx`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`

**Step 1: Harden notification institution creation**

Require both non-empty `institutionId` and `institutionName` before creating or storing `NotificationInstitutionContext`; otherwise keep `institution` null.

**Step 2: Reuse one runtime sample snapshot**

Pass sampled temperature, battery, and door state into alert generation so `mktStatus` and `alerts` share one snapshot.

**Step 3: Force reconnect on changed facility Wi-Fi credentials**

If the device is already connected to a different SSID, disconnect and clear connection-attempt state before calling `maybeEnsureStationConnected(state)`.

**Step 4: Preserve permission-required monitoring statuses**

Skip clearing `POST_NOTIFICATIONS_PERMISSION_REQUIRED` entries during `onDestroy()` while clearing other monitoring statuses as before.

## Task 3: Verify the changes

**Files:**
- Test: `src/features/notifications/providers/notification-provider.test.tsx`
- Test: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts`

**Step 1: Run focused app-side tests**

Run the notification provider and existing web bridge Jest suites, and do source verification for the firmware and Kotlin changes.
