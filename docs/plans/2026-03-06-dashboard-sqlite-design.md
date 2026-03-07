# Dashboard SQLite Design

Date: 2026-03-06
Status: Approved
Source: `spec.md` plus approved follow-up direction

## Scope Decisions

- Use `expo-sqlite` now as the app's local system of record.
- Keep `expo-secure-store` for the clinic handshake token only.
- Build the first post-onboarding app slice around:
  - persistent profile cache
  - role-aware dashboard
  - simulated device and reading data
  - a visible profile section
- Account for RBAC now:
  - `Nurse`
  - `Supervisor`

## 1. Architecture

SQLite becomes the persistence layer for operational app state that must survive app restarts and offline usage. Convex remains the cloud system of record for institution/user linkage, while the mobile app caches the profile and dashboard data it needs locally.

The immediate post-onboarding flow becomes:
- user links institution
- app writes profile snapshot into SQLite
- app seeds or syncs initial device/readings data into SQLite
- home/dashboard reads from SQLite-backed repositories
- profile screen can be reached later from a dashboard profile section, not just onboarding

Design principle:
- remote identity and affiliation come from Firebase + Convex
- local experience and offline continuity come from SQLite

## 2. SQLite Scope

Initial tables:
- `profile_cache`
- `devices`
- `readings`
- `sync_jobs`

### `profile_cache`

Suggested fields:
- `firebase_uid`
- `display_name`
- `email`
- `institution_name`
- `staff_id`
- `role`
- `last_updated_at`

### `devices`

Suggested fields:
- `id`
- `institution_code`
- `nickname`
- `mac_address`
- `current_temp_c`
- `mkt_status`
- `battery_level`
- `door_open`
- `last_seen_at`

### `readings`

Suggested fields:
- `id`
- `device_id`
- `temp_c`
- `mkt_c`
- `door_open`
- `recorded_at`
- `session_id` nullable

### `sync_jobs`

Suggested fields:
- `id`
- `job_type`
- `payload_json`
- `status`
- `created_at`
- `updated_at`

## 3. Dashboard UX

Replace the placeholder home with a role-aware high-contrast dashboard.

Shared sections:
- greeting + institution header
- role badge
- profile preview card
- device summary cards
- recent alert strip

### Nurse dashboard

- own profile summary
- nearby or assigned device cards
- recent status only

### Supervisor dashboard

- same base summary
- additional management entry points shown as visible modules:
  - `Manage nurses`
  - `Review devices`
  - `Sync overview`

These can initially route to placeholder screens if needed, but the dashboard should show their existence.

## 4. Profile UX

The onboarding profile confirmation screen remains.
Add an ongoing profile section accessible from the dashboard that shows the same persisted profile information:
- name
- role
- institution
- staff ID
- email

This profile view should read from SQLite cache, not rely only on route params.

## 5. Data Seeding and Simulation

To avoid an empty app shell:
- seed SQLite with simulated devices for the linked institution
- seed recent readings and status snapshots

Suggested simulation set:
- 3 devices per institution
- mix of safe, warning, and alert states

This keeps dashboard development grounded in realistic status rendering before BLE arrives.

## 6. Persistence Flow

After successful institution linking:
- persist profile snapshot in SQLite
- ensure initial dashboard seed exists for the linked institution

On app start:
- initialize SQLite
- load cached profile
- load cached devices and recent readings
- render dashboard immediately from local data

## 7. Error Handling

- SQLite init failure:
  - user-safe fallback message
  - dashboard unavailable state
- empty dashboard:
  - show `No ColdGuard devices available yet`
- corrupted/missing profile cache:
  - fallback to Firebase session where possible
- role missing:
  - default to `Nurse`

## 8. Testing Strategy

- unit tests:
  - SQLite repository init
  - profile cache save/load
  - device seed/load
  - dashboard model mapping
- UI tests:
  - nurse dashboard rendering
  - supervisor dashboard rendering
  - profile section rendering from persisted data

## 9. Immediate Execution Focus

Implement in this order:
1. Add SQLite dependency and storage bootstrap.
2. Create repositories for profile cache and dashboard seed data.
3. Persist linked profile metadata after institution link.
4. Replace the placeholder home screen with a role-aware dashboard.
5. Add a durable profile section reading from SQLite.

## Notes

- BLE, WiFi handover, and the real sync engine stay out of this slice.
- This slice is the persistence and dashboard foundation the rest of the application will build on.
