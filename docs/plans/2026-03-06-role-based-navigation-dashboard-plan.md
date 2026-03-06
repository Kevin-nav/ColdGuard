# Role-Based Navigation And Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a role-based mobile app shell that improves the onboarding-to-dashboard flow, adds dedicated screens for devices/profile/settings, makes the dashboard scrollable, and introduces a supervisor-only staff-management route.

**Architecture:** Use Expo Router tabs as the stable primary navigation shell and keep role-specific behavior inside screen components. Reuse the existing auth and local SQLite bootstrap layers, but refactor screen composition so onboarding ends in a real application workspace instead of a fixed-height summary page.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest, Firebase Auth, local SQLite-backed repositories

---

### Task 1: Add The Tabs Shell

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Modify: `app/(onboarding)/profile.tsx`
- Test: `src/features/auth/__tests__/onboarding-flow.test.tsx`

**Step 1: Write the failing test**

Add or update a test asserting onboarding completion routes into the tabbed shell instead of a standalone placeholder destination.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/auth/__tests__/onboarding-flow.test.tsx`
Expected: FAIL because the tabs layout and updated routing do not exist yet

**Step 3: Write minimal implementation**

Create `app/(tabs)/_layout.tsx` with bottom tabs for:
- `home`
- `devices`
- `profile`
- `settings`

Update the onboarding profile confirmation CTA so it routes into the dashboard tab in the new shell.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/auth/__tests__/onboarding-flow.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/_layout.tsx app/(onboarding)/profile.tsx src/features/auth/__tests__/onboarding-flow.test.tsx
git commit -m "feat: add role-based tabs shell"
```

### Task 2: Make Dashboard Layout Scrollable And Reframe It As Summary UI

**Files:**
- Modify: `app/(tabs)/home.tsx`
- Modify: `src/theme/shared-styles.ts`
- Test: `src/features/dashboard/__tests__/home-screen.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- the dashboard renders inside a scrollable container
- dashboard sections remain visible for both roles
- the screen exposes dedicated quick-action areas rather than only stacked static cards

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: FAIL because the current dashboard uses a fixed `View` layout and lacks the new structure

**Step 3: Write minimal implementation**

Refactor the home screen to:
- use `ScrollView`
- present role-aware summary content
- keep the dashboard focused on overview + navigation
- preserve existing seeded data and profile hydration behavior

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/home.tsx src/theme/shared-styles.ts src/features/dashboard/__tests__/home-screen.test.tsx
git commit -m "feat: make dashboard scrollable and summary-driven"
```

### Task 3: Split Dashboard Content Into Reusable Role-Aware Sections

**Files:**
- Create: `src/features/dashboard/components/dashboard-hero.tsx`
- Create: `src/features/dashboard/components/dashboard-quick-actions.tsx`
- Create: `src/features/dashboard/components/dashboard-section.tsx`
- Modify: `src/features/dashboard/components/profile-summary-card.tsx`
- Modify: `src/features/dashboard/components/device-card.tsx`
- Modify: `src/features/dashboard/components/status-strip.tsx`
- Test: `src/features/dashboard/__tests__/home-screen.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- nurse dashboard shows nurse-oriented quick actions
- supervisor dashboard shows supervisor tools
- dashboard cards render as reusable sections rather than one monolithic block

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: FAIL because the new components and sectioned layout do not exist

**Step 3: Write minimal implementation**

Create reusable dashboard primitives and compose them into:
- a stronger hero/header block
- quick actions
- role-aware summary sections
- supervisor shortcut entry points including `Staff Management`

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/dashboard/components/dashboard-hero.tsx src/features/dashboard/components/dashboard-quick-actions.tsx src/features/dashboard/components/dashboard-section.tsx src/features/dashboard/components/profile-summary-card.tsx src/features/dashboard/components/device-card.tsx src/features/dashboard/components/status-strip.tsx src/features/dashboard/__tests__/home-screen.test.tsx
git commit -m "feat: add role-aware dashboard sections"
```

### Task 4: Add A Dedicated Devices Screen

**Files:**
- Create: `app/(tabs)/devices.tsx`
- Create: `src/features/dashboard/__tests__/devices-screen.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- the devices tab renders all available devices from local storage
- empty state messaging renders when no devices are available
- role text or scope hints differ between nurse and supervisor contexts

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/devices-screen.test.tsx`
Expected: FAIL because the devices tab does not exist yet

**Step 3: Write minimal implementation**

