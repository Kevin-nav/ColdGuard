# ColdGuard Mobile App

Expo React Native app for cold-chain monitoring workflows with Firebase authentication and Convex backend services.

## Setup

1. Install dependencies:
   - `npm install`
2. Create `.env.local` using `.env.example`.
3. Ensure Convex project is initialized and run:
   - `npx convex dev --once`
4. Seed demo institutions and nurse credentials:
   - `npx convex run seeds:seedDemoInstitutions`

## Demo Institution Seeds

After seeding, the onboarding flow has both QR and credential-based institution linking available.

- `Korle-Bu Teaching Hospital`
  - QR code: `coldguard://institution/korlebu-demo`
  - Staff IDs: `KB1001`, `KB1002`
- `Tamale Central Hospital`
  - QR code: `coldguard://institution/tamale-demo`
  - Staff IDs: `TM2001`, `TM2002`
- `Ho Municipal Clinic`
  - QR code: `coldguard://institution/ho-demo`
  - Staff IDs: `HO3001`, `HO3002`

Passcodes are seeded in `convex/seeds.ts` for local/demo onboarding.

## Environment Variables

Required values are listed in `.env.example`:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

## Scripts

- `npm start` - start Expo dev server
- `npm run android` - run Android build
- `npm run ios` - run iOS build
- `npm test` - run Jest tests
- `npm run lint` - run Expo lint

## Current Milestone

Milestone 1 (Auth + Onboarding) implementation in progress.
See:
- `docs/plans/2026-03-04-coldguard-app-design.md`
- `docs/plans/2026-03-04-coldguard-m1-auth-onboarding.md`
- `docs/plans/2026-03-06-auth-institution-linking-design.md`
- `docs/plans/2026-03-06-auth-institution-linking-plan.md`
- `docs/plans/2026-03-06-token-first-dashboard-design.md`
- `docs/plans/2026-03-06-token-first-dashboard-implementation.md`
- `docs/runbooks/m1-auth-onboarding-qa.md`

## Dashboard UI Maintenance

The dashboard shell now follows a token-first, component-first structure:

- raw design values live in `src/theme/tokens.ts`
- shared token-backed styles live in `src/theme/shared-styles.ts`
- reusable dashboard primitives live in `src/features/dashboard/components`

When changing the dashboard look and layout, update tokens and shared primitives first. Avoid adding page-local card, badge, section-header, or spacing treatments inside route files unless the pattern is truly one-off.
