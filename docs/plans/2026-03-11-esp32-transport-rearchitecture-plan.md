# ESP32 Transport Rearchitecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current ESP32 BLE-plus-ES256 transport model with a Wi-Fi-first production architecture that keeps BLE for provisioning and recovery while using backend-issued short-lived device action tickets instead of heavy on-device public-key verification.

**Architecture:** The backend remains the authorization source and issues short-lived action tickets bound to a specific device and action. The app fetches and briefly caches those tickets, executes local BLE actions against the ESP32, and reconciles backend state afterward. The firmware keeps a minimal production reprovisioning path and excludes factory-only features from the shipped profile.

**Tech Stack:** Expo React Native app, Convex backend, SQLite/secure-store local state, Arduino-ESP32 firmware, NVS preferences, BLE plus Wi-Fi local transport.

---

### Task 1: Document the shared ticket model

**Files:**
- Create: `docs/plans/2026-03-11-device-action-ticket-spec.md`
- Modify: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Write the failing documentation checklist**

Add a checklist in the spec for:
- required ticket fields
- replay protection rules
- enroll/decommission/reassign scopes
- decommission wipe semantics

**Step 2: Review current contract docs**

Run: `Get-Content docs\runbooks\esp32-transport-harness.md`

Expected: current grant model documents ES256-style signed grants and BLE-driven Wi-Fi handoff.

**Step 3: Write the ticket spec**

Document:
- ticket schema
- MAC input canonicalization
- TTL limits
- NVS replay storage rules
- app-side caching limits
- backend reconciliation states

**Step 4: Update the runbook summary**

