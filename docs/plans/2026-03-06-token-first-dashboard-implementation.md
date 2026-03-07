# Token-First Dashboard UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize the dashboard shell styling around shared tokens and reusable dashboard primitives so future style and layout changes can be made from a small number of files.

**Architecture:** Keep `src/theme/tokens.ts` as the raw design contract, then build a compact dashboard primitive layer on top of it for repeated layout and presentation patterns. Route files should become composition-only consumers of those primitives, with little or no page-local design logic.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest

---

### Task 1: Audit And Extend The Token Contract

**Files:**
- Modify: `src/theme/tokens.ts`
- Modify: `src/theme/shared-styles.ts`
- Test: `src/__tests__/smoke/app-renders.test.tsx`

**Step 1: Write the failing test**

Add or update a smoke-level assertion that the app shell still renders after the token contract changes.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/__tests__/smoke/app-renders.test.tsx`
Expected: FAIL after referencing new token fields before they are fully implemented

**Step 3: Write minimal implementation**

Extend the token layer only for shared semantic needs discovered in the dashboard shell, such as:
- section spacing rhythm
- standardized panel and pill radii
- eyebrow/title/label typography tokens
- any repeated semantic surface/accent values missing from the current palette

Update `createSharedStyles` so it exposes only broadly reusable building blocks tied to the token contract.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/__tests__/smoke/app-renders.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/theme/tokens.ts src/theme/shared-styles.ts src/__tests__/smoke/app-renders.test.tsx
git commit -m "refactor: extend dashboard design tokens"
```

### Task 2: Create Shared Dashboard Primitives

**Files:**
- Create: `src/features/dashboard/components/dashboard-page.tsx`
- Create: `src/features/dashboard/components/section-header.tsx`
- Create: `src/features/dashboard/components/panel-card.tsx`
- Create: `src/features/dashboard/components/badge.tsx`
- Create: `src/features/dashboard/components/metric-row.tsx`
- Modify: `src/features/dashboard/components/dashboard-section.tsx`
- Test: `src/features/dashboard/__tests__/home-screen.test.tsx`

**Step 1: Write the failing test**

Add or update tests asserting the dashboard still renders its section hierarchy and shared UI affordances after extraction into primitives.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: FAIL because the new primitive layer does not exist yet

**Step 3: Write minimal implementation**

Create the dashboard primitive layer so repeated shell elements are no longer styled independently in route files or leaf components.

Requirements:
- primitives consume shared tokens
- primitives expose simple content-first APIs
- primitives do not carry page-specific copy or business logic

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/dashboard/components/dashboard-page.tsx src/features/dashboard/components/section-header.tsx src/features/dashboard/components/panel-card.tsx src/features/dashboard/components/badge.tsx src/features/dashboard/components/metric-row.tsx src/features/dashboard/components/dashboard-section.tsx src/features/dashboard/__tests__/home-screen.test.tsx
git commit -m "refactor: add shared dashboard primitives"
```

### Task 3: Refactor Dashboard-Specific Components To Use Primitives

**Files:**
- Modify: `src/features/dashboard/components/dashboard-hero.tsx`
- Modify: `src/features/dashboard/components/dashboard-quick-actions.tsx`
- Modify: `src/features/dashboard/components/profile-summary-card.tsx`
- Modify: `src/features/dashboard/components/device-card.tsx`
- Modify: `src/features/dashboard/components/status-strip.tsx`
- Test: `src/features/dashboard/__tests__/home-screen.test.tsx`
- Test: `src/features/dashboard/__tests__/devices-screen.test.tsx`

**Step 1: Write the failing test**

Add or update tests asserting:
- dashboard quick actions still render expected labels
- profile summary and device cards still render data correctly
- role-aware states remain intact after the styling extraction

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx`
Expected: FAIL because the component internals still depend on local hardcoded presentation values

**Step 3: Write minimal implementation**

