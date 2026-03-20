# Verify Reported Findings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify each reported finding against the current code and apply only the fixes that are still needed.

**Architecture:** Make the smallest behavior-preserving changes in each affected module after confirming the issue still exists. Keep fixes scoped to dependency narrowing, ticket validity enforcement, Android service lifecycle semantics, stale-poll fencing, and bridge return-shape correctness.

**Tech Stack:** Expo Router React/TypeScript, Android Kotlin service code, ESP32 C++, Jest/manual verification

---

### Task 1: Verify all findings in-place

**Files:**
- Modify: `app/device/[id].tsx`
- Modify: `firmware/esp32_transport_harness/src/action_ticket.cpp`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.web.ts`

**Step 1: Inspect the live code paths**

Run targeted reads around the reported lines and confirm whether each finding still exists before editing.

**Step 2: Record the verified root cause per file**

Confirm:
- the runtime-session effect depends on `device`
- action tickets only bound lifetime, not `now`
- `ACTION_STOP` always returns `START_NOT_STICKY`
- poll snapshots have no revision fence
- web `stopMonitoringDeviceAsync` returns a single status object instead of a status map

### Task 2: Apply the minimal fixes

**Files:**
- Modify: `app/device/[id].tsx`
- Modify: `firmware/esp32_transport_harness/src/action_ticket.cpp`
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardDeviceMonitoringService.kt`
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.web.ts`

**Step 1: Narrow the React effect dependency**

Update the dependency array from `[device]` to `[device?.id]` and use `device?.id` safely inside the effect.

**Step 2: Enforce action-ticket validity against current time**

Use `currentDeviceTimeMs()` to compute `now`, reject when `issuedAt > now` or `now > expiresAt`, and keep the existing `ticketLifetimeMs <= kMaxActionTicketLifetimeMs` validation.

**Step 3: Fix Android stop return semantics**

After `stopMonitoringDevice(deviceId)`, return `START_REDELIVER_INTENT` when monitored devices remain, otherwise `START_NOT_STICKY`.

**Step 4: Fence stale Android poll snapshots**

Add a revision field to `MonitoredDeviceState`, snapshot it before polling, pass it into `pollOnce`, and skip side effects or write-back when the live revision no longer matches.

**Step 5: Return monitoring status maps from the web bridge**

Wrap returned statuses in `{ [deviceId]: status }` and align local typing with `ColdGuardMonitoringStatusMap`.

### Task 3: Verify the changes

**Files:**
- Test: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts`

**Step 1: Run targeted validation**

Run the relevant test suite if it exists and at minimum run TypeScript/Jest coverage for the bridge module.

**Step 2: Sanity check changed call sites**

Inspect the modified files to confirm the changes match the reported requirements and do not broaden behavior unnecessarily.
