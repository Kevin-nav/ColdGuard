# ColdGuard Notification System Design

## Summary

Build an incident-first notification system for ColdGuard that turns operational device problems into durable incidents with three delivery surfaces: in-app inbox, local mobile notifications, and remote push. Keep the current tab shell unchanged and expose notification history through a bell action in the shared top nav plus dedicated routes for inbox and incident detail.

This design is scoped to operational cold-chain events only:
- temperature excursion
- prolonged door-open
- device offline
- low battery
- recovery/resolution

This design is not scoped to:
- staff announcements
- onboarding/auth reminders
- email/SMS delivery
- per-device assignment or on-call rotations
- admin editing of thresholds in v1

## Approach Options

1. Client-first/local-only
- Lowest implementation cost.
- Fails the product goal for remote incident awareness and institutional escalation.

2. Incident-first unified event model with delivery adapters
- Recommended.
- Gives one source of truth for open/acknowledged/resolved incidents, supports in-app history, local alerts, push, and auditability without coupling the app to one provider.

3. Full paging/on-call system
- Too heavy for the current app and data model.
- Requires assignment, schedules, ownership transfer, and more RBAC than the repo currently has.

## Recommended Architecture

### Core model

Every operational problem becomes a server-side incident keyed by:
- `institutionId`
- `deviceId`
- `incidentType`

Lifecycle:
- `open`
- `acknowledged`
- `resolved`

Behavior:
- Repeated signals for an already-open incident update the existing incident instead of creating duplicates.
- A resolved incident that retriggers within 30 minutes reopens the same incident and records a `reopened` event.
- A retrigger after 30 minutes creates a new incident.

### Severity policy defaults

Use these fixed defaults in code for v1:
- `temperature_warning`: device `mktStatus === "warning"`
- `temperature_critical`: device `mktStatus === "alert"`
- `door_open_warning`: door open for `>= 2 minutes`
- `door_open_critical`: door open for `>= 5 minutes`
- `device_offline_warning`: `lastSeenAt >= 10 minutes old`
- `device_offline_critical`: `lastSeenAt >= 30 minutes old`
- `battery_low_warning`: battery `< 20%`
- `battery_low_critical`: battery `< 10%`

Recovery defaults:
- temperature resolves after 3 consecutive healthy evaluations
- door-open resolves immediately when closed
- offline resolves on next successful check-in
- battery resolves at `>= 25%` to avoid flapping

### Delivery policy

- In-app: always create/update inbox items for every incident and recovery.
- Local mobile notification: send for `warning` and `critical` if local channel is enabled.
- Remote push:
  - send immediately for all `critical` opens
  - do not push `warning` immediately
  - push `warning` only if unresolved for 15 minutes or upgraded to `critical`
  - send recovery push only when the original incident was `critical` and had been acknowledged
- Escalation:
  - if a `critical` incident is still unacknowledged after 5 minutes, send repeat push to supervisors only
  - repeat once more at 15 minutes if still unacknowledged
  - stop repeats after acknowledge or resolve

### Recipient rules

- All linked users in the institution can see all institution incidents in-app.
- All linked users receive initial `critical` push if eligible by channel state.
- Supervisors receive escalation repeats.
- Nurses and supervisors can both acknowledge and resolve incidents in v1.
- No per-device assignment model in this design.

## Data Model And Interfaces

### Convex schema additions

Add to [convex/schema.ts](C:/Users/Kevin/.t3/worktrees/ColdGuard/t3code-0ce521ab/convex/schema.ts):
- `notificationIncidents`
  - `institutionId`
  - `deviceId`
  - `deviceNickname`
  - `incidentType`
  - `severity`
  - `status`
  - `title`
  - `body`
  - `firstTriggeredAt`
  - `lastTriggeredAt`
  - `acknowledgedAt?`
  - `acknowledgedByUserId?`
  - `resolvedAt?`
  - `resolvedByUserId?`
  - `lastEscalatedAt?`
  - `reopenCount`
  - `healthyEvaluationStreak`
  - `lastSnapshotJson`
- `notificationEvents`
  - `incidentId`
  - `eventType`
  - `actorUserId?`
  - `channel?`
  - `metadataJson`
  - `createdAt`
- `notificationUserState`
  - `incidentId`
  - `userId`
  - `readAt?`
  - `archivedAt?`
  - `lastViewedVersion`
- `userPushDevices`
  - `userId`
  - `expoPushToken`
  - `platform`
  - `appVersion`
  - `deviceLabel?`
  - `permissionStatus`
  - `isActive`
  - `lastRegisteredAt`
  - `lastSeenAt`
- `userNotificationPreferences`
  - `userId`
  - `warningPushEnabled`
  - `warningLocalEnabled`
  - `recoveryPushEnabled`
  - `quietHoursStart?`
  - `quietHoursEnd?`
  - `updatedAt`

### SQLite additions

Add to [src/lib/storage/sqlite/schema.ts](C:/Users/Kevin/.t3/worktrees/ColdGuard/t3code-0ce521ab/src/lib/storage/sqlite/schema.ts):
- `notification_cache`
  - `incident_id`
  - `institution_name`
  - `device_id`
  - `device_nickname`
  - `incident_type`
  - `severity`
  - `status`
  - `title`
  - `body`
  - `first_triggered_at`
  - `last_triggered_at`
  - `acknowledged_at`
  - `resolved_at`
  - `last_synced_at`
