# QR Link Auth Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make QR scan institution selection only, keep credential linking as the only auth boundary, and harden backend signing-key and role handling for deployment.

**Architecture:** Shift the trust boundary from QR possession to staff credential verification. Keep the onboarding UX fast by reusing the existing credential flow with QR-based institution preselection. Harden the Convex backend so signing keys and role values are validated at the boundary instead of being trusted downstream.

**Tech Stack:** Convex, Expo Router, React Native, Jest, TypeScript

---

### Task 1: Lock Down The QR Link Boundary

**Files:**
- Modify: `convex/users.ts`
- Test: `convex/users.test.ts`

**Step 1: Write the failing tests**

Add tests that assert:
- `linkInstitutionByQr` returns institution selection data but no `handshakeToken`
- `linkInstitutionByQr` does not patch `users.institutionId`, `users.role`, or `users.staffId`
- `linkInstitutionByCredentials` still links the user and returns `handshakeToken`

**Step 2: Run test to verify it fails**

Run: `node node_modules/jest/bin/jest.js --runInBand convex/users.test.ts`
Expected: FAIL because QR link still patches the user and returns a token.

**Step 3: Write minimal implementation**

In `convex/users.ts`:
- change `linkInstitutionByQr` to resolve and return institution selection data only
- keep `linkInstitutionByCredentials` as the only state-changing link mutation

**Step 4: Run test to verify it passes**

Run: `node node_modules/jest/bin/jest.js --runInBand convex/users.test.ts`
Expected: PASS

### Task 2: Rewire The Onboarding Flow

**Files:**
- Modify: `src/features/onboarding/services/institution-link.ts`
- Modify: `src/features/onboarding/__tests__/link-institution-screen.test.tsx`
- Modify: `src/features/onboarding/services/institution-link.test.ts`
- Modify: `app/(onboarding)/link-institution.tsx`

**Step 1: Write the failing tests**

Add tests that assert:
- QR link result contains only institution selection data
- QR link does not save the handshake token
- QR flow preselects the scanned institution and shows the credential form
- profile save, dashboard seed, and route transition happen only after credential submit succeeds

**Step 2: Run test to verify it fails**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/onboarding/services/institution-link.test.ts src/features/onboarding/__tests__/link-institution-screen.test.tsx`
Expected: FAIL because QR still behaves as a completed link.

**Step 3: Write minimal implementation**

In the onboarding service and screen:
- introduce a QR selection result type without `handshakeToken`
- stop calling `saveClinicHandshakeToken` for QR scans
- preselect the institution and switch the screen into credential mode after a valid QR result

**Step 4: Run test to verify it passes**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/onboarding/services/institution-link.test.ts src/features/onboarding/__tests__/link-institution-screen.test.tsx`
Expected: PASS

### Task 3: Restrict Test Signing Keys To Test Runtime

**Files:**
- Modify: `convex/devices.ts`
- Modify: `convex/devices.test.ts`

**Step 1: Write the failing test**

Add a test that sets `TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64` with `NODE_ENV` not equal to `test` and asserts grant building throws a configuration error.

**Step 2: Run test to verify it fails**

Run: `node node_modules/jest/bin/jest.js --runInBand convex/devices.test.ts`
Expected: FAIL because the test key is still accepted outside test mode.

**Step 3: Write minimal implementation**

In `convex/devices.ts`:
- only read `TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64` when `process.env.NODE_ENV === "test"`
- otherwise require `COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY_PKCS8_B64`

**Step 4: Run test to verify it passes**

Run: `node node_modules/jest/bin/jest.js --runInBand convex/devices.test.ts`
Expected: PASS

### Task 4: Normalize And Constrain Role Values

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/users.ts`
- Modify: `convex/devices.ts`
- Modify: `convex/seeds.ts`
- Test: `convex/users.test.ts`
- Test: `convex/devices.test.ts`

**Step 1: Write the failing tests**

Add tests that assert:
- legacy or invalid credential roles normalize to `"Nurse"`
- valid supervisor roles normalize to `"Supervisor"`
- audit event actor roles are always one of the allowed values

**Step 2: Run test to verify it fails**

Run: `node node_modules/jest/bin/jest.js --runInBand convex/users.test.ts convex/devices.test.ts`
Expected: FAIL because free-form role strings still pass through.

**Step 3: Write minimal implementation**

In the backend:
- add a shared role normalizer returning `"Supervisor"` or `"Nurse"`
- use it when reading users, credentials, and writing audit events
- tighten `users.role` and `institutionCredentials.role` schema fields to the same enum
- normalize seeded credential roles before insertion

**Step 4: Run test to verify it passes**

Run: `node node_modules/jest/bin/jest.js --runInBand convex/users.test.ts convex/devices.test.ts`
Expected: PASS

### Task 5: Final Validation

**Files:**
- Modify only if failures require minimal follow-up

**Step 1: Run focused validation**

Run:
```bash
node node_modules/jest/bin/jest.js --runInBand convex/users.test.ts convex/devices.test.ts src/features/onboarding/services/institution-link.test.ts src/features/onboarding/__tests__/link-institution-screen.test.tsx
npm run lint -- convex/users.ts convex/devices.ts convex/schema.ts src/features/onboarding/services/institution-link.ts "app/(onboarding)/link-institution.tsx"
```

Expected: PASS

**Step 2: Review residual risks**

Confirm:
- QR scan alone cannot unlock institution data
- only credential link returns the handshake token
- test signing keys cannot be used in non-test runtime
- role values are normalized consistently at the boundary
