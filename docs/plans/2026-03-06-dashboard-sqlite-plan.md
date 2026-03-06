# Dashboard SQLite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first persistent post-onboarding app slice with SQLite-backed profile caching, simulated device data, a role-aware dashboard, and a reusable profile section.

**Architecture:** Use `expo-sqlite` as the local system of record for profile cache and dashboard data while keeping the institution handshake token in SecureStore. The app writes a local profile snapshot immediately after institution linking, seeds institution-scoped device/readings data, and renders dashboard/profile views from SQLite repositories.

**Tech Stack:** Expo Router, React Native, Expo SQLite, Firebase Auth, Convex, Jest, TypeScript

---

### Task 1: Add SQLite Storage Bootstrap

**Files:**
- Modify: `package.json`
- Create: `src/lib/storage/sqlite/client.ts`
- Create: `src/lib/storage/sqlite/schema.ts`
- Test: `src/lib/storage/sqlite/client.test.ts`

**Step 1: Write the failing test**

Add a test asserting the SQLite storage bootstrap exposes an initialization function and creates required tables.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/storage/sqlite/client.test.ts`
Expected: FAIL because the SQLite module does not exist yet

**Step 3: Write minimal implementation**

Create:
- SQLite open/init helper
- schema bootstrap that creates:
  - `profile_cache`
  - `devices`
  - `readings`
  - `sync_jobs`

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/storage/sqlite/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json src/lib/storage/sqlite/client.ts src/lib/storage/sqlite/schema.ts src/lib/storage/sqlite/client.test.ts
git commit -m "feat: add sqlite storage bootstrap"
```

### Task 2: Add Profile Cache Repository

**Files:**
- Create: `src/lib/storage/sqlite/profile-repository.ts`
- Create: `src/lib/storage/sqlite/profile-repository.test.ts`

**Step 1: Write the failing test**

Add tests for:
- saving profile snapshot
- loading latest profile snapshot
- defaulting missing role to `Nurse`

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/storage/sqlite/profile-repository.test.ts`
Expected: FAIL because repository does not exist

**Step 3: Write minimal implementation**

Implement repository methods:
- `saveProfileSnapshot`
- `getProfileSnapshot`
- `clearProfileSnapshot`

Use one-row upsert semantics for the active signed-in user.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/storage/sqlite/profile-repository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/storage/sqlite/profile-repository.ts src/lib/storage/sqlite/profile-repository.test.ts
git commit -m "feat: add sqlite profile cache"
```

### Task 3: Add Dashboard Seed Repository

**Files:**
- Create: `src/features/dashboard/services/dashboard-seed.ts`
- Create: `src/lib/storage/sqlite/device-repository.ts`
- Create: `src/lib/storage/sqlite/device-repository.test.ts`
- Create: `src/lib/storage/sqlite/reading-repository.ts`
- Create: `src/lib/storage/sqlite/reading-repository.test.ts`

**Step 1: Write the failing test**

Add tests asserting:
- seeded devices are stored for an institution
- seeded readings can be loaded
- device status mix includes safe/warning/alert examples

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/lib/storage/sqlite/device-repository.test.ts src/lib/storage/sqlite/reading-repository.test.ts`
Expected: FAIL because repositories do not exist

**Step 3: Write minimal implementation**

Create repository methods:
- `saveDevicesForInstitution`
- `getDevicesForInstitution`
- `saveReadings`
- `getRecentReadingsForInstitution`

Add dashboard seed helper that writes 3 simulated devices and recent readings for the linked institution.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/lib/storage/sqlite/device-repository.test.ts src/lib/storage/sqlite/reading-repository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/dashboard/services/dashboard-seed.ts src/lib/storage/sqlite/device-repository.ts src/lib/storage/sqlite/device-repository.test.ts src/lib/storage/sqlite/reading-repository.ts src/lib/storage/sqlite/reading-repository.test.ts
git commit -m "feat: add sqlite dashboard seed data"
```

### Task 4: Persist Profile And Seed Dashboard After Institution Link

**Files:**
- Modify: `app/(onboarding)/link-institution.tsx`
- Modify: `app/(onboarding)/profile.tsx`
- Modify: `src/features/onboarding/services/institution-link.ts`
- Modify: `src/features/onboarding/__tests__/link-institution-screen.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- profile snapshot is saved after successful institution linking
- dashboard seed runs after linking
- profile screen can fall back to persisted data when route params are incomplete

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/onboarding/__tests__/link-institution-screen.test.tsx src/features/onboarding/__tests__/profile-screen.test.tsx`
Expected: FAIL because the link flow does not persist SQLite data