- `notification_state_cache`
  - `incident_id`
  - `read_at`
  - `archived_at`
  - `last_viewed_version`

Reuse existing `sync_jobs` for offline actions:
- `register_push_device`
- `mark_notification_read`
- `acknowledge_incident`
- `resolve_incident`
- `update_notification_preferences`

### Convex API surface

Create [convex/notifications.ts](C:/Users/Kevin/.t3/worktrees/ColdGuard/t3code-0ce521ab/convex/notifications.ts) with:
- `listInbox({ statusFilter, limit, cursor })`
- `getUnreadCount()`
- `getIncidentDetail({ incidentId })`
- `markIncidentRead({ incidentId })`
- `archiveIncident({ incidentId })`
- `acknowledgeIncident({ incidentId })`
- `resolveIncident({ incidentId, note? })`
- `getNotificationPreferences()`
- `updateNotificationPreferences({ warningPushEnabled, warningLocalEnabled, recoveryPushEnabled, quietHoursStart, quietHoursEnd })`
- `registerPushDevice({ expoPushToken, platform, appVersion, permissionStatus, deviceLabel? })`
- `unregisterPushDevice({ expoPushToken })`

Create internal notification engine modules:
- `evaluateOperationalSnapshot({ institutionId, deviceId, deviceNickname, mktStatus, batteryLevel, doorOpen, lastSeenAt, observedAt })`
- `dispatchDueDeliveries()`
- `escalateDueIncidents()`

## Mobile UX

### Navigation and screens

Do not add a new tab.

Add:
- bell icon with unread badge to [src/features/dashboard/components/top-nav.tsx](C:/Users/Kevin/.t3/worktrees/ColdGuard/t3code-0ce521ab/src/features/dashboard/components/top-nav.tsx)
- inbox route `app/notifications.tsx`
- incident detail route `app/incident/[id].tsx`

Screen behavior:
- inbox shows `Active incidents` first, then `Resolved recently`
- incident detail shows status, device context, timeline, acknowledge/resolve actions, and deep link back to device detail
- dashboard home shows top 3 active incidents preview under the status strip
- settings gets notification permission state and channel preferences

### Client modules

Add `src/features/notifications/` with:
- `providers/notification-provider.tsx`
- `services/push-registration.ts`
- `services/local-notifications.ts`
- `services/inbox-sync.ts`
- `hooks/use-notification-inbox.ts`
- `hooks/use-unread-count.ts`
- `components/notification-list-item.tsx`
- `components/incident-action-bar.tsx`

Use `expo-notifications` as the first provider, but wrap it behind an internal delivery interface so the backend and app do not depend on Expo-specific naming outside the adapter.

## Data Flow

1. Device sync or future ingest path produces a normalized operational snapshot.
2. `evaluateOperationalSnapshot` compares snapshot state against open incidents and thresholds.
3. Engine opens, updates, escalates, resolves, or reopens incidents.
4. Engine writes incident and event records.
5. Delivery dispatcher evaluates eligible users, preferences, quiet hours, and escalation rules.
6. Push payload includes `incidentId` and deep link target `"/incident/[id]"`.
7. App syncs inbox into SQLite, mirrors allowed events to local notifications, and updates unread badge.
8. If user is offline, read/ack/resolve/preference changes are queued in `sync_jobs` and replayed later.

## Testing And Acceptance Criteria

### Engine tests
- creates one incident per active condition instead of duplicating on repeated snapshots
- upgrades warning to critical correctly
- resolves using the defined recovery rules
- reopens within 30 minutes and creates new incident after 30 minutes
- escalates only unresolved critical incidents at 5 and 15 minutes

### Delivery tests
- critical incidents push immediately to eligible users
- warning incidents stay inbox/local-first until unresolved for 15 minutes
- quiet hours suppress non-critical push only
- supervisor escalation repeats do not go to nurses
- token rotation deactivates stale push tokens

### Client tests
- top nav unread badge reflects inbox state
- inbox renders active/resolved groups from cached data
- incident actions queue offline and reconcile online
- deep links from push open incident detail
- settings preferences persist and round-trip

### Acceptance criteria
- a critical temperature alert is visible in-app, locally, and by push within one evaluation cycle
- an acknowledged incident stops escalation repeats
- a resolved incident remains auditable in history
- reinstall/login on a new device can register a new push token without losing inbox history
- users never receive duplicate pushes for the same unchanged incident state

## Rollout

1. Add schema, internal engine, and in-app inbox behind a feature flag.
2. Ship local notifications and unread badge using cached/simulated incidents.
3. Add push token registration and critical push delivery.
4. Enable timed escalation for supervisors.
5. Remove the feature flag after validation in one institution cohort.

## Assumptions And Defaults

- Notification scope is operational incidents only.
- Multi-channel delivery is required in the target design.
- Current roles remain `Nurse` and `Supervisor`.
- Institution-wide visibility is acceptable until assignment exists.
- Critical safety alerts cannot be disabled by user preference.
- No new primary tab is introduced; notifications live behind the shared header bell.
- Push provider is Expo first, behind an internal adapter.
- Thresholds are code constants in v1, not admin-managed data.
