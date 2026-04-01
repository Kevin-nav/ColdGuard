# ColdGuard

ColdGuard is a cold-chain monitoring platform built around an Expo React Native mobile app, a Convex backend, an Android native transport bridge, and ESP32 firmware for nearby enrollment and runtime monitoring.

## Start Here

- System overview: `docs/system-overview.md`
- Firmware transport harness: `firmware/esp32_transport_harness/README.md`
- Firmware contract and bench flow: `docs/runbooks/esp32-transport-harness.md`

## What The App Does

The current app supports:

- Firebase authentication and Convex-backed user bootstrap
- institution linking and local profile caching
- supervisor-led device enrollment and assignment
- secure BLE-first device authorization
- Wi-Fi / SoftAP runtime connection tests and monitoring
- Android foreground monitoring with BLE-primary lease ownership
- incident inbox, local notifications, and push registration
- SQLite-backed offline caching for devices, runtime state, and notification actions

## Architecture Summary

ColdGuard currently uses this split:

- Firebase Auth: user identity
- Convex: institutions, users, devices, assignments, tickets, incidents, and audit history
- SecureStore: local secrets such as the clinic handshake token
- SQLite: local cache for profile, device, monitoring, and notification state
- BLE: discovery, secure control, and monitoring ownership
- Wi-Fi / SoftAP: runtime status, alerts, heartbeats, and connection testing

For the full explanation of how those pieces fit together, read `docs/system-overview.md`.

## Setup

1. Install dependencies with `npm install`.
2. Create `.env.local` from `.env.example`.
3. Initialize Convex and run `npx convex dev --once`.
4. Seed local demo data with `npx convex run seeds:seedDemoInstitutions`.

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

- `npm start`: start Expo dev server
- `npm run start:dev-client`: start Expo for a development client build
- `npm run android`: run Android build
- `npm run ios`: run iOS build
- `npm test`: run Jest tests
- `npm run test:native:android`: run Android native bridge tests
- `npm run test:firmware:compile`: compile the firmware target
- `npm run test:device-stack`: run native Android tests and firmware compile
- `npm run lint`: run lint checks

## Demo Institution Seeds

After seeding, the onboarding flow includes both QR institution selection and credential-based linking.

- `Korle-Bu Teaching Hospital`
  - QR code: `coldguard://institution/korlebu-demo`
  - Staff IDs: `KB1001`, `KB1002`
- `Tamale Central Hospital`
  - QR code: `coldguard://institution/tamale-demo`
  - Staff IDs: `TM2001`, `TM2002`
- `Ho Municipal Clinic`
  - QR code: `coldguard://institution/ho-demo`
  - Staff IDs: `HO3001`, `HO3002`

Passcodes are defined in `convex/seeds.ts` for local/demo onboarding.

## Repo Notes

- The main mobile app lives at the repo root.
- `modules/coldguard-wifi-bridge/` contains the native Expo module used for Android transport and monitoring.
- `firmware/` contains the ESP32 development target and profile guidance.
- `coldguard-web/` contains the public/legal Next.js site, not the primary monitoring client.