Add a short migration note pointing the transport runbook at the new ticket spec.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-11-device-action-ticket-spec.md docs/runbooks/esp32-transport-harness.md
git commit -m "docs: define device action ticket protocol"
```

### Task 2: Add backend ticket issuance primitives

**Files:**
- Modify: `convex/devices.ts`
- Test: `convex/devices.test.ts`

**Step 1: Write the failing backend tests**

Add tests covering:
- issuing `connect`, `enroll`, `decommission`, and `reassign` action tickets
- rejecting unauthorized operators
- binding ticket payload to `deviceId`
- short TTL behavior

**Step 2: Run the tests to verify failure**

Run: `npm test -- convex/devices.test.ts`

Expected: FAIL because ticket issuance and validation helpers do not exist yet.

**Step 3: Implement minimal backend issuance**

Add helpers that:
- load or derive the device secret reference
- assemble canonical ticket payloads
- MAC the payload
- return ticket metadata to the app

Keep the existing grant path intact until migration is complete.

**Step 4: Re-run the backend tests**

Run: `npm test -- convex/devices.test.ts`

Expected: PASS for the new ticket-issuance cases.

**Step 5: Commit**

```bash
git add convex/devices.ts convex/devices.test.ts
git commit -m "feat: issue backend device action tickets"
```

### Task 3: Add app-side ticket types and storage

**Files:**
- Modify: `src/features/devices/types.ts`
- Modify: `src/lib/storage/sqlite/schema.ts`
- Modify: `src/lib/storage/sqlite/connection-grant-repository.ts`
- Modify: `src/lib/storage/sqlite/connection-grant-repository.test.ts`
- Modify: `src/lib/storage/sqlite/client.ts`
- Modify: `src/lib/storage/sqlite/client.test.ts`

**Step 1: Write the failing repository tests**

Add tests covering:
- storing action tickets by `deviceId` and action
- TTL freshness checks
- replacing stale cached entries
- preserving existing grant storage during migration

**Step 2: Run the repository tests**

Run: `npm test -- src/lib/storage/sqlite/connection-grant-repository.test.ts src/lib/storage/sqlite/client.test.ts`

Expected: FAIL because the schema and repository do not support action tickets yet.

**Step 3: Implement minimal persistence**

Add:
- ticket type definitions
- storage schema fields for action and expiry
- repository helpers to read/write ticket records

Do not remove the old grant storage path yet.

**Step 4: Re-run the repository tests**

Run: `npm test -- src/lib/storage/sqlite/connection-grant-repository.test.ts src/lib/storage/sqlite/client.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/devices/types.ts src/lib/storage/sqlite/schema.ts src/lib/storage/sqlite/connection-grant-repository.ts src/lib/storage/sqlite/connection-grant-repository.test.ts src/lib/storage/sqlite/client.ts src/lib/storage/sqlite/client.test.ts
git commit -m "feat: persist device action tickets locally"
```

### Task 4: Update app device-directory flows to fetch action tickets

**Files:**
- Modify: `src/features/devices/services/device-directory.ts`
- Modify: `src/features/devices/services/device-directory.test.ts`

**Step 1: Write the failing service tests**

Add tests covering:
- fetching a fresh `connect` action ticket
- fetching a fresh `decommission` action ticket
- reusing a fresh cached action ticket
- falling back to backend when cache is stale

**Step 2: Run the tests**

Run: `npm test -- src/features/devices/services/device-directory.test.ts`

Expected: FAIL because service helpers still only expose grant-oriented APIs.

**Step 3: Implement minimal service changes**

Add explicit helpers such as:
- `ensureDeviceActionTicket(deviceId, action)`
- `ensureSupervisorActionTicket(profile, deviceId, action)`

Leave existing grant helpers available until all callers are migrated.

**Step 4: Re-run the tests**

Run: `npm test -- src/features/devices/services/device-directory.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/devices/services/device-directory.ts src/features/devices/services/device-directory.test.ts
git commit -m "feat: fetch app-side device action tickets"
```

### Task 5: Refactor app BLE client to send action tickets instead of grant tokens

**Files:**
- Modify: `src/features/devices/services/protocol.ts`
- Modify: `src/features/devices/services/ble-client.ts`
- Modify: `src/features/devices/services/ble-client.test.ts`

**Step 1: Write the failing BLE client tests**

Add tests covering:
- sending a ticket payload for `enroll`
- sending a ticket payload for `connect`
- sending a ticket payload for `decommission`
- preserving handshake-proof generation where still needed

**Step 2: Run the tests**

Run: `npm test -- src/features/devices/services/ble-client.test.ts src/features/devices/services/protocol.test.ts`

Expected: FAIL because the client still serializes `grantToken`.

**Step 3: Implement minimal protocol changes**

Update command payload shapes to use:
- `actionTicket`
- `proofTimestamp`
- optional proof fields that remain part of the design

Do not yet remove compatibility parsing if transitional support is needed.

**Step 4: Re-run the tests**

Run: `npm test -- src/features/devices/services/ble-client.test.ts src/features/devices/services/protocol.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/devices/services/protocol.ts src/features/devices/services/ble-client.ts src/features/devices/services/ble-client.test.ts
git commit -m "feat: send device action tickets over BLE"
```

### Task 6: Add app reconciliation state for poor-connectivity completion

**Files:**
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `src/features/devices/services/connection-service.test.ts`
- Modify: `src/lib/storage/sqlite/device-repository.ts`
- Modify: `src/lib/storage/sqlite/device-repository.test.ts`

**Step 1: Write the failing tests**

Add tests covering:
- local device success followed by backend sync failure
- persisting `pending-sync` status
- successful retry clearing the pending state

**Step 2: Run the tests**

Run: `npm test -- src/features/devices/services/connection-service.test.ts src/lib/storage/sqlite/device-repository.test.ts`

Expected: FAIL because reconciliation state is not modeled yet.

**Step 3: Implement minimal pending-sync support**

Add:
- local status persistence for unfinished backend reconciliation
- retry-safe state transitions
- exact failure-stage reporting for the UI

**Step 4: Re-run the tests**

Run: `npm test -- src/features/devices/services/connection-service.test.ts src/lib/storage/sqlite/device-repository.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/devices/services/connection-service.ts src/features/devices/services/connection-service.test.ts src/lib/storage/sqlite/device-repository.ts src/lib/storage/sqlite/device-repository.test.ts
git commit -m "feat: persist post-action reconciliation state"
```

### Task 7: Refactor firmware into modules with a production recovery boundary

**Files:**
- Create: `firmware/esp32_transport_harness/src/device_state.h`
- Create: `firmware/esp32_transport_harness/src/device_state.cpp`
- Create: `firmware/esp32_transport_harness/src/action_ticket.h`
- Create: `firmware/esp32_transport_harness/src/action_ticket.cpp`
- Create: `firmware/esp32_transport_harness/src/ble_recovery.h`
- Create: `firmware/esp32_transport_harness/src/ble_recovery.cpp`
- Create: `firmware/esp32_transport_harness/src/wifi_runtime.h`
- Create: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`

