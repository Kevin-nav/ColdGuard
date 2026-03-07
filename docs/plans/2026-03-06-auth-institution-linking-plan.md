# Auth Institution Linking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace email-verification onboarding with a proper institution-linking flow that supports QR linking, manual institution selection, nurse credential linking, and seeded institution data.

**Architecture:** Firebase remains the user identity source, while Convex becomes the system of record for institution affiliation and nurse onboarding credentials. The app routes signed-in users into an institution-linking funnel until Convex confirms a valid link and returns the institution handshake token.

**Tech Stack:** Expo Router, React Native, Firebase Auth, Convex, Jest, TypeScript

---

### Task 1: Align Auth State With Institution-Only Gating

**Files:**
- Modify: `src/features/auth/state/auth-state.ts`
- Modify: `src/features/auth/components/auth-gate.tsx`
- Test: `src/features/auth/state/auth-state.test.ts`
- Test: `src/features/auth/components/auth-gate.test.tsx`
- Test: `src/features/auth/__tests__/onboarding-flow.test.tsx`

**Step 1: Write the failing test**

Add tests asserting:
- signed-out users see sign-in copy
- signed-in unlinked users see institution-link gating
- linked users reach ready state

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/auth/state/auth-state.test.ts src/features/auth/components/auth-gate.test.tsx src/features/auth/__tests__/onboarding-flow.test.tsx`
Expected: FAIL if stage names or UI copy do not match institution-only flow

**Step 3: Write minimal implementation**

Implement `AuthStage` values:
- `signed_out`
- `signed_in_unlinked`
- `ready`

Render `Link your institution` for unlinked users.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/auth/state/auth-state.test.ts src/features/auth/components/auth-gate.test.tsx src/features/auth/__tests__/onboarding-flow.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/auth/state/auth-state.ts src/features/auth/components/auth-gate.tsx src/features/auth/state/auth-state.test.ts src/features/auth/components/auth-gate.test.tsx src/features/auth/__tests__/onboarding-flow.test.tsx
git commit -m "refactor: simplify auth gate to institution linking"
```

### Task 2: Add Convex Schema For Nurse Credentials

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/users.ts`
- Test: `src/features/onboarding/services/institution-link.test.ts`

**Step 1: Write the failing test**

Add test coverage for:
- linking by unknown institution code fails
- linking by institution credential fails on wrong staff ID/passcode
- linking by institution credential succeeds for active matching credential

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/onboarding/services/institution-link.test.ts`
Expected: FAIL because credential-link logic does not exist yet

**Step 3: Write minimal implementation**

In `convex/schema.ts`, add `institutionCredentials` table with:

```ts
institutionCredentials: defineTable({
  institutionId: v.id("institutions"),
  staffId: v.string(),
  passcode: v.string(),
  displayName: v.optional(v.string()),
  role: v.optional(v.string()),
  isActive: v.boolean(),
}).index("by_institution_staff_id", ["institutionId", "staffId"])
```

In `convex/users.ts`, add:
- query to list institutions
- mutation to link by QR code
- mutation to link by institution credential

The credential mutation should:
- resolve institution
- resolve credential by institution/staff ID
- reject inactive or invalid credential
- update the user record with `institutionId`
- return `institutionName` and `handshakeToken`

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/onboarding/services/institution-link.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/schema.ts convex/users.ts src/features/onboarding/services/institution-link.test.ts
git commit -m "feat: add institution credential linking in convex"
```

### Task 3: Add Seed Data For Institutions And Nurse Credentials

**Files:**
- Create: `convex/seeds.ts`
- Modify: `README.md`
- Modify: `docs/runbooks/m1-auth-onboarding-qa.md`

**Step 1: Write the failing test**

Document expected seeded records:
- at least 3 institutions
- at least 2 nurse credentials per institution
- predictable QR codes and staff IDs for QA

**Step 2: Run manual verification to confirm seed path is missing**

Run: `npx convex dev --once`
Expected: No seed helper available yet

**Step 3: Write minimal implementation**

Create a Convex mutation or action in `convex/seeds.ts` that inserts demo institutions and nurse credentials if they do not already exist.

Use readable sample data such as:
- `Korle-Bu Teaching Hospital` / code `korlebu-demo`
- `Tamale Central Hospital` / code `tamale-demo`
- `Ho Municipal Clinic` / code `ho-demo`

For each institution seed:
- handshake token
- two staff IDs
- short passcodes

**Step 4: Run verification**

Run: `npx convex dev --once`
Expected: Seed function available and inserts predictable demo onboarding data

**Step 5: Commit**

```bash
git add convex/seeds.ts README.md docs/runbooks/m1-auth-onboarding-qa.md
git commit -m "feat: add demo institution and nurse seed data"
```

### Task 4: Extend Onboarding Services For Both Link Methods

**Files:**
- Modify: `src/features/onboarding/services/institution-link.ts`
- Test: `src/features/onboarding/services/institution-link.test.ts`

**Step 1: Write the failing test**

Add tests for:
- parsing valid QR payload
- rejecting invalid QR payload
- mapping credential-link arguments into Convex mutation calls

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/onboarding/services/institution-link.test.ts`
Expected: FAIL because only QR linking exists

