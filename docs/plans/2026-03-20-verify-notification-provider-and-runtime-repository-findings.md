# Verify Notification Provider And Runtime Repository Findings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify the reported notification provider and runtime repository findings against the current code and fix only the issues that still exist.

**Architecture:** Keep changes minimal and local. Replace the broken provider import/call with the existing repository API using its options object, and normalize excluded device IDs before generating SQL placeholders and bindings.

**Tech Stack:** React/TypeScript, SQLite repository helpers, Jest

---

## Task 1: Verify the live issues

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Modify: `src/lib/storage/sqlite/device-runtime-repository.ts`

**Step 1: Inspect the provider polling path**

Confirm the code still imports or calls `listMonitoredDeviceRuntimeConfigsForJsPolling` instead of the exported `listMonitoredDeviceRuntimeConfigs`.

**Step 2: Inspect excluded ID normalization**

Confirm the repository only filters by `deviceId.trim().length > 0` without actually trimming the IDs before SQL placeholder generation and binding.

## Task 2: Apply the minimal fixes

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Modify: `src/features/notifications/providers/notification-provider.test.tsx`
- Modify: `src/lib/storage/sqlite/device-runtime-repository.ts`
- Modify: `src/lib/storage/sqlite/device-runtime-repository.test.ts`

**Step 1: Switch provider code to the existing API**

Import `listMonitoredDeviceRuntimeConfigs` and call it with `{ excludeDeviceIds: nativelyMonitoredDeviceIds }`, preserving the native-device filtering logic.

**Step 2: Update provider tests**

Adjust mocks and expectations to use `listMonitoredDeviceRuntimeConfigs` with the options object shape.

**Step 3: Trim excluded IDs in the repository**

Map and trim each excluded ID, drop empty results, and use the normalized array for both SQL placeholder generation and bound params.

**Step 4: Add repository coverage**

Add a focused test proving IDs like `" device-1 "` are trimmed before binding.

## Task 3: Verify the changes

**Files:**
- Test: `src/features/notifications/providers/notification-provider.test.tsx`
- Test: `src/lib/storage/sqlite/device-runtime-repository.test.ts`

**Step 1: Run targeted Jest tests**

Run only the provider and repository test files to validate the behavior change without broad unrelated test noise.
