# ColdGuard Milestone 1 (Auth + Onboarding) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build production-ready app shell, authentication, email verification gating, and institution linking with real Firebase and real Convex.

**Architecture:** Implement a state-driven onboarding funnel in Expo Router (`signed_out` -> `signed_in_unverified` -> `verified_unlinked` -> `ready`) with Firebase as identity source and Convex as institution/user system of record. All onboarding side effects (profile bootstrap, institution link, secure token persistence) are explicit domain actions with retry-safe behavior.

**Tech Stack:** Expo (React Native, TypeScript), npm, Expo Router, Firebase Auth, Convex, Zustand, TanStack Query, expo-secure-store, expo-camera (QR), jest-expo, React Native Testing Library.

---

## Prerequisites

- Install Node LTS (`>=20`), npm (`>=10`), Expo CLI via `npx`.
- Create Firebase project with:
  - Email/Password enabled
  - Google sign-in enabled
  - Web app config values
- Create Convex project and generate deployment URL.
- Configure Android and iOS OAuth credentials for Google sign-in.

## Environment Contract

Create `.env` with:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
```

Create `.env.example` with placeholder values.

## Task 1: Bootstrap Project and Test Harness

**Files:**
- Create: `package.json` (via Expo initializer)
- Create: `app/_layout.tsx`
- Create: `app/index.tsx`
- Create: `jest.config.js`
- Create: `jest.setup.ts`
- Create: `.env.example`

**Step 1: Write the failing test**

```tsx
// src/__tests__/smoke/app-renders.test.tsx
import { render } from "@testing-library/react-native";
import Index from "../../../app/index";