**Step 3: Write minimal implementation**

Export service functions:
- `parseInstitutionCode(qrValue: string)`
- `linkInstitutionFromQr(...)`
- `linkInstitutionWithCredentials({ firebaseUid, institutionId, staffId, passcode })`
- `listLinkableInstitutions()`

Preserve secure handshake token storage for both success paths.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/onboarding/services/institution-link.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/onboarding/services/institution-link.ts src/features/onboarding/services/institution-link.test.ts
git commit -m "feat: add dual institution linking services"
```

### Task 5: Build Institution Link Choice Screen

**Files:**
- Modify: `app/(onboarding)/link-institution.tsx`
- Test: `src/features/auth/__tests__/login-screen.test.tsx`

**Step 1: Write the failing test**

Add UI assertions for:
- rendering both `Scan QR code` and `Enter institution credentials`
- showing the correct section when each option is selected

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/auth/__tests__/login-screen.test.tsx`
Expected: FAIL because the onboarding screen does not expose both methods yet

**Step 3: Write minimal implementation**

Refactor `app/(onboarding)/link-institution.tsx` to:
- show method-selection buttons
- keep the current QR input path
- add a second path entry point for institution credential linking

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/auth/__tests__/login-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(onboarding)/link-institution.tsx src/features/auth/__tests__/login-screen.test.tsx
git commit -m "feat: add institution link method choice"
```

### Task 6: Build Institution List And Credential Form UI

**Files:**
- Modify: `app/(onboarding)/link-institution.tsx`
- Create: `src/features/onboarding/components/institution-list.tsx`
- Create: `src/features/onboarding/components/institution-credential-form.tsx`
- Test: `src/features/onboarding/services/institution-link.test.ts`

**Step 1: Write the failing test**

Add tests for:
- loading list state
- selecting institution from list
- validating required staff ID and passcode
- disabling submit while loading

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/onboarding/services/institution-link.test.ts`
Expected: FAIL because credential UI and validation do not exist

**Step 3: Write minimal implementation**

Create:
- searchable institution list component
- credential form component with `staff ID` and `passcode`
- inline validation and loading states

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/onboarding/services/institution-link.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(onboarding)/link-institution.tsx src/features/onboarding/components/institution-list.tsx src/features/onboarding/components/institution-credential-form.tsx src/features/onboarding/services/institution-link.test.ts
git commit -m "feat: add institution credential onboarding ui"
```

### Task 7: Add Structured Error Mapping

**Files:**
- Modify: `src/features/onboarding/services/institution-link.ts`
- Modify: `app/(onboarding)/link-institution.tsx`
- Create: `src/features/onboarding/services/institution-link-errors.ts`
- Test: `src/features/onboarding/services/institution-link.test.ts`

**Step 1: Write the failing test**

Add tests asserting backend failures map to user-safe messages:
- invalid QR
- unknown institution
- invalid credentials
- inactive credentials
- offline

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/features/onboarding/services/institution-link.test.ts`
Expected: FAIL because errors are still raw strings or generic exceptions

**Step 3: Write minimal implementation**

Create an error mapper:

```ts
export function mapInstitutionLinkError(error: unknown): string {
  // return stable UI copy based on error code or message
}
```

Update the screen to use mapped messages and preserve field values after recoverable failures.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/features/onboarding/services/institution-link.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/onboarding/services/institution-link.ts src/features/onboarding/services/institution-link-errors.ts app/(onboarding)/link-institution.tsx src/features/onboarding/services/institution-link.test.ts
git commit -m "feat: add institution linking error handling"
```

### Task 8: Verify End-To-End Behavior

**Files:**
- Modify: `docs/runbooks/m1-auth-onboarding-qa.md`

**Step 1: Write the verification checklist**

Document:
- QR success path
- institution selection plus credential success path
- invalid credential path
- no-institutions path
- offline path

**Step 2: Run focused tests**

Run: `npm test -- --runInBand src/features/auth src/features/onboarding`
Expected: PASS

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS for the mobile app changes; note unrelated workspace failures if they remain

**Step 4: Manual verification**

Run:
- `npm start`
- `npx convex dev --once`

Manual checks:
- sign in
- select QR or credential path
- complete institution link
- confirm handshake token saved

**Step 5: Commit**

```bash
git add docs/runbooks/m1-auth-onboarding-qa.md
git commit -m "docs: update onboarding verification for dual institution linking"
```

## Notes

- There are existing unrelated `coldguard-web` TypeScript errors around missing `@/components/Footer`; do not conflate those with the mobile onboarding work.
- The workspace is not currently a git repository, so commit steps may not be executable here without repository setup.