**Step 3: Write minimal implementation**

After successful QR or credential linking:
- save profile snapshot to SQLite
- seed institution dashboard data if needed
- route to the profile confirmation screen

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/onboarding/__tests__/link-institution-screen.test.tsx src/features/onboarding/__tests__/profile-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(onboarding)/link-institution.tsx app/(onboarding)/profile.tsx src/features/onboarding/services/institution-link.ts src/features/onboarding/__tests__/link-institution-screen.test.tsx src/features/onboarding/__tests__/profile-screen.test.tsx
git commit -m "feat: persist linked profile and seed dashboard data"
```

### Task 5: Build Role-Aware Dashboard Home

**Files:**
- Modify: `app/(tabs)/home.tsx`
- Create: `src/features/dashboard/components/device-card.tsx`
- Create: `src/features/dashboard/components/profile-summary-card.tsx`
- Create: `src/features/dashboard/components/status-strip.tsx`
- Create: `src/features/dashboard/__tests__/home-screen.test.tsx`

**Step 1: Write the failing test**

Add tests for:
- nurse dashboard rendering
- supervisor dashboard rendering
- showing profile summary and institution name
- showing device cards and status colors

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: FAIL because the current home screen is placeholder-only

**Step 3: Write minimal implementation**

Replace the placeholder home with:
- greeting header
- role badge
- profile summary card
- status strip
- 3 simulated device cards
- supervisor-only management entry points

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/home.tsx src/features/dashboard/components/device-card.tsx src/features/dashboard/components/profile-summary-card.tsx src/features/dashboard/components/status-strip.tsx src/features/dashboard/__tests__/home-screen.test.tsx
git commit -m "feat: build role-aware dashboard home"
```

### Task 6: Add Durable Profile Section

**Files:**
- Create: `app/(tabs)/profile.tsx`
- Create: `src/features/dashboard/__tests__/profile-tab.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- the profile tab reads from SQLite cache
- profile fields render even after app restart simulation
- role badge is present

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/profile-tab.test.tsx`
Expected: FAIL because there is no profile tab

**Step 3: Write minimal implementation**

Create a profile tab screen that reads persisted profile cache and renders:
- name
- role
- email
- institution
- staff ID

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/profile-tab.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/profile.tsx src/features/dashboard/__tests__/profile-tab.test.tsx
git commit -m "feat: add persistent profile tab"
```

### Task 7: Add App Bootstrap For Cached Dashboard Data

**Files:**
- Modify: `app/_layout.tsx`
- Create: `src/features/dashboard/providers/dashboard-bootstrap.tsx`
- Create: `src/features/dashboard/providers/dashboard-bootstrap.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- SQLite init runs once at app boot
- cached dashboard/profile data can be loaded without crashing

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/providers/dashboard-bootstrap.test.tsx`
Expected: FAIL because there is no dashboard bootstrap provider

**Step 3: Write minimal implementation**

Create a dashboard bootstrap provider that:
- initializes SQLite
- hydrates cached profile/device summaries if available
- exposes loading/error state if initialization fails

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/providers/dashboard-bootstrap.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/_layout.tsx src/features/dashboard/providers/dashboard-bootstrap.tsx src/features/dashboard/providers/dashboard-bootstrap.test.tsx
git commit -m "feat: add dashboard sqlite bootstrap"
```

### Task 8: Verify Slice End-To-End

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/m1-auth-onboarding-qa.md`

**Step 1: Write the verification checklist**

Document:
- SQLite dependency/install requirement
- profile persistence after onboarding
- nurse vs supervisor dashboard view
- profile tab persistence

**Step 2: Run focused tests**

Run: `npm test -- --runInBand src/features/onboarding src/features/dashboard src/lib/storage/sqlite`
Expected: PASS

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS for mobile app changes; note unrelated `coldguard-web` errors if they remain

**Step 4: Manual verification**

Run:
- `npm install`
- `npm start`

Manual checks:
- link as nurse
- link as supervisor
- confirm profile persists
- confirm dashboard content differs by role

**Step 5: Commit**

```bash
git add README.md docs/runbooks/m1-auth-onboarding-qa.md
git commit -m "docs: add dashboard sqlite verification guidance"
```

## Notes

- This slice intentionally uses simulated devices/readings to unblock UI and persistence work ahead of BLE integration.
- The existing unrelated `coldguard-web` TypeScript errors around missing `@/components/Footer` are outside this slice.
