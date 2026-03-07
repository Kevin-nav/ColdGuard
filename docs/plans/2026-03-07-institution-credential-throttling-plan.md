# Institution Credential Throttling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-side throttling and temporary lockouts for institution credential login attempts.

**Architecture:** Store throttle state in a new Convex table keyed by `(institutionId, staffId)`, check it before passcode verification, increment it on failures with escalating lockouts, and clear it on success. Keep responses generic by returning a single locked error when a throttle window is active.

**Tech Stack:** Convex, TypeScript, Jest

---

### Task 1: Add throttle state and helper logic

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/credential-throttle.ts`
- Test: `convex/credential-throttle.test.ts`

**Step 1: Write helper tests**

Cover the lockout schedule and active-lock checks with fixed timestamps.

**Step 2: Run targeted test**

Run: `npx jest convex/credential-throttle.test.ts --runInBand`
Expected: FAIL before helper exists

**Step 3: Write minimal implementation**

Add a helper module that computes next failure state and whether a record is currently locked.

**Step 4: Re-run test**

Run: `npx jest convex/credential-throttle.test.ts --runInBand`
Expected: PASS

### Task 2: Integrate throttling into credential login

**Files:**
- Modify: `convex/users.ts`
- Modify: `src/features/onboarding/services/institution-link-errors.ts`
- Modify: any affected tests under `src/features/onboarding/services/`

**Step 1: Add lockout path**

Check the throttle record before verification and throw a generic lockout error if still active.

**Step 2: Record failed attempts**

When verification fails, update the throttle record with incremented attempts and lockout timing, then throw the existing generic invalid-credentials error.

**Step 3: Reset on success**

Clear the throttle record once verification succeeds before linking the user.

**Step 4: Verify**

Run:
- `npx jest convex/credential-throttle.test.ts src/features/onboarding/services/institution-link.test.ts --runInBand`
- `npm run lint`
- `npx tsc --noEmit`

Expected: all pass
