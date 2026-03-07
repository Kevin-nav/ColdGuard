# Signup Flow UX Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a clearer, professional auth/signup flow with explicit sign-in vs create-account mode, live password guidance, password visibility toggle, and Google account chooser behavior.

**Architecture:** Keep the existing single `app/(auth)/login.tsx` route and Firebase/Convex auth pipeline. Introduce a small password validation utility for deterministic UI behavior and testability. Update the screen to mode-driven rendering (`sign_in` vs `create_account`) with one primary submit action, then add social auth divider/button improvements and Google chooser prompt behavior.

**Tech Stack:** Expo Router, React Native, TypeScript, Firebase Auth, expo-auth-session, jest-expo, React Native Testing Library.

---

### Task 1: Add Password Validation Utility for Live Rules + Meter

**Files:**
- Create: `src/features/auth/services/password-validation.ts`
- Create: `src/features/auth/services/password-validation.test.ts`

**Step 1: Write the failing test**

```ts
import {
  getPasswordValidation,
  isPasswordFullyValid,
} from "./password-validation";

test("returns per-rule booleans and score", () => {
  const result = getPasswordValidation("Abcdef12");
  expect(result.minLength).toBe(true);
  expect(result.hasUppercase).toBe(true);
  expect(result.hasLowercase).toBe(true);
  expect(result.hasNumber).toBe(true);
  expect(result.score).toBe(4);
  expect(isPasswordFullyValid(result)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/auth/services/password-validation.test.ts`
Expected: FAIL because utility does not exist yet.

**Step 3: Write minimal implementation**

```ts
export type PasswordValidation = {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  score: 0 | 1 | 2 | 3 | 4;
};

export function getPasswordValidation(password: string): PasswordValidation {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const score = [minLength, hasUppercase, hasLowercase, hasNumber].filter(Boolean).length as 0 | 1 | 2 | 3 | 4;
  return { minLength, hasUppercase, hasLowercase, hasNumber, score };
}

export function isPasswordFullyValid(validation: PasswordValidation) {
  return validation.score === 4;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/auth/services/password-validation.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/auth/services/password-validation.ts src/features/auth/services/password-validation.test.ts
git commit -m "feat(auth): add password validation utility for live signup guidance"
```

### Task 2: Refactor Login Screen to Mode-Driven Auth Actions

**Files:**
- Modify: `app/(auth)/login.tsx`

**Step 1: Write the failing test**

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import LoginScreen from "../../../app/(auth)/login";