**Step 1: Write a smoke-test checklist**

Create a temporary checklist documenting:
- boot to blank state
- enroll path
- decommission path
- re-enroll path
- Wi-Fi connection test path

**Step 2: Extract state and transport boundaries**

Move logic out of the monolithic sketch into modules:
- persisted device state
- ticket verification and replay handling
- BLE recovery/provisioning commands
- Wi-Fi runtime and connection-test endpoint

Keep behavior equivalent while preparing for profile-level exclusion.

**Step 3: Manually verify compile structure**

Open the sketch in Arduino IDE and ensure the extra `.cpp/.h` files are included by the sketch build.

Expected: project structure compiles the same functionality with clearer module boundaries.

**Step 4: Manually test the smoke checklist**

Expected:
- blank device advertises
- enroll succeeds
- decommission wipes state
- device can re-enroll to another institution

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/esp32_transport_harness.ino firmware/esp32_transport_harness/src
git commit -m "refactor: modularize transport harness firmware"
```

### Task 8: Replace ES256 verification in firmware with action-ticket MAC verification

**Files:**
- Modify: `firmware/esp32_transport_harness/src/action_ticket.h`
- Modify: `firmware/esp32_transport_harness/src/action_ticket.cpp`
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Write the firmware verification checklist**

Add test cases for:
- wrong action
- wrong device ID
- expired ticket
- replayed counter
- successful decommission
- successful re-enroll

**Step 2: Remove the ES256 path minimally**

Replace:
- signed grant parsing
- public-key verification

With:
- canonical ticket parsing
- HMAC verification
- replay-state persistence

Keep only the cryptographic primitives strictly required for MAC verification.

**Step 3: Build and verify size improvement**

In Arduino IDE:
- compile the updated sketch
- record flash usage before and after

Expected: a meaningful reduction compared with the ES256-based transport harness.

**Step 4: Run the manual firmware checklist**

Expected:
- action tickets authorize valid operations
- replayed or stale tickets fail
- decommission returns the device to blank
- re-enroll works without USB reflashing

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness docs/runbooks/esp32-transport-harness.md
git commit -m "feat: verify lightweight action tickets on device"
```

### Task 9: Reduce production BLE footprint

**Files:**
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `docs/runbooks/esp32-transport-harness.md`
- Modify: `firmware/esp32_transport_harness/README.md`

**Step 1: Write the transport-scope checklist**

Document the BLE commands that remain in production:
- discover
- enroll
- decommission
- Wi-Fi recovery or provisioning

Document runtime flows that move to Wi-Fi/backend.

**Step 2: Remove non-recovery BLE responsibilities**

Keep BLE limited to provisioning and recovery boundaries.

Avoid adding production runtime data exchange over BLE unless there is a clear fallback requirement.

**Step 3: Evaluate NimBLE migration**

Compile and compare:
- current BLE stack
- NimBLE-based equivalent if feasible on the target board

Expected: choose the smaller stable option for the production recovery path.

**Step 4: Update docs**

Document:
- BLE as recovery/provisioning transport
- Wi-Fi as primary runtime path
- required Arduino partition settings during migration

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/esp32_transport_harness.ino firmware/esp32_transport_harness/README.md docs/runbooks/esp32-transport-harness.md
git commit -m "feat: limit production BLE to provisioning and recovery"
```

### Task 10: Define and document firmware profiles

**Files:**
- Create: `firmware/README.md`
- Create: `docs/runbooks/firmware-profiles.md`
- Modify: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Write the profile definition doc**

Define:
- `factory`
- `production`
- optional `rescue`

Include exact responsibilities and exclusions for each profile.

**Step 2: Document build entry points**

Add instructions for:
- how engineers choose a profile
- which files or flags control inclusion
- which profile supports field re-enrollment

**Step 3: Review docs for ambiguity**

Check that the docs make clear that `production` still supports:
- decommission
- re-enrollment
- institution reassignment

**Step 4: Commit**

```bash
git add firmware/README.md docs/runbooks/firmware-profiles.md docs/runbooks/esp32-transport-harness.md
git commit -m "docs: define firmware profiles and field recovery scope"
```