test("root index screen renders", () => {
  const { getByText } = render(<Index />);
  expect(getByText("ColdGuard")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- app-renders.test.tsx`
Expected: FAIL with missing app/test config or missing component.

**Step 3: Write minimal implementation**

```tsx
// app/index.tsx
import { Text, View } from "react-native";
export default function Index() {
  return <View><Text>ColdGuard</Text></View>;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- app-renders.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: bootstrap expo app with test harness"
```

## Task 2: Add Environment Parsing and Validation

**Files:**
- Create: `src/config/env.ts`
- Create: `src/config/__tests__/env.test.ts`
- Modify: `jest.setup.ts`

**Step 1: Write the failing test**

```ts
import { getEnv } from "../env";

test("throws when required env key is missing", () => {
  expect(() => getEnv({ EXPO_PUBLIC_FIREBASE_API_KEY: "" } as any)).toThrow(
    "Missing required env key: EXPO_PUBLIC_FIREBASE_API_KEY"
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/config/__tests__/env.test.ts`
Expected: FAIL because `getEnv` does not exist.

**Step 3: Write minimal implementation**

```ts
const required = ["EXPO_PUBLIC_FIREBASE_API_KEY", "EXPO_PUBLIC_CONVEX_URL"] as const;

export function getEnv(source: Record<string, string | undefined> = process.env) {
  for (const key of required) {
    if (!source[key] || source[key]?.trim() === "") {
      throw new Error(`Missing required env key: ${key}`);
    }
  }
  return source as Record<string, string>;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/config/__tests__/env.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/config jest.setup.ts
git commit -m "feat: add runtime env validation"
```

## Task 3: Implement Auth State Machine

**Files:**
- Create: `src/features/auth/state/auth-state.ts`
- Create: `src/features/auth/state/auth-state.test.ts`

**Step 1: Write the failing test**

```ts
import { deriveAuthStage } from "./auth-state";

test("verified and institution-linked user is ready", () => {
  const stage = deriveAuthStage({
    firebaseUser: { uid: "u1", emailVerified: true } as any,
    isInstitutionLinked: true,
    providerId: "password",
  });
  expect(stage).toBe("ready");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/auth/state/auth-state.test.ts`
Expected: FAIL because function not defined.

**Step 3: Write minimal implementation**

```ts
export type AuthStage =
  | "signed_out"
  | "signed_in_unverified"
  | "verified_unlinked"
  | "ready";

type Input = {
  firebaseUser: { uid: string; emailVerified?: boolean } | null;
  providerId?: string;
  isInstitutionLinked: boolean;
};

export function deriveAuthStage(input: Input): AuthStage {
  if (!input.firebaseUser) return "signed_out";
  const isPassword = input.providerId === "password";
  if (isPassword && !input.firebaseUser.emailVerified) return "signed_in_unverified";
  if (!input.isInstitutionLinked) return "verified_unlinked";
  return "ready";
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/auth/state/auth-state.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/auth/state
git commit -m "feat: add auth stage state machine"
```

## Task 4: Firebase Client and Session Provider

**Files:**
- Create: `src/lib/firebase/client.ts`
- Create: `src/features/auth/providers/auth-provider.tsx`
- Create: `src/features/auth/providers/auth-provider.test.tsx`

**Step 1: Write the failing test**

```tsx
import { renderHook } from "@testing-library/react-native";
import { AuthProvider, useAuthSession } from "./auth-provider";

test("provider exposes loading state initially", () => {
  const { result } = renderHook(() => useAuthSession(), { wrapper: AuthProvider });
  expect(result.current.isLoading).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- auth-provider.test.tsx`
Expected: FAIL due to missing provider/hook.

**Step 3: Write minimal implementation**

```tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase/client";

const Ctx = createContext({ user: null as any, isLoading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);
  const value = useMemo(() => ({ user, isLoading }), [user, isLoading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuthSession = () => useContext(Ctx);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- auth-provider.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/firebase src/features/auth/providers
git commit -m "feat: add firebase client and auth provider"
```

## Task 5: Auth Gate and Route Partitioning

**Files:**
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/verify-email.tsx`
- Create: `app/(onboarding)/link-institution.tsx`
- Create: `app/(tabs)/home.tsx`
- Create: `src/features/auth/components/auth-gate.tsx`
- Create: `src/features/auth/components/auth-gate.test.tsx`
- Modify: `app/_layout.tsx`

**Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react-native";
import { AuthGate } from "./auth-gate";

test("renders verify screen for unverified password users", () => {
  const ui = render(
    <AuthGate stage="signed_in_unverified">
      <></>
    </AuthGate>
  );
  expect(ui.getByText("Verify your email")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- auth-gate.test.tsx`
Expected: FAIL because gate behavior not implemented.

**Step 3: Write minimal implementation**

```tsx
export function AuthGate({
  stage,
  children,
}: {
  stage: "signed_out" | "signed_in_unverified" | "verified_unlinked" | "ready";
  children: React.ReactNode;
}) {
  if (stage === "signed_in_unverified") return <Text>Verify your email</Text>;
  if (stage !== "ready") return <Text>Redirecting...</Text>;
  return <>{children}</>;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- auth-gate.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app src/features/auth/components
git commit -m "feat: add auth gate and onboarding route partitions"
```

## Task 6: Email/Password Auth + Verification Actions

**Files:**
- Create: `src/features/auth/services/email-auth.ts`
- Create: `src/features/auth/services/email-auth.test.ts`
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/verify-email.tsx`

**Step 1: Write the failing test**

```ts
import { needsVerification } from "./email-auth";

test("password provider requires verification", () => {
  expect(needsVerification("password", false)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- email-auth.test.ts`
Expected: FAIL with missing function.

**Step 3: Write minimal implementation**

```ts
export function needsVerification(providerId: string, emailVerified: boolean) {
  return providerId === "password" && !emailVerified;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- email-auth.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/auth/services app/(auth)
git commit -m "feat: implement email auth and verification gating"
```

## Task 7: Google Sign-In Integration

**Files:**
- Create: `src/features/auth/services/google-auth.ts`
- Create: `src/features/auth/services/google-auth.test.ts`
- Modify: `app/(auth)/login.tsx`

**Step 1: Write the failing test**

```ts
import { isGoogleProvider } from "./google-auth";

test("identifies google provider", () => {
  expect(isGoogleProvider("google.com")).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- google-auth.test.ts`
Expected: FAIL because helper does not exist.

**Step 3: Write minimal implementation**

```ts
export function isGoogleProvider(providerId: string) {
  return providerId === "google.com";
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- google-auth.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/auth/services app/(auth)/login.tsx
git commit -m "feat: add google sign-in integration path"
```

## Task 8: Convex User Bootstrap

**Files:**
- Create: `convex/schema.ts`
- Create: `convex/users.ts`
- Create: `src/lib/convex/client.ts`
- Create: `src/features/auth/services/user-bootstrap.ts`
- Create: `src/features/auth/services/user-bootstrap.test.ts`

**Step 1: Write the failing test**

```ts
import { makeUserBootstrapPayload } from "./user-bootstrap";

test("creates payload with firebase uid", () => {
  const payload = makeUserBootstrapPayload("uid_1", "nurse@clinic.org");
  expect(payload.firebaseUid).toBe("uid_1");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- user-bootstrap.test.ts`
Expected: FAIL because helper missing.

**Step 3: Write minimal implementation**

```ts
export function makeUserBootstrapPayload(firebaseUid: string, email?: string | null) {
  return { firebaseUid, email: email ?? null };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- user-bootstrap.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add convex src/lib/convex src/features/auth/services
git commit -m "feat: add convex schema and user bootstrap path"
```

## Task 9: Institution Linking via QR + Secure Token Storage

**Files:**
- Create: `src/features/onboarding/services/institution-link.ts`
- Create: `src/features/onboarding/services/institution-link.test.ts`
- Create: `src/lib/storage/secure-store.ts`
- Modify: `app/(onboarding)/link-institution.tsx`
- Modify: `convex/users.ts`

**Step 1: Write the failing test**

```ts
import { parseInstitutionCode } from "./institution-link";

test("parses clinic code from qr payload", () => {
  expect(parseInstitutionCode("coldguard://institution/abc123")).toBe("abc123");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- institution-link.test.ts`
Expected: FAIL due to missing parser.

**Step 3: Write minimal implementation**

```ts
export function parseInstitutionCode(qrValue: string) {
  const prefix = "coldguard://institution/";
  if (!qrValue.startsWith(prefix)) throw new Error("Invalid institution QR payload");
  return qrValue.slice(prefix.length);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- institution-link.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/onboarding src/lib/storage app/(onboarding) convex/users.ts
git commit -m "feat: add qr institution linking and secure token persistence"
```

## Task 10: Network Status Foundation and Retry-Safe Linking

**Files:**
- Create: `src/features/network/network-status.ts`
- Create: `src/features/network/network-status.test.ts`
- Create: `src/features/network/components/network-banner.tsx`
- Modify: `src/features/onboarding/services/institution-link.ts`
- Modify: `app/_layout.tsx`

**Step 1: Write the failing test**

```ts
import { shouldAttemptRetry } from "./network-status";

test("retry disabled when offline", () => {
  expect(shouldAttemptRetry(false, 1)).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- network-status.test.ts`
Expected: FAIL because function missing.

**Step 3: Write minimal implementation**

```ts
export function shouldAttemptRetry(isOnline: boolean, attempts: number) {
  if (!isOnline) return false;
  return attempts < 5;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- network-status.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/network src/features/onboarding/services/institution-link.ts app/_layout.tsx
git commit -m "feat: add network banner and retry-safe onboarding operations"
```

## Task 11: Full Onboarding Flow Integration Test

**Files:**
- Create: `src/features/auth/__tests__/onboarding-flow.test.tsx`
- Modify: `src/features/auth/providers/auth-provider.tsx`
- Modify: `src/features/auth/components/auth-gate.tsx`

**Step 1: Write the failing test**

```tsx
test("moves from unverified to verified_unlinked to ready", async () => {
  // mock firebase and convex adapters, then assert route state transitions
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- onboarding-flow.test.tsx`
Expected: FAIL by assertion.

**Step 3: Write minimal implementation**

```tsx
// Replace placeholder with adapter mocks and assertions:
// - initial stage: signed_in_unverified
// - after verify refresh: verified_unlinked
// - after institution link success: ready
```

**Step 4: Run test to verify it passes**

Run: `npm test -- onboarding-flow.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/auth
git commit -m "test: cover auth and onboarding stage transitions"
```

## Task 12: QA Checklist, Scripts, and Developer Docs

**Files:**
- Create: `docs/runbooks/m1-auth-onboarding-qa.md`
- Create: `README.md`
- Modify: `package.json`

**Step 1: Write the failing test**

```ts
// src/__tests__/smoke/scripts-present.test.ts
import pkg from "../../../package.json";
test("required scripts exist", () => {
  expect(pkg.scripts).toHaveProperty("test");
  expect(pkg.scripts).toHaveProperty("start");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- scripts-present.test.ts`
Expected: FAIL if scripts missing/incomplete.

**Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "test": "jest",
    "lint": "expo lint"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- scripts-present.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs README.md package.json
git commit -m "docs: add milestone 1 QA runbook and dev scripts"
```

## Global Verification

Run the full verification before handing off:

```bash
npm test
npm run lint
npx convex dev --once
```

Expected:
- Tests pass.
- Lint passes.
- Convex schema/functions deploy locally without errors.

## Skill References

- `@brainstorming`
- `@writing-plans`
- `@vercel-react-best-practices`
- `@systematic-debugging` (if any test fails during execution)
