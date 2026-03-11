# Deployment Readiness Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the local release blockers found in review so the ESP32 connection flow, local cache, and security model are production-worthy rather than demo-grade.

**Architecture:** Fix the regressions in the existing app and Convex data flow first, then replace destructive local persistence behavior, then harden the Android native bridge, and finally replace the shared-secret transport trust model with asymmetric grants and per-device bootstrap material. Keep each task test-first and scoped to one failure mode at a time.

**Tech Stack:** Expo SDK 55, Expo Router, React Native, Convex, expo-sqlite, Expo Modules, react-native-ble-plx, Arduino-ESP32, mbedTLS

---

### Task 1: Lock in regression coverage for the reviewed failures

**Files:**
- Modify: `src/features/devices/services/device-directory.test.ts`
- Modify: `src/features/dashboard/__tests__/device-details-screen.test.tsx`
- Create: `src/features/devices/services/wifi-bridge.test.ts`
- Modify: `src/lib/storage/sqlite/client.test.ts`
- Create: `convex/devices.test.ts`

**Step 1: Add a failing device sync regression test**

Add a test to `src/features/devices/services/device-directory.test.ts` proving that a cached `"success"` connection state is not overwritten by a remote summary that omits the field.

```ts
test("preserves cached connection test status when the server does not provide one", async () => {
  mockGetDevicesForInstitution.mockResolvedValue([
    { id: "device-1", lastConnectionTestStatus: "success", lastConnectionTestAt: 1000, institutionId: "institution-1", institutionName: "Korle-Bu", nickname: "Alpha", macAddress: "AA", firmwareVersion: "fw", protocolVersion: 1, deviceStatus: "enrolled", status: "enrolled", grantVersion: 1, accessRole: "manager", primaryAssigneeName: null, primaryAssigneeStaffId: null, viewerNames: [], currentTempC: 4.5, mktStatus: "safe", batteryLevel: 90, doorOpen: false, lastSeenAt: 900 },
  ]);
  mockQuery.mockResolvedValue([
    { deviceId: "device-1", nickname: "Alpha", firmwareVersion: "fw", grantVersion: 1, lastConnectionTestAt: 1000, lastSeenAt: 1200, status: "active", viewerAssignments: [], primaryAssigneeName: null, primaryStaffId: null },
  ]);

  await syncVisibleDevices(profileFixture);

  expect(mockReplaceCachedDevicesForInstitution).toHaveBeenCalledWith(
    expect.objectContaining({
      devices: [expect.objectContaining({ lastConnectionTestStatus: "success" })],
    }),
  );
});
```

**Step 2: Run the focused test and confirm it fails**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/devices/services/device-directory.test.ts`

Expected: FAIL because the synced device still receives `"idle"`.

**Step 3: Add a failing device detail UI regression test**

Add a test to `src/features/dashboard/__tests__/device-details-screen.test.tsx` asserting that `"idle"` renders as `"Pending"` instead of `"Running"`.

```ts
expect(ui.getByText("Pending")).toBeTruthy();
expect(ui.queryByText("Running")).toBeNull();
```

**Step 4: Run the device detail screen test and confirm it fails**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/dashboard/__tests__/device-details-screen.test.tsx`

Expected: FAIL because `formatConnectionStatus("idle")` currently returns `"Running"`.

**Step 5: Add a failing migration safety test**

Extend `src/lib/storage/sqlite/client.test.ts` with a test that asserts incompatible schemas are migrated without `DROP TABLE`.

```ts
expect(db.execAsync).not.toHaveBeenCalledWith(expect.stringContaining("DROP TABLE IF EXISTS devices"));
```

**Step 6: Add a failing Wi-Fi bridge cleanup test**

Create `src/features/devices/services/wifi-bridge.test.ts` and assert the JS bridge calls into the native module and that the native module contract includes explicit cleanup behavior in comments/test doubles.

```ts
test("connect fails loudly when the native module is missing on android", async () => {
  jest.doMock("react-native", () => ({ Platform: { OS: "android" } }));
  expect(createColdGuardWifiBridge().connect(ticketFixture)).rejects.toThrow("WIFI_BRIDGE_UNAVAILABLE");
});
```

**Step 7: Add a failing Convex security test**

Create `convex/devices.test.ts` with a test that rejects HS256/shared-secret grants once the asymmetric verifier is introduced.

```ts
test("rejects grants signed with the legacy shared secret format", async () => {
  await expect(verifyDeviceGrant(legacyGrantFixture)).rejects.toThrow("LEGACY_GRANT_FORMAT_REJECTED");
});
```

**Step 8: Commit the test scaffolding**

