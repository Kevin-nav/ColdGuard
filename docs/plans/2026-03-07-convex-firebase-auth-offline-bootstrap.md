# Convex Firebase Auth Offline Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configure Convex to trust Firebase ID tokens while allowing previously hydrated users to open the app offline without weakening server-side auth checks.

**Architecture:** Add a Convex JWT auth configuration for the existing Firebase project and keep server mutations/queries keyed off `ctx.auth.getUserIdentity()`. On the client, stop calling authenticated Convex mutations before the auth handshake completes, route through the app root after sign-in, and fall back to matching local profile state when remote profile hydration is unavailable.

**Tech Stack:** Expo Router, React Native, Firebase Auth, Convex, Jest, TypeScript

---

### Task 1: Add Convex Firebase JWT configuration

**Files:**
- Create: `convex/auth.config.ts`

**Step 1: Write the configuration**

Create an auth config that exports:

```ts
import type { AuthConfig } from "convex/server";

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error("Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID for Convex auth config.");
}

export default {
  providers: [
    {
      type: "customJwt",
      issuer: `https://securetoken.google.com/${projectId}`,
      jwks: "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      algorithm: "RS256",
      applicationID: projectId,
    },
  ],
} satisfies AuthConfig;
```

**Step 2: Verify Convex accepts it**

Run: `npx convex dev`
Expected: Convex starts without the previous `UNAUTHENTICATED`-by-configuration failure.

### Task 2: Remove bootstrap/auth race from the client

**Files:**
- Modify: `src/features/auth/providers/auth-provider.tsx`
- Modify: `src/features/auth/services/user-bootstrap.ts`
- Modify: `app/(auth)/login.tsx`
- Test: `src/features/auth/providers/auth-provider.test.tsx`

**Step 1: Write failing coverage**

Add tests that prove:
- the auth provider only calls `bootstrapUserInConvex` after Convex reports authenticated
- login no longer calls `bootstrapUserInConvex` directly and routes to `/`

**Step 2: Implement minimal auth-handshake flow**

Update the provider so:
- `convex.setAuth` receives the Firebase token fetcher
- the `onChange` callback tracks whether Convex is authenticated
- bootstrap runs only when both a Firebase user exists and Convex auth is authenticated

Update login so successful sign-in/register/Google auth navigates to `/` and lets the root route decide.

**Step 3: Verify**

Run: `npx jest src/features/auth/providers/auth-provider.test.tsx src/features/auth/__tests__/login-screen.test.tsx --runInBand`
Expected: PASS

### Task 3: Keep startup routing offline-safe

**Files:**
- Modify: `app/index.tsx`
- Modify: `src/features/dashboard/services/profile-hydration.ts`
- Test: `src/__tests__/smoke/app-renders.test.tsx`
- Test: `src/features/dashboard/services/profile-hydration.test.ts`

**Step 1: Write failing coverage**

Add tests that prove:
- if remote hydration throws for a signed-in user with a matching cached profile, the app routes from the cache
- if remote hydration throws for a signed-in user without a matching cache, the app routes to onboarding instead of login
- profile hydration uses the authenticated query shape and still evicts mismatched cached users

**Step 2: Implement minimal fallback logic**

Update the root route resolver so it:
- only trusts a cached profile whose `firebaseUid` matches `user.uid`
- tries `ensureLocalProfileForUser(...)` when needed
- on remote failure, reuses the matching cached profile if present
- otherwise sends the signed-in user to `/(onboarding)/link-institution`

Update profile hydration to keep the UID-scoped cache logic and call the authenticated Convex query without stale caller-supplied UID arguments.

**Step 3: Verify**

Run: `npx jest src/__tests__/smoke/app-renders.test.tsx src/features/dashboard/services/profile-hydration.test.ts --runInBand`
Expected: PASS

### Task 4: Full verification

**Files:**
- Modify: `app.json` only if needed during verification

**Step 1: Run static verification**

Run: `npm run lint`
Expected: PASS

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Rebuild native app**

Run: `cd android && ./gradlew clean`
Run: `cd .. && npx expo run:android`
Expected: a fresh Android binary that matches installed Expo native modules.
