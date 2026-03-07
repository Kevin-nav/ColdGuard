# Signup Flow UX Refresh Design (March 4, 2026)

## Overview

This design updates the auth/signup experience to reduce ambiguity, improve password guidance, and make Google sign-in behavior explicit and predictable.

## Goals

- Make it obvious whether the user is signing in or creating an account.
- Force Google sign-in to show account selection each time.
- Add familiar social-login layout (`or` divider + Google button).
- Provide live password requirements and a visual strength meter before submission.
- Add password visibility toggle (eye icon) for better usability.

## Non-Goals

- Changing backend auth providers or Convex bootstrap logic.
- Reworking app-wide theme tokens.
- Adding MFA, password reset, or advanced risk checks.

## UX Structure

Single auth screen with two modes:

- Mode A: `Sign in`
- Mode B: `Create account`

Mode changes through inline link text below the primary submit button:

- In Sign in mode: `Don't have an account? Create one`
- In Create account mode: `Already have an account? Sign in`

### Screen Order

1. Brand heading/subheading
2. Email input
3. Password input with inline eye toggle
4. Primary submit button (label depends on mode)
5. Mode-switch inline link
6. Divider row: horizontal line, `or`, horizontal line
7. `Continue with Google` button with Google icon
8. Inline helper/error message area

## Interaction Design

### Mode Behavior

- Default mode is `Sign in`.
- Primary button text and handler switch based on mode.
- Existing loading state (`isBusy`) remains shared.

### Password Field

- Eye icon toggles secure text visibility.
- Toggle works in both modes.

### Create Account Password Guidance

Shown only in `Create account` mode:

Rules (live as user types):
- At least 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

Small strength meter (4 segments):
- 0-1 matched: weak
- 2-3 matched: medium
- 4 matched: strong

Create-account submit is disabled until all 4 rules pass.

### Google Sign-In

- Keep existing Expo Auth Session + Firebase credential exchange.
- Force account chooser every attempt using Google prompt params (`select_account`).
- Preserve existing success path:
  - Firebase sign-in from ID token
  - Convex bootstrap
  - Route to onboarding

## Error Handling

- Keep inline message text for sign-in, sign-up, and Google failures.
- Keep explicit message for missing Google ID token.
- Keep disabled state while requests are in flight to prevent duplicate submissions.

## Accessibility and Visual Consistency

- Respect current theme colors and shared styles.
- Ensure the eye toggle and mode link are reachable and have clear hit targets.
- Keep divider and password helper text readable in both themes.

## Testing Strategy

Add focused tests for new behavior:

1. Password rule evaluator utility:
- Validates each rule independently and aggregate pass/fail.
- Validates strength segment count.

2. Login screen behavior:
- Renders Sign in mode by default.
- Mode link toggles to Create account and back.
- Create-account action disabled when password rules are unmet.

3. Existing auth service tests:
- Keep Google helper tests and add any new params/util coverage if extracted.

## Rollout Notes

- Backward compatible with existing auth stack.
- No migration steps required.
- If Google provider config is missing, button stays disabled as today.
