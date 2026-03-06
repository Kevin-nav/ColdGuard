# M1 Auth and Onboarding QA Runbook

Date: 2026-03-04

## Scope

- Email/password registration and sign-in
- Google sign-in path
- Convex user bootstrap
- Institution link by QR code or nurse credentials, and handshake token storage
- Offline banner visibility and retry behavior
- Token-first dashboard shell consistency across dashboard, devices, profile, settings, and staff-management routes

## Prerequisites

- `.env.local` configured for Firebase, Convex, and Google OAuth IDs
- Convex functions deployed at least once: `npx convex dev --once`
- Demo institutions seeded: `npx convex run seeds:seedDemoInstitutions`
- Expo dependencies installed: `npm install`

## QA Checklist

1. Launch app: `npm start`
2. Create new account with email/password
3. Confirm app routes directly to institution linking screen
4. Confirm both options render:
   - `Scan QR code`
   - `Enter institution credentials`
5. In QR mode, paste valid payload (`coldguard://institution/<code>`) and link
6. Confirm navigation to home screen after successful QR link
7. Sign out and create or sign in as another user
8. In credential mode, select a seeded institution and enter a valid staff ID and passcode
9. Confirm navigation to home screen after successful credential link
10. Retry credential mode with an invalid passcode and confirm friendly error copy
11. Sign out and test Google sign-in path
12. Confirm user bootstrap exists in Convex `users` table for both auth methods
13. Disable network and confirm offline banner appears
14. Attempt institution link while offline and confirm retry/error messaging
15. Complete onboarding and confirm the app lands in the tabbed dashboard shell
16. Check `Dashboard`, `Devices`, `Profile`, and `Settings` for consistent card, badge, and section-header styling
17. Sign in as a supervisor and confirm `Staff Management` matches the same shared shell treatment

## Regression Checks

- Existing unit/integration tests pass: `npm test`
- Mobile dashboard and smoke tests pass: `npm test -- --runInBand src/features/dashboard src/__tests__/smoke`
- Type checks pass: `npx tsc --noEmit`
  - Current known blocker on 2026-03-06: `coldguard-web` path alias resolution for `@/components/Footer`
- Convex compile passes: `npx convex dev --once`
