# Routing SQLite Credential Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the tab auth redirect, harden SQLite singleton/reset behavior for tests, and remove plaintext institution passcode storage.

**Architecture:** Replace render-time imperative navigation with declarative routing in the tab layout. Harden the SQLite client by resetting rejected open attempts and deleting the on-disk test database during reset. For institution credentials, migrate from plaintext passcodes to hashed storage with verification logic that can upgrade any legacy plaintext record on first successful use.

**Tech Stack:** Expo Router, TypeScript, Jest, Expo SQLite, Convex

---

### Task 1: Make tabs auth navigation declarative

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Test: `src/__tests__/smoke/app-renders.test.tsx` or a focused tabs-layout test if needed

**Step 1: Write the failing or missing test**

Add or extend coverage so an unauthenticated render of the tabs layout expects a declarative redirect rather than an imperative router call.

**Step 2: Run targeted test**

Run: `npx jest src/__tests__/smoke/app-renders.test.tsx --runInBand`
Expected: PASS after redirect logic is declarative.

**Step 3: Write minimal implementation**

Import `Redirect` from `expo-router`, remove `router.replace`, and return `<Redirect href="/(auth)/login" />` when `!user?.uid`.

**Step 4: Re-run test**

Run: `npx jest src/__tests__/smoke/app-renders.test.tsx --runInBand`
Expected: PASS

### Task 2: Harden SQLite open/reset lifecycle

**Files:**
- Modify: `src/lib/storage/sqlite/client.ts`
- Modify: `src/lib/storage/sqlite/client.test.ts`

**Step 1: Write tests for failure reset and on-disk cleanup**

Cover:
- `getSQLiteDatabase()` clears the singleton when `openDatabaseAsync("coldguard.db")` rejects
- `resetSQLiteForTests()` closes any open DB if supported, deletes `coldguard.db`, ignores missing-file errors, and logs other unlink failures without throwing

**Step 2: Run targeted test**

Run: `npx jest src/lib/storage/sqlite/client.test.ts --runInBand`
Expected: FAIL before implementation

**Step 3: Write minimal implementation**

Update:
- `getSQLiteDatabase()` to assign a promise with a catch that resets `databasePromise` and rethrows
- `resetSQLiteForTests()` to clean the DB file and then null the singleton

**Step 4: Re-run test**

Run: `npx jest src/lib/storage/sqlite/client.test.ts --runInBand`
Expected: PASS

### Task 3: Replace plaintext institution passcodes with hashes

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/users.ts`
- Modify: `convex/seeds.ts`
- Modify: `src/features/onboarding/services/institution-link.test.ts`
- Add tests if needed under `convex/` or existing service coverage

**Step 1: Add failing coverage or verification path**

Cover hashed credential verification and legacy upgrade behavior if the current test setup can exercise it; otherwise validate by running affected tests and checking TypeScript/lint after implementation.

**Step 2: Implement hashed storage**

Change the schema and seed writes to persist a hashed passcode field only. Update credential verification to use a constant-time verifier against the provided passcode, and remove direct plaintext equality checks.

**Step 3: Add compatibility migration**

If an existing credential record still has a legacy plaintext value, accept it once on successful verification, patch the record to hashed storage, and stop returning plaintext anywhere.

**Step 4: Verify end-to-end**

Run:
- `npm run lint`
- `npx tsc --noEmit`
- `npx jest src/__tests__/smoke/app-renders.test.tsx src/lib/storage/sqlite/client.test.ts src/features/onboarding/services/institution-link.test.ts --runInBand`

Expected: all pass