Refactor each shared dashboard component so:
- hardcoded spacing, type sizes, radii, and pill styles are removed
- shared primitives and token-backed shared styles own the repeated presentation
- business logic remains unchanged

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/dashboard/components/dashboard-hero.tsx src/features/dashboard/components/dashboard-quick-actions.tsx src/features/dashboard/components/profile-summary-card.tsx src/features/dashboard/components/device-card.tsx src/features/dashboard/components/status-strip.tsx src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx
git commit -m "refactor: normalize dashboard components around primitives"
```

### Task 4: Remove Page-Local Dashboard Styling

**Files:**
- Modify: `app/(tabs)/home.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/(tabs)/devices.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/staff-management.tsx`
- Test: `src/features/dashboard/__tests__/home-screen.test.tsx`
- Test: `src/features/dashboard/__tests__/profile-screen.test.tsx`
- Test: `src/features/dashboard/__tests__/devices-screen.test.tsx`
- Test: `src/features/dashboard/__tests__/settings-screen.test.tsx`
- Test: `src/features/dashboard/__tests__/staff-management-screen.test.tsx`

**Step 1: Write the failing test**

Add or update tests asserting each route still renders expected content and states once the page files are reduced to composition logic.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/profile-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/settings-screen.test.tsx src/features/dashboard/__tests__/staff-management-screen.test.tsx`
Expected: FAIL because route files still rely on local layout and repeated visual styles

**Step 3: Write minimal implementation**

Refactor the route files so they:
- use shared dashboard page/container primitives
- stop defining local cards, badges, and repeated spacing treatments
- retain only truly local structural concerns if needed

Target outcome:
- future dashboard shell restyling should mostly touch token files and shared primitives, not route files

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/profile-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/settings-screen.test.tsx src/features/dashboard/__tests__/staff-management-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/home.tsx app/(tabs)/profile.tsx app/(tabs)/devices.tsx app/(tabs)/settings.tsx app/staff-management.tsx src/features/dashboard/__tests__/home-screen.test.tsx src/features/dashboard/__tests__/profile-screen.test.tsx src/features/dashboard/__tests__/devices-screen.test.tsx src/features/dashboard/__tests__/settings-screen.test.tsx src/features/dashboard/__tests__/staff-management-screen.test.tsx
git commit -m "refactor: remove page-local dashboard styling"
```

### Task 5: Verify App-Shell Consistency

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/_layout.tsx`
- Test: `src/__tests__/smoke/app-renders.test.tsx`

**Step 1: Write the failing test**

Add or update smoke assertions covering themed shell rendering after the dashboard system refactor.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/__tests__/smoke/app-renders.test.tsx`
Expected: FAIL if shell-level theme consumers do not align with the updated shared system

**Step 3: Write minimal implementation**

Ensure the shell-level layout still uses the same token-first approach for background, tabs, and loading states, without introducing route-local drift back into the navigation layer.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/__tests__/smoke/app-renders.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/_layout.tsx app/_layout.tsx src/__tests__/smoke/app-renders.test.tsx
git commit -m "refactor: align app shell with dashboard design system"
```

### Task 6: Run Focused Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/m1-auth-onboarding-qa.md`

**Step 1: Document verification targets**

Add a short note describing the token-first dashboard shell and where future style changes should be made first.

**Step 2: Run focused tests**

Run: `npm test -- --runInBand src/features/dashboard src/__tests__/smoke`
Expected: PASS

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS for the mobile app slice; note unrelated workspace issues separately if any remain

**Step 4: Manual verification**

Run:
- `npm start`

Manual checks:
- dashboard, devices, profile, settings, and staff-management screens still render
- profile and supervisor views still show correct content
- spacing, card styles, badges, and headers now look system-driven rather than page-specific
- making a small token change visibly affects multiple screens as expected

**Step 5: Commit**

```bash
git add README.md docs/runbooks/m1-auth-onboarding-qa.md
git commit -m "docs: record token-first dashboard maintenance guidance"
```

## Notes

- Prefer adding a token or primitive over introducing a new local visual pattern.
- Keep the primitive set small and specific to the dashboard shell.
- Git commit steps are included for execution completeness, but commits could not be created from the current workspace because it is not recognized as a git repository from this path.
