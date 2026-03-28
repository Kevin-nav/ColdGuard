# Startup And Enrollment Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Request required Android permissions on cold launch and keep enrollment as a hard permission gate before pairing begins.

**Architecture:** Add a shared JS permission preflight in the app layer, run it once during app startup, and reuse the same permission helpers during enrollment and monitoring. Startup preflight is best-effort; enrollment and monitoring remain hard gates.

**Tech Stack:** Expo Router, React Native, Expo Notifications, Android runtime permissions, Jest

---

### Task 1: Extract A Shared Android Permission Preflight

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.ts`
- Test: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.test.ts`

**Step 1: Write the failing test**

Add a focused test that verifies a shared startup preflight requests notification, BLE, and nearby Wi-Fi permissions on Android.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts`

Expected: FAIL because no exported startup preflight exists yet.

**Step 3: Write minimal implementation**

In `connection-service.ts`:

- add an exported best-effort startup helper
- reuse `ensureNotificationPermission`, `ensureBleTransportPermissions`, and `ensureWifiBridgePermissions`
- swallow failures in the startup helper so app launch is not blocked

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/devices/services/connection-service.ts src/features/devices/services/connection-service.test.ts
git commit -m "feat: add startup permission preflight"
```

### Task 2: Run Permission Preflight On Cold Launch

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/app/_layout.tsx`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/providers/notification-provider.tsx`
- Test: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/notifications/providers/notification-provider.test.tsx`

**Step 1: Write the failing test**

Add a test that verifies cold launch triggers the startup permission preflight once on Android.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/notifications/providers/notification-provider.test.tsx`

Expected: FAIL because no launch hook calls the startup preflight yet.

**Step 3: Write minimal implementation**

Choose the app bootstrap layer already mounted on cold launch and:

- call the startup preflight in a `useEffect`
- make it Android-only
- ensure it does not retry repeatedly within the same mount lifecycle

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/notifications/providers/notification-provider.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add app/_layout.tsx src/features/notifications/providers/notification-provider.tsx src/features/notifications/providers/notification-provider.test.tsx
git commit -m "feat: request permissions on cold launch"
```

### Task 3: Keep Enrollment As Hard Gate

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.ts`
- Test: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/src/features/devices/services/connection-service.test.ts`

**Step 1: Write the failing test**

Add or update a test verifying enrollment still stops before native pairing if permissions remain denied after startup.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts`

Expected: FAIL if the helper wiring regressed.

**Step 3: Write minimal implementation**

Confirm `enrollColdGuardDevice` continues to use the shared permission preflight as a hard gate before `startNativeEnrollment`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/devices/services/connection-service.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/devices/services/connection-service.ts src/features/devices/services/connection-service.test.ts
git commit -m "test: keep enrollment permission gate intact"
```

### Task 4: Final Verification

**Files:**
- Test only

**Step 1: Run focused verification**

Run:

```bash
npm test -- --runInBand src/features/devices/services/connection-service.test.ts src/features/notifications/providers/notification-provider.test.tsx src/features/dashboard/__tests__/device-details-screen.test.tsx
```

Expected: PASS

**Step 2: Run Android compile smoke test**

Run:

```bash
cd android
./gradlew.bat :app:compileDebugKotlin
```

Expected: PASS

**Step 3: Commit if any verification-driven fix was needed**

```bash
git add <files>
git commit -m "fix: stabilize permission preflight"
```