test("defaults to sign in mode and toggles to create account", () => {
  const ui = render(<LoginScreen />);
  expect(ui.getByText("Sign in")).toBeTruthy();
  fireEvent.press(ui.getByText("Don't have an account? Create one"));
  expect(ui.getByText("Create account")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: FAIL because screen test file and mode controls are missing.

**Step 3: Write minimal implementation**

```tsx
type AuthMode = "sign_in" | "create_account";
const [mode, setMode] = useState<AuthMode>("sign_in");

const primaryLabel = mode === "sign_in" ? "Sign in" : "Create account";
const switchLabel =
  mode === "sign_in"
    ? "Don't have an account? Create one"
    : "Already have an account? Sign in";

async function handlePrimaryAction() {
  if (mode === "sign_in") return handleSignIn();
  return handleRegister();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: PASS for mode text and toggle behavior.

**Step 5: Commit**

```bash
git add app/(auth)/login.tsx src/features/auth/__tests__/login-screen.test.tsx
git commit -m "feat(auth): switch login screen to explicit sign-in/create-account mode"
```

### Task 3: Add Password Eye Toggle + Create-Account Live Checklist and Meter

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `src/theme/shared-styles.ts` (only if reusable styles are needed)

**Step 1: Write the failing test**

```tsx
test("create account stays disabled until all password rules pass", () => {
  // render in create-account mode
  // type weak password, assert disabled
  // type strong password, assert enabled
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: FAIL with missing checklist/meter/disable logic.

**Step 3: Write minimal implementation**

```tsx
const [isPasswordVisible, setIsPasswordVisible] = useState(false);
const validation = useMemo(() => getPasswordValidation(password), [password]);
const canSubmitCreate = isPasswordFullyValid(validation);

<TextInput secureTextEntry={!isPasswordVisible} ... />
<Pressable onPress={() => setIsPasswordVisible((v) => !v)}>{/* eye icon */}</Pressable>

{mode === "create_account" ? (
  <View>
    <Text>{validation.minLength ? "[x]" : "[ ]"} At least 8 characters</Text>
    <Text>{validation.hasUppercase ? "[x]" : "[ ]"} At least 1 uppercase letter</Text>
    <Text>{validation.hasLowercase ? "[x]" : "[ ]"} At least 1 lowercase letter</Text>
    <Text>{validation.hasNumber ? "[x]" : "[ ]"} At least 1 number</Text>
    {/* 4-segment strength meter driven by validation.score */}
  </View>
) : null}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: PASS for disable/enable behavior and visible guidance.

**Step 5: Commit**

```bash
git add app/(auth)/login.tsx src/theme/shared-styles.ts src/features/auth/__tests__/login-screen.test.tsx
git commit -m "feat(auth): add password visibility toggle and live signup requirements meter"
```

### Task 4: Add `or` Divider + Google Icon Button and Force Account Chooser

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `src/features/auth/services/google-auth.ts` (only if helper extraction is useful)
- Modify: `src/features/auth/services/google-auth.test.ts` (if helper extracted)

**Step 1: Write the failing test**

```tsx
test("renders social auth divider and continue with google button", () => {
  const ui = render(<LoginScreen />);
  expect(ui.getByText("or")).toBeTruthy();
  expect(ui.getByText("Continue with Google")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: FAIL because divider/icon button structure is not implemented.

**Step 3: Write minimal implementation**

```tsx
const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  webClientId: googleConfig.webClientId,
  androidClientId: googleConfig.androidClientId,
  iosClientId: googleConfig.iosClientId,
  selectAccount: true,
});

// On press, force chooser prompt when supported
onPress={() => void promptAsync({ prompt: "select_account" })}

<View style={styles.dividerRow}>
  <View style={styles.dividerLine} />
  <Text style={styles.dividerText}>or</Text>
  <View style={styles.dividerLine} />
</View>
<Pressable>{/* Google icon + Continue with Google */}</Pressable>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: PASS for divider and Google CTA presence.

**Step 5: Commit**

```bash
git add app/(auth)/login.tsx src/features/auth/services/google-auth.ts src/features/auth/services/google-auth.test.ts src/features/auth/__tests__/login-screen.test.tsx
git commit -m "feat(auth): add social divider and force google account chooser"
```

### Task 5: Harden and Expand Login Screen Tests

**Files:**
- Create: `src/features/auth/__tests__/login-screen.test.tsx` (if not created yet)
- Modify: `src/features/auth/__tests__/login-screen.test.tsx`
- Modify: `jest.setup.ts` (if icon/router mocks are required)

**Step 1: Write the failing tests**

```tsx
test("shows create-account password guidance only in create mode", () => {
  // assert guidance hidden in sign-in
  // toggle mode and assert guidance visible
});

test("toggle eye control changes secureTextEntry behavior", () => {
  // press eye and assert visibility state flips
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: FAIL until mocks and state assertions are fully wired.

**Step 3: Write minimal implementation/mocks**

```ts
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("expo-auth-session/providers/google", () => ({
  useIdTokenAuthRequest: () => [null, null, jest.fn()],
}));
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/auth/__tests__/login-screen.test.tsx jest.setup.ts
git commit -m "test(auth): cover mode toggle, password guidance, and visibility control"
```

### Task 6: Full Verification and Developer Notes

**Files:**
- Modify: `docs/runbooks/m1-auth-onboarding-qa.md` (add quick checks for new auth UX)
- Modify: `README.md` (optional short auth UX note)

**Step 1: Write a failing docs smoke test only if docs checks exist**

```ts
// Only if this repository enforces docs assertions.
```

**Step 2: Run verification**

Run: `npm test`
Expected: PASS for full test suite.

Run: `npm run lint`
Expected: PASS with no new lint warnings/errors.

**Step 3: Update docs minimally**

```md
- Verify sign-in/create-account mode toggle text changes.
- Verify create-account password checklist and meter update as user types.
- Verify Google button opens account chooser (select account).
```

**Step 4: Re-run targeted tests**

Run: `npm test -- src/features/auth/__tests__/login-screen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/runbooks/m1-auth-onboarding-qa.md README.md
git commit -m "docs(auth): add QA checks for refreshed signup flow UX"
```

## Global Verification

Run before handoff:

```bash
npm test
npm run lint
```

Expected:
- All tests pass.
- Lint passes.

## Skill References

- `@brainstorming`
- `@writing-plans`
- `@systematic-debugging` (if tests fail while implementing)
