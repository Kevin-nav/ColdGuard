# Profile Hydration Cache Scope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scope cached profile hydration data to the active Firebase user, then clear all current lint and TypeScript errors in the app.

**Architecture:** Add a focused regression test around the dashboard profile hydration service, then tighten the cache gate so stale snapshots from another Firebase session are evicted before querying Convex and re-saving the correct profile. After the targeted fix, use the current lint and typecheck output as the source of truth for any remaining code changes.

**Tech Stack:** TypeScript, Jest, Expo, React Native, Convex, SQLite

---

### Task 1: Guard profile hydration cache by `firebaseUid`

**Files:**
- Create: `src/features/dashboard/services/profile-hydration.test.ts`
- Modify: `src/features/dashboard/services/profile-hydration.ts`

**Step 1: Write the failing test**

Add a Jest test that mocks the SQLite profile repository and Convex client, seeds `getProfileSnapshot()` with a snapshot for a different Firebase user, and expects `ensureLocalProfileForUser()` to ignore it, clear it, fetch the requested user, and save the replacement snapshot.

**Step 2: Run test to verify it fails**

Run: `npx jest src/features/dashboard/services/profile-hydration.test.ts --runInBand`
Expected: FAIL because the current implementation returns the mismatched cached profile.

**Step 3: Write minimal implementation**

Update `ensureLocalProfileForUser()` to:
- return cache only when `cached.firebaseUid === args.firebaseUid`
- evict stale cache when the stored `firebaseUid` differs
- continue the remote load path and write the fetched snapshot back through `saveProfileSnapshot()`

**Step 4: Run test to verify it passes**

Run: `npx jest src/features/dashboard/services/profile-hydration.test.ts --runInBand`
Expected: PASS

### Task 2: Clear lint and typecheck failures

**Files:**
- Modify: exact files reported by `npm run lint` and `npx tsc --noEmit`

**Step 1: Capture current failures**

Run:
- `npm run lint`
- `npx tsc --noEmit`

**Step 2: Fix one issue class at a time**

Use the live diagnostics as the source of truth. Only change code that still fails in the current tree. Keep fixes minimal and behavior-preserving unless a failing diagnostic proves otherwise.

**Step 3: Re-run verification**

Run:
- `npm run lint`
- `npx tsc --noEmit`
- any targeted Jest command needed for changed behavior

Expected: all commands pass