```bash
git add src/features/devices/services/device-directory.test.ts src/features/dashboard/__tests__/device-details-screen.test.tsx src/features/devices/services/wifi-bridge.test.ts src/lib/storage/sqlite/client.test.ts convex/devices.test.ts
git commit -m "test: lock in deployment readiness regressions"
```

### Task 2: Preserve real connection-test state through sync and UI

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/devices.ts`
- Modify: `src/features/devices/types.ts`
- Modify: `src/features/devices/services/device-directory.ts`
- Modify: `app/device/[id].tsx`
- Modify: `src/lib/storage/sqlite/device-repository.ts`

**Step 1: Add the missing backend field**

Add `lastConnectionTestStatus` to the Convex `devices` table schema in `convex/schema.ts`.

```ts
lastConnectionTestStatus: v.optional(v.string()),
```

**Step 2: Persist the status during connection-test audit writes**

Patch `recordConnectionTest` in `convex/devices.ts` so it accepts a status and stores it.

```ts
args: {
  deviceId: v.string(),
  transport: v.string(),
  summary: v.string(),
  status: v.union(v.literal("success"), v.literal("failed")),
}
```

**Step 3: Stop hard-coding `"idle"` in device summaries**

Update `mapDeviceSummary` in `convex/devices.ts`.

```ts
lastConnectionTestStatus: device.lastConnectionTestStatus ?? null,
lastSeenAt: device.lastSeenAt ?? device.updatedAt,
```

**Step 4: Preserve cached status when the backend omits it**

Update `buildCachedDeviceRecord` in `src/features/devices/services/device-directory.ts`.

```ts
lastConnectionTestStatus:
  remote.lastConnectionTestStatus === undefined
    ? existing?.lastConnectionTestStatus ?? "idle"
    : remote.lastConnectionTestStatus,
```

**Step 5: Fix the label mapping in the screen**

Update `formatConnectionStatus` in `app/device/[id].tsx`.

```ts
if (!status || status === "idle") return "Pending";
if (status === "running") return "Running";
return status === "success" ? "Success" : "Failed";
```

**Step 6: Pass the status into backend audit logging**

Update `runColdGuardConnectionTest` in `src/features/devices/services/connection-service.ts`.

```ts
await recordDeviceConnectionTest({
  deviceId: args.deviceId,
  summary: payload.statusText,
  transport: "ble+wifi",
  status: "success",
});
```

**Step 7: Run the focused tests**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/devices/services/device-directory.test.ts src/features/dashboard/__tests__/device-details-screen.test.tsx src/features/devices/services/connection-service.test.ts`

Expected: PASS

**Step 8: Commit**

```bash
git add convex/schema.ts convex/devices.ts src/features/devices/types.ts src/features/devices/services/device-directory.ts app/device/[id].tsx src/features/devices/services/connection-service.ts
git commit -m "fix: preserve connection test state across refresh"
```

### Task 3: Fix institution-id handling in seeded local data

**Files:**
- Modify: `app/(onboarding)/link-institution.tsx`
- Modify: `src/features/dashboard/services/dashboard-seed.ts`
- Modify: `src/lib/storage/sqlite/device-repository.test.ts`
- Modify: `src/features/dashboard/services/profile-hydration.test.ts`

**Step 1: Add a failing seed regression test**

Add a test asserting that seeded devices are written under the real `institutionId`, not the display name.

```ts
expect(mockRunAsync).toHaveBeenCalledWith(
  expect.stringContaining("DELETE FROM devices WHERE institution_id = ?"),
  "institution-1",
);
```

**Step 2: Change the seed function signature**

Update `seedDashboardDataForInstitution` to accept both `institutionId` and `institutionName`.

```ts
export async function seedDashboardDataForInstitution(args: {
  institutionId: string;
  institutionName: string;
}) { /* ... */ }
```

**Step 3: Use the real id in repository calls**

Inside `dashboard-seed.ts`, switch all repository calls from `institutionName` to `args.institutionId`.

```ts
const existingDevices = await getDevicesForInstitution(args.institutionId);
await saveDevicesForInstitution(args.institutionId, seededDevices, args.institutionName);
```

**Step 4: Update onboarding callers**

Patch `app/(onboarding)/link-institution.tsx` to call the new signature.

```ts
await seedDashboardDataForInstitution({
  institutionId: result.institutionId,
  institutionName: result.institutionName,
});
```

**Step 5: Run the focused tests**

Run: `node node_modules/jest/bin/jest.js --runInBand src/lib/storage/sqlite/device-repository.test.ts src/features/dashboard/services/profile-hydration.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add app/(onboarding)/link-institution.tsx src/features/dashboard/services/dashboard-seed.ts src/lib/storage/sqlite/device-repository.test.ts src/features/dashboard/services/profile-hydration.test.ts
git commit -m "fix: seed local devices under institution ids"
```

