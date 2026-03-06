# Role-Based Navigation And Dashboard Design

Date: 2026-03-06
Status: Approved
Source: approved UX discussion for onboarding-to-dashboard flow improvements

## Scope Decisions

- Keep onboarding focused on account setup and first-run orientation.
- Move the post-onboarding experience into a role-based app shell.
- Use the same primary navigation for both roles:
  - `Dashboard`
  - `Devices`
  - `Profile`
  - `Settings`
- Keep `Profile` personal-only for all users.
- Add supervisor-only staff operations as a dedicated route launched from the dashboard, not a primary tab.

## 1. Product Goals

The current post-onboarding experience does not feel like a complete application shell. The dashboard is fixed-height, cannot scroll, and mixes summary content with navigation responsibilities. The goal of this redesign is to turn the app into a clearer operational workspace with proper movement between screens.

Success for this slice means:
- onboarding ends in a stable app shell
- the dashboard feels like a true dashboard rather than a placeholder card stack
- users can scroll naturally on content-heavy screens
- profile information has a dedicated ongoing home
- supervisor-only operations are visible without polluting nurse flows

## 2. Target Flow

The main user flow becomes:
- `Login`
- `Link Institution`
- `Confirm Profile`
- `Role-based app shell`

Once onboarding is complete, users should not be routed back into onboarding-style screens for ordinary usage. The app should feel persistent, navigable, and structured around day-to-day work.

## 3. Navigation Model

### Shared primary tabs

Both nurses and supervisors see:
- `Dashboard`
- `Devices`
- `Profile`
- `Settings`

This keeps the shell stable and easy to learn while avoiding a separate mental model for basic navigation.

### Role-specific behavior

Role differences appear inside screens, not in the tab names:
- Nurses see nurse-scoped device views and task-oriented summaries.
- Supervisors see institution-wide summaries, broader device visibility, and access to management tools.

### Supervisor-only route

Supervisors get a dedicated `Staff Management` screen reachable from the supervisor dashboard. This is not a tab.

Reasoning:
- it keeps navigation stable
- it avoids overloading `Profile`
- it gives team operations room to expand later without restructuring the whole shell

## 4. Dashboard UX

### Shared dashboard principles

Both dashboards should:
- use vertical scrolling
- prioritize summary and quick actions
- route users into dedicated screens instead of trying to hold every workflow
- feel mobile-first, with readable section breaks and actionable cards

### Nurse dashboard

The nurse dashboard should be card-based and operational:
- role-aware greeting and institution context
- high-level status summary
- assigned or relevant device health
- active alert visibility
- quick actions into device details or immediate workflows
- recent readings or recent activity snapshot

### Supervisor dashboard

The supervisor dashboard should also be card-based, but denser:
- institution-wide health summary
- alert counts and fleet status
- visible management shortcuts
- `Staff Management` entry point
- device oversight shortcuts
- sync or operational overview where useful

The supervisor dashboard should communicate broader control without turning into a desktop-style admin console.

## 5. Dedicated Screens

### Devices

The `Devices` tab becomes the dedicated device workspace.

Expected responsibilities:
- complete list view
- room for filters or grouping later
- drill-down into individual device details later

Role behavior:
- nurses see permitted devices
- supervisors see wider institution inventory

### Profile

The `Profile` tab is always personal-only.

Expected contents:
- display name
- role
- email
- institution
- staff ID when available
- local/offline persistence messaging if needed

This screen should not include staff directory or staff management capabilities.

### Settings

The `Settings` tab should hold non-operational controls:
- sign out
- sync state or local persistence status
- app preferences
- future support/about items

## 6. Onboarding Changes

Onboarding should remain short and linear:
- institution link should clearly indicate it is still setup, not the main app
- profile confirmation should act as the final review step
- the call to action should move the user into the new app shell, not “home” in the generic sense

The first post-onboarding landing screen should be the role-aware dashboard tab.

## 7. Technical Direction

Use Expo Router tabs as the primary shell for the app and keep role-specific behavior inside route components.

Expected route shape:
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/home.tsx`
- `app/(tabs)/devices.tsx`
- `app/(tabs)/profile.tsx`
- `app/(tabs)/settings.tsx`
- `app/staff-management.tsx` or equivalent supervisor-only route

Shared bootstrap logic should continue to hydrate profile and local dashboard data before screen content renders.

## 8. Error Handling And Access Control

- If local bootstrap fails, screens should render safe error states rather than blank views.
- Nurses must not be able to access supervisor-only routes.
- If a user lacks the right role, the `Staff Management` screen should redirect or render an access-denied state.
- Empty states should still feel intentional:
  - no devices
  - no recent alerts
  - no team data yet

## 9. Testing Strategy

- route tests for role-based shell behavior
- screen tests for scrollable dashboard layouts
- interaction tests for supervisor-only `Staff Management` access
- regression tests to ensure `Profile` remains personal-only
- onboarding tests to confirm completion routes into the app shell correctly

## 10. Immediate Execution Focus

Implement in this order:
1. add a real tabs layout
2. make the dashboard scrollable and role-aware
3. split device, profile, and settings into dedicated screens
4. add supervisor-only `Staff Management` route from the dashboard
5. verify access control and onboarding handoff

## Notes

- This slice is focused on information architecture and UX flow, not deep feature expansion.
- The design intentionally leaves room for future changes to tab structure if product needs evolve.
- Git commit could not be created from the current workspace because it is not recognized as a git repository from this path.