Create a dedicated devices screen that:
- hydrates the current profile
- loads device data
- renders a scrollable list
- leaves room for future filters/details without overloading the dashboard

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/devices-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/devices.tsx src/features/dashboard/__tests__/devices-screen.test.tsx
git commit -m "feat: add dedicated devices screen"
```

### Task 5: Refine The Personal Profile Screen

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Create: `src/features/dashboard/__tests__/profile-screen.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- the profile tab is personal-only
- the screen renders persisted identity fields
- supervisors do not see staff-management content inside profile

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/profile-screen.test.tsx`
Expected: FAIL because the current profile tab is too minimal and does not encode the updated UX expectations

**Step 3: Write minimal implementation**

Refine the profile tab into a dedicated personal profile screen with:
- clear identity presentation
- institution and role details
- staff ID where available
- explanatory text around local persistence or offline continuity if useful

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/profile-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/profile.tsx src/features/dashboard/__tests__/profile-screen.test.tsx
git commit -m "feat: refine personal profile screen"
```

### Task 6: Add A Shared Settings Screen

**Files:**
- Create: `app/(tabs)/settings.tsx`
- Create: `src/features/dashboard/__tests__/settings-screen.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- the settings screen renders shared account/app controls
- sign-out action is present
- sync or local-state messaging is visible

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/settings-screen.test.tsx`
Expected: FAIL because the settings screen does not exist yet

**Step 3: Write minimal implementation**

Create a settings tab with:
- session controls
- local/offline status copy
- future-ready structure for preferences

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/settings-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/settings.tsx src/features/dashboard/__tests__/settings-screen.test.tsx
git commit -m "feat: add settings screen"
```

### Task 7: Add Supervisor-Only Staff Management Route

**Files:**
- Create: `app/staff-management.tsx`
- Modify: `app/(tabs)/home.tsx`
- Create: `src/features/dashboard/__tests__/staff-management-screen.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- supervisors can navigate to `Staff Management`
- nurses cannot access the route
- unauthorized access renders a safe state or redirect

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/staff-management-screen.test.tsx src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: FAIL because the route and access checks do not exist yet

**Step 3: Write minimal implementation**

Create a dedicated `Staff Management` screen and wire the supervisor dashboard to it. Enforce access control using the hydrated local profile role.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/staff-management-screen.test.tsx src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/staff-management.tsx app/(tabs)/home.tsx src/features/dashboard/__tests__/staff-management-screen.test.tsx src/features/dashboard/__tests__/home-screen.test.tsx
git commit -m "feat: add supervisor staff management route"
```

### Task 8: Consolidate Shared Screen Data Loading

**Files:**
- Create: `src/features/dashboard/hooks/use-dashboard-context.ts`
- Modify: `app/(tabs)/home.tsx`
- Modify: `app/(tabs)/devices.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/staff-management.tsx`
- Test: `src/features/dashboard/__tests__/home-screen.test.tsx`
- Test: `src/features/dashboard/__tests__/devices-screen.test.tsx`
- Test: `src/features/dashboard/__tests__/profile-screen.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- shared profile/bootstrap loading is reused across screens
- error/loading states remain consistent
- screens do not duplicate incompatible fallback logic

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/profile-screen.test.tsx`
Expected: FAIL because the shared hook/provider layer does not exist yet

**Step 3: Write minimal implementation**

Extract shared dashboard/profile hydration into a reusable hook so all app-shell screens read consistent session, profile, and device context.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/profile-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/dashboard/hooks/use-dashboard-context.ts app/(tabs)/home.tsx app/(tabs)/devices.tsx app/(tabs)/profile.tsx app/staff-management.tsx src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/profile-screen.test.tsx
git commit -m "refactor: share dashboard shell data loading"
```

### Task 9: Update QA And Product Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/m1-auth-onboarding-qa.md`

**Step 1: Write the verification checklist**

Document:
- onboarding handoff into tabs
- nurse vs supervisor dashboard differences
- devices/profile/settings availability
- supervisor-only `Staff Management` access rules

**Step 2: Run focused tests**

Run: `npm test -- --runInBand src/features/auth src/features/dashboard`
Expected: PASS

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS for the mobile app slice; note unrelated workspace issues separately if any remain

**Step 4: Manual verification**

Run:
- `npm start`

Manual checks:
- complete onboarding as nurse
- complete onboarding as supervisor
- confirm dashboard scrolls
- confirm tabs render correctly
- confirm supervisor can reach `Staff Management`
- confirm nurse cannot reach `Staff Management`

**Step 5: Commit**

```bash
git add README.md docs/runbooks/m1-auth-onboarding-qa.md
git commit -m "docs: add role-based navigation QA guidance"
```

## Notes

- Keep `Profile` strictly personal-only.
- Do not add a `Profiles` tab unless product direction changes later.
- The dashboard should summarize and route, not absorb all workflows.
- Git commit steps are included for execution completeness, but commits could not be created from the current workspace because it is not recognized as a git repository from this path.