### Task 4: Replace destructive SQLite compatibility logic with versioned migrations

**Files:**
- Modify: `src/lib/storage/sqlite/client.ts`
- Modify: `src/lib/storage/sqlite/schema.ts`
- Modify: `src/lib/storage/sqlite/client.test.ts`
- Modify: `src/lib/storage/sqlite/profile-repository.ts`
- Modify: `src/lib/storage/sqlite/device-repository.ts`
- Modify: `src/lib/storage/sqlite/connection-grant-repository.ts`

**Step 1: Introduce a schema version table**

Add a metadata table to `src/lib/storage/sqlite/schema.ts`.

```ts
sqliteMeta: `
  CREATE TABLE IF NOT EXISTS sqlite_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`,
```

**Step 2: Add an explicit schema version constant**

In `client.ts`, define a single source of truth.

```ts
const SQLITE_SCHEMA_VERSION = 2;
```

**Step 3: Replace `ensureTableColumns` drops with migrations**

Remove the `DROP TABLE IF EXISTS` branch and replace it with versioned migration helpers.

```ts
await runSQLiteMigrations(database, currentVersion, SQLITE_SCHEMA_VERSION);
```

**Step 4: Implement idempotent migrations**

Create migration steps such as:

```ts
async function migrateToV2(database: SQLiteDatabase) {
  await database.execAsync("ALTER TABLE devices ADD COLUMN firmware_version TEXT NOT NULL DEFAULT ''");
  await database.execAsync("ALTER TABLE devices ADD COLUMN protocol_version INTEGER NOT NULL DEFAULT 1");
  await database.execAsync("ALTER TABLE devices ADD COLUMN device_status TEXT NOT NULL DEFAULT 'enrolled'");
  await database.execAsync("ALTER TABLE devices ADD COLUMN grant_version INTEGER NOT NULL DEFAULT 1");
  await database.execAsync("ALTER TABLE devices ADD COLUMN access_role TEXT NOT NULL DEFAULT 'viewer'");
  await database.execAsync("ALTER TABLE devices ADD COLUMN viewer_names_json TEXT NOT NULL DEFAULT '[]'");
  await database.execAsync("ALTER TABLE devices ADD COLUMN last_connection_test_status TEXT");
}
```

**Step 5: Add tests for upgrade behavior**

Extend `client.test.ts` so a legacy schema upgrade preserves rows and does not call `DROP TABLE`.

**Step 6: Run the focused tests**

Run: `node node_modules/jest/bin/jest.js --runInBand src/lib/storage/sqlite/client.test.ts src/lib/storage/sqlite/profile-repository.test.ts src/lib/storage/sqlite/device-repository.test.ts src/lib/storage/sqlite/connection-grant-repository.test.ts`

Expected: PASS

**Step 7: Commit**

```bash
git add src/lib/storage/sqlite/client.ts src/lib/storage/sqlite/schema.ts src/lib/storage/sqlite/client.test.ts src/lib/storage/sqlite/profile-repository.ts src/lib/storage/sqlite/device-repository.ts src/lib/storage/sqlite/connection-grant-repository.ts
git commit -m "fix: use versioned sqlite migrations instead of table drops"
```

### Task 5: Harden the Android Wi-Fi bridge lifecycle

**Files:**
- Modify: `modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt`
- Modify: `src/features/devices/services/wifi-bridge.ts`
- Create: `src/features/devices/services/wifi-bridge.test.ts`
- Modify: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Add a failing native-bridge contract test**

In `src/features/devices/services/wifi-bridge.test.ts`, assert:
- Android throws if the native module is absent
- non-Android throws a clear unsupported error
- the bridge passes `ssid` and `password` through unchanged

**Step 2: Add cleanup to every terminal callback**

Patch `ColdGuardWifiBridgeModule.kt`.

```kt
fun finishWithSuccess(result: Map<String, String>) {
  try { connectivityManager.unregisterNetworkCallback(callback) } catch (_: Exception) {}
  if (continuation.isActive) continuation.resume(result)
}
```

**Step 3: Add an explicit timeout**

Wrap the request in a timeout path so the promise does not hang forever.

```kt
handler.postDelayed({ finishWithError(IllegalStateException("WIFI_AP_TIMEOUT")) }, 15000)
```

**Step 4: Unbind after the HTTP test**

Extend the JS bridge to expose a `disconnect()` or `release()` call after the connection test finishes, then call it from `runColdGuardConnectionTest`.

```ts
export type ColdGuardWifiBridge = {
  connect(ticket: ColdGuardWifiTicket): Promise<{ localIp: string; ssid: string }>;
  release(): Promise<void>;
};
```

**Step 5: Document the lifecycle in the runbook**

Update `docs/runbooks/esp32-transport-harness.md` with timeout, cleanup, and retry expectations.

