# Startup And Enrollment Permission Preflight Design

**Date:** 2026-03-28

## Goal

Request all required Android permissions on cold launch, then re-check the same required permissions immediately before enrollment so pairing cannot proceed without them.

## Problem

The current app asks for some permissions only when a specific flow starts:

- BLE permission was previously discovered only when native enrollment started.
- Notification permission was previously discovered only after enrollment finished and monitoring bootstrap started.
- Nearby Wi-Fi permission is part of monitoring and enrollment behavior but was not consistently front-loaded.

This creates field failures where the user finishes or nearly finishes pairing and only then sees a permission rejection.

## Approved Approach

Use a two-layer permission strategy on Android:

1. Cold-launch preflight
- Request notification permission.
- Request BLE permissions.
- Request nearby Wi-Fi permission.
- Do this once per cold launch as soon as the app boots.

2. Enrollment hard gate
- Re-run the same permission checks just before enrollment begins.
- If any required permission is still missing, fail before native pairing starts.

The app should not become unusable if the user denies permissions on launch. Instead:

- General browsing remains available.
- Enrollment and monitoring remain gated by the same required permissions.

## Required Permissions

On Android 12+:

- `POST_NOTIFICATIONS`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_SCAN`
- `NEARBY_WIFI_DEVICES`

On older Android versions, the existing compatibility fallback remains:

- BLE/location fallback via `ACCESS_FINE_LOCATION`
- Wi-Fi/location fallback via `ACCESS_FINE_LOCATION`

## Architecture

Add a shared JS permission preflight in the app layer, not in the native bridge.

Reasons:

- The permission prompts are already handled in JS for BLE and notifications.
- Enrollment and monitoring logic already lives in `connection-service.ts`.
- A JS preflight can be reused by app startup and enrollment without duplicating native permission request code.

The design keeps native modules as permission consumers that may still reject if the OS state changes unexpectedly, but the normal UX path should front-load prompts in JS.

## Code Realignment

### Launch flow

Add an app-start permission preflight that runs once on Android cold launch. It should:

- request notifications
- request BLE transport permissions
- request Wi-Fi transport permissions

This should be best-effort:

- it should not crash the app
- it should not block routing
- it may silently stop if the user denies

### Enrollment flow

Keep enrollment as a hard gate:

- call the same permission preflight helpers before native enrollment starts
- if any permission is denied, do not call native enrollment

### Monitoring flow

Keep the current monitoring guard in place. Even after startup preflight, monitoring should still verify permission state because Android permissions can be revoked later.

## UX Expectations

Best-case flow:

1. User launches the app.
2. Android permission prompts appear.
3. User grants all required permissions.
4. Later enrollment proceeds without permission surprises.

Fallback flow:

1. User launches the app and skips or denies permissions.
2. App still opens.
3. When enrollment starts, the app asks again.
4. If permissions are still denied, enrollment stops before pairing begins.

## Testing

Add tests for:

- startup preflight requests required permissions on Android
- startup preflight does not throw when permissions are denied
- enrollment still rejects before native pairing if permissions remain denied
- existing monitoring tests keep passing

## Commit Plan

- commit the design doc
- commit the implementation plan
- commit startup preflight implementation
- commit any follow-up test or provider adjustments
