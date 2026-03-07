# ColdGuard Mobile App Design

Date: 2026-03-04
Status: Approved
Source: `spec.md`

## Scope Decisions

- Build order: `Auth + Onboarding` -> `Monitoring Dashboard` -> `Offline Sync Core`.
- Use real backends now: Firebase Auth + Convex.
- Package/runtime: npm.
- Platform target: Android + iOS, with Android-first release priority.
- Auth methods in milestone 1: Google Sign-In and Email/Password with email verification.

## 1. Architecture

Use one Expo (React Native + TypeScript) app with feature modules and infrastructure adapters to isolate hardware-dependent logic.

Top-level layout:
- `app/`: Expo Router routes and screens.
- `src/features/auth`: login, verification, onboarding, institution linking.
- `src/features/dashboard`: device cards, status logic, charts, alerts.
- `src/features/sync`: queue, retry, upload orchestrator (hardware transport abstracted).
- `src/lib/firebase`: Firebase initialization and auth helpers.
- `src/lib/convex`: Convex client and typed API access layer.
- `src/lib/storage`: secure storage and persistent local app storage.
- `src/state`: global client state and app mode flags.

Design principle:
- Hardware I/O is behind interfaces from day one, so ESP32 integration can be plugged in with minimal UI/domain changes later.

## 2. Milestones

### Milestone 1: Auth + Onboarding

Functional outcomes:
- Sign in with Google and Email/Password.
- Require email verification for Email/Password users before app access.
- Institution linking by QR code.
- Fetch and store clinic handshake token in secure storage.
- User bootstrap in Convex (Firebase UID mapped to app user record).

Flow states:
- `signed_out`
- `signed_in_unverified`
- `verified_unlinked`
- `ready`

### Milestone 2: Monitoring Dashboard

Functional outcomes:
- Device dashboard with cards for temperature, MKT status, battery, and door state.
- High-contrast status rendering:
  - Green: in-range temperature and MKT safe.
  - Amber: door open or excursion in progress.
  - Red: MKT threshold exceeded.
- Simulated real-time telemetry source for app-side development before ESP32 availability.
- Trend/chart view driven by simulated readings.

### Milestone 3: Offline Sync Core

Functional outcomes:
- Local persistent queue for log batches.
- Connectivity-aware retry engine for cloud upload to Convex.
- Idempotent upload semantics to prevent duplicates.
- Recovery from app kill/restart with automatic queue resume.

## 3. Components and Data Flow

Milestone 1 core components:
- `AuthProvider`: subscribes to Firebase auth and exposes user/session state.
- `AuthGate`: route guard based on auth + verification + institution link state.
- `InstitutionLinkFlow`: QR scan, Convex validation, link mutation, token persistence.
- `UserProfileBootstrap`: upsert user profile in Convex after successful auth.

Milestone 2 core components:
- `DeviceRepository` interface with simulated implementation.
- `DashboardScreen` consuming device list + live stream.
- `AlertBanner` for amber/red conditions.
- `SimulationControl` (dev-only) to force scenario states.

Milestone 3 core components:
- `SyncJobQueue` persisted locally.
- `ConnectivityWatcher` with stable-online hysteresis.
- `CloudUploader` using Convex mutations and idempotency keys.
- `SyncAuditLog` for failure diagnostics and last-success metadata.

End-to-end flow summary:
1. User authenticates via Firebase.
2. App checks verification and institution linking state.
3. Institution link retrieves clinic token and stores it securely.
4. Dashboard runs from repository abstraction (simulated now, hardware later).
5. Offline sync engine persists local jobs and uploads when internet is stable.

## 4. Edge Cases and Reliability

Low-network resilience requirements:
- Local-first for critical operations where possible.
- Persist intermediate progress for interrupted onboarding steps.
- Retry institution link and uploads with exponential backoff.
- Mark and display sync state (`Synced`, `Pending`, `Retrying`, `Offline`).
- Deduplicate uploads with deterministic batch identifiers.

Critical edge cases:
- Network loss during onboarding.
- Delayed email verification checks on poor connectivity.
- QR scanned but link mutation timeout.
- Duplicate retries during unstable network flapping.
- App termination during upload.
- Clock drift between device and server.
- Offline dashboard fallback to cached latest values with explicit freshness labels.

## 5. Testing Strategy

- Unit tests:
  - Auth state machine transitions.
  - Retry/backoff policy.
  - Queue idempotency and dedupe logic.
- Integration tests:
  - Onboarding with network interruption.
  - Connectivity transitions and queue resume behavior.
- Fault-injection scenarios:
  - Convex timeout.
  - Partial upload success.
  - Restart during retry.
  - Replay duplicate submissions.
- Manual field checks (Android-first):
  - Poor network mode.
  - Airplane mode toggles.
  - Background/foreground transitions.

## 6. Immediate Execution Focus

Start with Milestone 1 implementation in this order:
1. App shell and routing with auth gate state machine.
2. Real Firebase auth providers (Google + Email/Password) and verification gating.
3. Convex user bootstrap + institution link mutation/query path.
4. QR-based institution linking flow and secure token persistence.
5. Global network/status banner foundation for later sync engine integration.

## Notes

- This workspace is not currently a git repository, so this design document could not be committed here.
