# Notification Settings Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the settings page into a structured notification settings surface with per-type routine alert controls while keeping critical alerts mandatory and all incidents visible in Notifications.

**Architecture:** Extend the user notification preference model with per-type routine alert settings, thread those settings through local and remote alert filtering, and replace the current settings screen with a grouped native-style layout using plain-language copy. Preserve the existing inbox and incident data model so preferences affect active alerting only, not incident visibility.

**Tech Stack:** Expo Router, React Native, TypeScript, Convex, Expo Notifications, Jest, Testing Library

---

### Task 1: Add notification preference types for per-type routine controls

**Files:**
- Modify: `src/features/notifications/types.ts`
- Test: `src/features/notifications/services/inbox-sync.test.ts`

**Step 1: Write the failing test**

Add assertions that notification preference normalization and defaults include routine per-type keys for `temperature`, `door_open`, `device_offline`, and `battery_low`.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/notifications/services/inbox-sync.test.ts`
Expected: FAIL because the new preference keys do not exist yet.

**Step 3: Write minimal implementation**

- Extend `NotificationPreferences`
- Add safe defaults for all routine per-type keys
- Update any normalization helpers that serialize preferences

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/notifications/services/inbox-sync.test.ts`
Expected: PASS for the new preference-shape assertions.

**Step 5: Commit**

```bash
git add src/features/notifications/types.ts src/features/notifications/services/inbox-sync.test.ts
git commit -m "feat: add per-type routine notification preferences"
```

### Task 2: Persist the new preference fields locally and through Convex

**Files:**
- Modify: `src/lib/storage/sqlite/schema.ts`
- Modify: `src/lib/storage/sqlite/notification-repository.ts`
- Modify: `src/lib/storage/sqlite/notification-repository.test.ts`
- Modify: `src/features/notifications/services/inbox-sync.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/notifications.ts`
- Modify: `convex/notifications.test.ts`

**Step 1: Write the failing tests**

Add tests that:
- local save/load round-trips the per-type routine fields
- Convex preference query/mutation returns and stores the new fields
- sync payload normalization includes the new keys

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/storage/sqlite/notification-repository.test.ts src/features/notifications/services/inbox-sync.test.ts convex/notifications.test.ts`
Expected: FAIL because storage and mutation layers do not support the new fields.

**Step 3: Write minimal implementation**

- extend SQLite schema or repository storage path for the new preference fields
- update local repository save/load methods
- update Convex schema and `getNotificationPreferences` / `updateNotificationPreferences`
- update inbox sync mapping between local and remote snapshots

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/storage/sqlite/notification-repository.test.ts src/features/notifications/services/inbox-sync.test.ts convex/notifications.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/storage/sqlite/schema.ts src/lib/storage/sqlite/notification-repository.ts src/lib/storage/sqlite/notification-repository.test.ts src/features/notifications/services/inbox-sync.ts convex/schema.ts convex/notifications.ts convex/notifications.test.ts
git commit -m "feat: persist per-type notification alert preferences"
```

### Task 3: Enforce per-type routine settings in local alert delivery

**Files:**
- Modify: `src/features/notifications/services/local-notifications.ts`
- Test: `src/features/notifications/services/local-notifications.test.ts`

**Step 1: Write the failing test**

Add tests covering:
- routine local notifications are skipped when the matching type is disabled
- critical local notifications still schedule even if the routine type is disabled

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/notifications/services/local-notifications.test.ts`
Expected: FAIL because local mirroring does not check per-type preferences.

**Step 3: Write minimal implementation**

Update local notification mirroring to:
- inspect incident severity and type
- apply per-type user preference only for non-critical incidents
- preserve current critical scheduling behavior

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/notifications/services/local-notifications.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/notifications/services/local-notifications.ts src/features/notifications/services/local-notifications.test.ts
git commit -m "feat: filter local routine alerts by notification type"
```

### Task 4: Enforce per-type routine settings in remote push targeting