**Step 6: Run the focused tests**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/devices/services/wifi-bridge.test.ts src/features/devices/services/connection-service.test.ts`

Expected: PASS

**Step 7: Commit**

```bash
git add modules/coldguard-wifi-bridge/android/src/main/java/expo/modules/coldguardwifibridge/ColdGuardWifiBridgeModule.kt src/features/devices/services/wifi-bridge.ts src/features/devices/services/wifi-bridge.test.ts src/features/devices/services/connection-service.ts docs/runbooks/esp32-transport-harness.md
git commit -m "fix: clean up android wifi handover lifecycle"
```

### Task 6: Replace the shared-secret grant model with asymmetric verification

**Files:**
- Modify: `convex/devices.ts`
- Modify: `src/features/devices/types.ts`
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/protocol.ts`
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `firmware/esp32_transport_harness/README.md`
- Modify: `docs/plans/2026-03-10-real-esp32-connection-design.md`
- Modify: `docs/runbooks/esp32-transport-harness.md`
- Modify: `convex/devices.test.ts`
- Modify: `src/features/devices/services/connection-service.test.ts`

**Step 1: Define the new grant shape**

Update `src/features/devices/types.ts` to include issuer, subject, algorithm, and key id metadata.

```ts
export type CachedConnectionGrant = {
  iss: string;
  sub: string;
  kid: string;
  alg: "ES256";
  deviceId: string;
  exp: number;
  grantVersion: number;
  institutionId: string;
  permission: "connect" | "manage";
  role: string;
  token: string;
  v: number;
};
```

**Step 2: Replace HMAC signing in Convex**

Swap the HS256 helper for an ES256 signer backed by server-only key material.

```ts
const grant = await signEs256Grant(claims, process.env.COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY!);
```

**Step 3: Embed only the public key in firmware**

Replace `kGrantSigningSecret` in `esp32_transport_harness.ino` with a PEM public key constant and ES256 verification.

```cpp
constexpr char kGrantVerificationPublicKeyPem[] = R"pem(
-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----
)pem";
```

**Step 4: Replace the shared default bootstrap token**

Introduce per-device bootstrap material loaded from NVS or generated at provisioning time.

```cpp
String bootstrapToken = preferences.getString("bootstrap", generateProvisioningToken());
```

**Step 5: Reject legacy grants explicitly**

Keep the old verifier path only long enough to return a controlled error.

```cpp
if (headerAlg == "HS256") {
  return false;  // legacy shared-secret grants are not accepted
}
```

**Step 6: Update app-side tests and fixtures**

Change `connection-service.test.ts` and `convex/devices.test.ts` to use the new fixture shape and legacy rejection cases.

**Step 7: Run the focused tests**

Run: `node node_modules/jest/bin/jest.js --runInBand convex/devices.test.ts src/features/devices/services/connection-service.test.ts`

Expected: PASS

**Step 8: Commit**

```bash
git add convex/devices.ts src/features/devices/types.ts src/features/devices/services/connection-service.ts src/features/devices/services/protocol.ts firmware/esp32_transport_harness/esp32_transport_harness.ino firmware/esp32_transport_harness/README.md docs/plans/2026-03-10-real-esp32-connection-design.md docs/runbooks/esp32-transport-harness.md convex/devices.test.ts src/features/devices/services/connection-service.test.ts
git commit -m "feat: replace shared-secret grants with asymmetric verification"
```

### Task 7: Final verification and local release check

**Files:**
- Modify as needed based on test failures

**Step 1: Run the targeted remediation suite**

Run: `node node_modules/jest/bin/jest.js --runInBand src/features/devices/services/device-directory.test.ts src/features/devices/services/connection-service.test.ts src/features/devices/services/wifi-bridge.test.ts src/features/dashboard/__tests__/device-details-screen.test.tsx src/lib/storage/sqlite/client.test.ts src/lib/storage/sqlite/device-repository.test.ts convex/devices.test.ts`

Expected: PASS

**Step 2: Run lint**

Run: `npm run lint`

Expected: PASS with no new warnings in changed files

**Step 3: Review the local diff**

Run: `git status --short`

Expected: only the intended remediation files are changed

**Step 4: Perform the manual device checklist**

Run this locally on an Android dev build and ESP32 harness:
- Enroll a blank device from QR
- Log out and back in with a pending enrollment payload
- Run a connection test and confirm the success status survives refresh
- Re-run the connection test after a Wi-Fi failure and confirm timeout cleanup
- Upgrade from a legacy SQLite database and confirm profile/devices/grants are retained
- Verify a legacy HS256 grant is rejected and an ES256 grant succeeds

**Step 5: Commit the final cleanups**

```bash
git add .
git commit -m "chore: verify deployment readiness remediation"
```
