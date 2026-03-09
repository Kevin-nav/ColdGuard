# Notification Merge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge local-derived and backend-backed notifications without persisting synthetic incidents, and rename the app identity so permission prompts show ColdGuard.

**Architecture:** Keep SQLite notification cache reserved for backend-backed incidents, compute local-derived incidents from device state at read time, and merge both sources in the notification service/provider with backend precedence on duplicate incidents. Update Expo and Android app identity strings so the generated app label and related permission UI use the ColdGuard name consistently.

**Tech Stack:** Expo, React Native, TypeScript, Jest, Android Gradle

---

### Task 1: Add merged inbox loading semantics

**Files:**
- Modify: `src/features/notifications/services/inbox-sync.ts`
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Test: `src/features/notifications/services/inbox-sync.test.ts`

**Step 1: Write the failing tests**

Cover three cases:
- merge local-derived incidents with cached remote incidents without duplicating matching incidents,
- keep backend-backed incidents authoritative when local and remote represent the same signal,
- return a sync error alongside merged results when remote refresh fails.

**Step 2: Run targeted test to verify failure**

Run: `npx jest src/features/notifications/services/inbox-sync.test.ts --runInBand`
Expected: FAIL before merge helpers exist

**Step 3: Write minimal implementation**

Split inbox loading into:
- remote refresh and cache persistence,
- local-derived incident loading,
- in-memory merge and dedupe,
- result object carrying `incidents` and `syncError`.

Update the provider to consume the richer result and surface sync errors without replacing valid merged data.

**Step 4: Re-run targeted test**

Run: `npx jest src/features/notifications/services/inbox-sync.test.ts --runInBand`
Expected: PASS

### Task 2: Fix app identity for notification permission UI

**Files:**
- Modify: `app.json`
- Modify: `package.json`
- Modify: `android/settings.gradle`
- Modify: `android/app/build.gradle`
- Modify: `android/app/src/main/res/values/strings.xml`

**Step 1: Rename Expo and Android identifiers**

Change the temporary app name, slug, package, Android namespace, and Android string resource to `ColdGuard`-based values.

**Step 2: Verify references**

Search for leftover `ColdGuard_app_tmp` references and remove or update them where required for generated app identity.

**Step 3: Run targeted verification**

Run:
- `rg -n "ColdGuard_app_tmp|coldguard_app_tmp|exp\\+coldguardapptmp" app.json package.json android`
- `npx jest src/features/notifications/services/inbox-sync.test.ts src/lib/storage/sqlite/notification-repository.test.ts --runInBand`

Expected: no remaining temporary app identity references in tracked config files, tests pass