**Files:**
- Modify: `convex/notifications.ts`
- Modify: `convex/notifications.test.ts`

**Step 1: Write the failing test**

Add tests covering:
- routine push recipients are skipped when that user disabled the matching type
- quiet hours still suppress routine pushes
- critical pushes still target eligible users regardless of routine type setting

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/notifications.test.ts`
Expected: FAIL because recipient filtering does not use per-type routine settings yet.

**Step 3: Write minimal implementation**

Update push target collection to:
- read the user’s per-type routine preference
- skip only routine incidents for disabled types
- preserve critical delivery and existing supervisor escalation logic

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/notifications.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/notifications.ts convex/notifications.test.ts
git commit -m "feat: filter routine push delivery by user notification type settings"
```

### Task 5: Redesign the settings screen layout and copy

**Files:**
- Modify: `app/(tabs)/settings.tsx`
- Modify: `src/features/notifications/hooks/use-notification-preferences.ts`
- Test: `src/features/dashboard/__tests__/settings-screen.test.tsx`

**Step 1: Write the failing test**

Add screen assertions for:
- grouped settings sections
- user-friendly copy
- one row for each notification type
- locked critical messaging
- quiet hours explanation

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/dashboard/__tests__/settings-screen.test.tsx`
Expected: FAIL because the current screen still renders the old generic layout.

**Step 3: Write minimal implementation**

- replace the current generic preference rows with a structured settings layout
- add plain-language labels and descriptions
- show editable routine toggles and fixed critical state
- keep permission/device registration summary at the top
- keep account/sign-out isolated at the bottom

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/dashboard/__tests__/settings-screen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(tabs)/settings.tsx src/features/notifications/hooks/use-notification-preferences.ts src/features/dashboard/__tests__/settings-screen.test.tsx
git commit -m "feat: redesign notification settings screen"
```

### Task 6: Verify end-to-end notification behavior remains safe

**Files:**
- Modify: `src/features/notifications/providers/notification-provider.tsx`
- Test: `src/features/notifications/services/inbox-sync.test.ts`
- Test: `src/features/dashboard/__tests__/settings-screen.test.tsx`
- Test: `convex/notifications.test.ts`

**Step 1: Write the failing test**

Add coverage that:
- disabled routine types do not remove incidents from notification inbox data
- unread/inbox behavior remains intact
- critical incidents still bypass routine preference filters

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/notifications/services/inbox-sync.test.ts src/features/dashboard/__tests__/settings-screen.test.tsx convex/notifications.test.ts`
Expected: FAIL where assumptions still couple preferences to visibility instead of interruption.

**Step 3: Write minimal implementation**

Make only the adjustments needed so preferences affect alert interruption, not inbox/history visibility.

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/notifications/services/inbox-sync.test.ts src/features/dashboard/__tests__/settings-screen.test.tsx convex/notifications.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/notifications/providers/notification-provider.tsx src/features/notifications/services/inbox-sync.test.ts src/features/dashboard/__tests__/settings-screen.test.tsx convex/notifications.test.ts
git commit -m "test: verify notification settings preserve critical safety behavior"
```

### Task 7: Run focused regression checks

**Files:**
- No code changes expected

**Step 1: Run notification and settings test suites**

Run: `npm test -- src/features/dashboard/__tests__/settings-screen.test.tsx src/features/notifications/services/inbox-sync.test.ts src/lib/storage/sqlite/notification-repository.test.ts src/features/notifications/services/local-notifications.test.ts convex/notifications.test.ts`
Expected: PASS

**Step 2: Run broader app smoke coverage**

Run: `npm test -- src/__tests__/smoke/app-renders.test.tsx`
Expected: PASS

**Step 3: Manually verify in the app**

Check:
- settings page structure feels like a real settings page
- routine toggles save and reflect current state
- critical rows are visibly locked
- notifications inbox still shows all incidents

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify notification settings redesign"
```
