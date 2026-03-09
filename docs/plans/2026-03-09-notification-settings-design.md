# Notification Settings Redesign Design

## Summary

Redesign the settings page into a functional notification control center that lets nurses and supervisors manage only their personal alert experience. Users can control non-critical routine alerts by notification type, but critical alerts remain mandatory and cannot be disabled. Notification incidents must still appear in the inbox and history even when routine alerting for that type is turned off.

## Goals

- Make the settings page feel like a real operational settings surface instead of a generic card stack.
- Let users control routine alerts by notification type in plain, user-friendly language.
- Keep critical alerts always enabled.
- Ensure user preferences affect only what that user sees or gets interrupted by, not institution-wide sync or backend delivery policy.
- Keep all incidents visible in Notifications for audit and review.

## Non-Goals

- No institution-wide notification administration from the mobile app.
- No user control over cloud sync, escalation policy, or mandatory critical delivery.
- No hiding of incidents from inbox/history based on user preference.

## User Rules

- Critical alerts are always shown and always alert.
- Routine alerts can be turned on or off per notification type for the current user.
- Turning off a routine alert stops active interruptions for that user but does not remove the incident from Notifications.
- Quiet hours apply only to routine alerts.

## Information Architecture

The settings page should be organized into clear sections:

1. `Notification status`
   - Push permission status
   - Device registration action/state
   - Plain-language safety summary: critical alerts are always on

2. `Alert preferences`
   - One row per notification type:
     - Temperature
     - Door open
     - Offline
     - Low battery
   - Each row shows:
     - user-friendly title
     - plain-language description
     - editable routine alert toggle
     - locked critical alert indicator

3. `Quiet hours`
   - Start/end times
   - explanatory copy that critical alerts still come through

4. `Account`
   - signed-in user summary
   - sign-out action

## UX Principles

- Copy should be operational and friendly, not implementation-oriented.
- Avoid labels such as `warningPushEnabled`, `delivery channel`, `incident type`, or backend terminology.
- Descriptions should explain outcome, not mechanism.
- The page should use grouped settings rows and structural spacing similar to a native settings screen.

## Suggested User-Facing Copy

- `Critical alerts are always on.`
- `Choose which routine alerts this device should interrupt you about.`
- `Turning off a routine alert stops the interruption, but the incident will still appear in Notifications.`
- `Temperature`
  - `Warnings when a unit is drifting outside the safe range.`
- `Door open`
  - `Alerts when a unit door has been left open longer than expected.`
- `Offline`
  - `Alerts when a device has not checked in recently.`
- `Low battery`
  - `Warnings when a device may need charging or power.`
- `Quiet hours only affect routine alerts. Critical alerts still come through.`

## Data Model

Extend user notification preferences with per-type routine alert controls. The existing preference object should keep global fields that remain useful, but add a non-critical per-type map keyed by:

- `temperature`
- `door_open`
- `device_offline`
- `battery_low`

Each key stores whether routine alerting is enabled for that user.

Example shape:

```ts
type NotificationTypeRoutinePreferences = {
  temperature: boolean;
  door_open: boolean;
  device_offline: boolean;
  battery_low: boolean;
};
```

This is a user preference only. It does not change incident generation, backend evaluation, or cloud synchronization.

## Enforcement

Preferences should be enforced only for routine non-critical interruptions:

- Local notification mirroring should skip routine incidents whose type is disabled for that user.
- Remote push targeting should skip routine incidents whose type is disabled for that user.
- Critical incidents bypass these filters entirely.
- Inbox, unread history, and incident detail remain available regardless of these preferences unless a user separately archives or reads an item.

## Error Handling

- If saving fails, show a user-facing message such as `We couldn't save your alert preferences. Try again.`
- If permissions are denied, show a friendly explanation with the current state.
- If preference data is missing, default to the safe state: routine alerts on, critical alerts always on.

## Testing Expectations

- settings screen renders the new grouped structure and plain-language copy
- per-type routine preference toggles save correctly
- critical alert controls are not editable
- local routine delivery respects disabled types
- push routine targeting respects disabled types
- critical alerts still deliver regardless of routine settings
- inbox/history still retain incidents when routine alerting is disabled

