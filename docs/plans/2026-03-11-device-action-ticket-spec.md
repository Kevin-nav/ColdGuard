# Device Action Ticket Specification

**Date:** 2026-03-11

## Purpose

Define the target authorization format for sensitive local ESP32 actions so the system can remove routine on-device ES256 verification while keeping backend-controlled authorization.

This spec is the migration target for:

- device enrollment
- device connection
- device decommission
- device reassignment
- Wi-Fi provisioning or recovery

## Checklist

- required ticket fields are defined
- MAC input canonicalization is defined
- replay protection rules are defined
- action scopes are separated
- decommission wipe semantics are defined
- app-side caching limits are defined
- backend reconciliation states are defined

## Roles

- **Backend:** source of truth for authorization and ticket issuance
- **App:** authenticated operator client that fetches and carries tickets to the device
- **ESP32:** verifier of ticket authenticity, scope, expiry, and replay state

## Design Goals

- keep the ESP32 off the internet for local recovery actions
- tolerate weak phone connectivity after a ticket has already been fetched
- prevent replay and cross-device reuse
- keep verification small enough for production ESP32 firmware

## Ticket Scope

Each ticket authorizes exactly one action. Valid actions are:

- `enroll`
- `connect`
- `decommission`
- `reassign`
- `wifi_provision`

Tickets for one action must never be accepted for another action.

## Required Fields

Each action ticket payload must contain:

- `v`: protocol version
- `ticketId`: unique backend-generated identifier
- `deviceId`: target device identifier
- `institutionId`: institution scope when applicable
- `action`: one of the allowed actions
- `issuedAt`: backend-issued Unix epoch milliseconds
- `expiresAt`: backend-issued Unix epoch milliseconds
- `counter`: monotonically increasing device control counter
- `operatorId`: optional backend identity for audit correlation
- `mac`: MAC over the canonical payload

The ESP32 must reject tickets missing any required field other than `operatorId`.
On the current harness, these timestamps are signed metadata used for ordering and bounded-lifetime
validation. The device does not compare them against its own uptime clock because it does not keep a
trusted Unix wall clock.

## Canonical MAC Input

The MAC must be computed over the exact UTF-8 string:

```text
v|ticketId|deviceId|institutionId|action|issuedAt|expiresAt|counter|operatorId
```

Canonicalization rules:

- use an empty string for optional `operatorId` when absent
- all numbers are decimal ASCII
- no whitespace normalization
- no JSON key-order dependence
- the `mac` field itself is not part of the MAC input

Recommended MAC algorithm:

```text
HMAC-SHA256(deviceSecret, canonicalString)
```

The encoded MAC should be lowercase hex to simplify embedded verification.

## Device Secret

- every device must have a unique device secret
- the secret must survive decommission
- the secret must not be shared across devices
- the app must never derive or invent the secret

The backend may store the secret directly or store enough material to deterministically derive it.

## Expiry Rules

Recommended TTLs:

- `connect`: 2 to 5 minutes
- `wifi_provision`: 5 minutes
- `enroll`: 5 to 10 minutes
- `decommission`: 5 minutes
- `reassign`: 5 minutes

The ESP32 must reject:

- expired tickets
- tickets issued too far in the future relative to device time tolerance

The app should treat tickets as stale slightly before `expiresAt` to avoid borderline failures.

## Replay Protection

Replay protection is mandatory.

The ESP32 must persist replay state in NVS and reject:

- any ticket with `counter` less than the stored counter for the relevant control domain
- duplicate use of the same `ticketId`

Recommended implementation:

- store the highest accepted counter
- optionally store a small recent `ticketId` cache for the active counter window

At minimum, the ESP32 must enforce a monotonically increasing counter per device control domain.

## Action Semantics

### `enroll`

Authorizes a blank device to bind to an institution.

Expected checks:

- device is in `blank` state
- ticket action is `enroll`
- institution binding in ticket matches requested enrollment
- bootstrap or local claim path is also satisfied if still required

### `connect`

Authorizes local access needed to obtain or activate a Wi-Fi recovery ticket or other local access handoff.

Expected checks:

- device is enrolled
- institution matches current device ownership
- ticket action is `connect`

### `decommission`

Authorizes a supervisor-controlled wipe back to `blank`.

Expected checks:

- device is enrolled
- institution matches current device ownership
- ticket action is `decommission`

### `reassign`

Authorizes movement from one institution to another.

Preferred operational model:

- use `decommission` followed by fresh `enroll`

If `reassign` is implemented directly later, it must still be a separate scope and not a synonym for `connect`.

### `wifi_provision`

Authorizes BLE-driven Wi-Fi provisioning or recovery without exposing broader device-control privileges.

## App-Side Caching Rules

The app may cache action tickets briefly to tolerate connectivity degradation after ticket fetch.

Rules:

- store the ticket with `expiresAt`
- never reuse a ticket after local success
- never reuse a ticket after explicit rejection by the device
- aggressively discard stale tickets
- treat cached ticket use as a short-lived execution buffer, not offline authorization

## Backend Reconciliation States

After local device success, backend reconciliation may still be pending.

The app should model at least:

- `pending-local-execution`
- `local-success-pending-sync`
- `fully-synced`
- `local-failed`
- `sync-failed-retryable`

The backend remains authoritative after reconciliation completes.

## Decommission Wipe Semantics

A successful decommission must wipe:

- institution ID
- institution-bound handshake secret
- Wi-Fi credentials
- cached action replay state tied to institutional control
- local assignment and authorization state derived from enrollment

A successful decommission must retain:

- immutable device identity
- device secret
- manufacturing identity
- firmware

## Failure Handling

The ESP32 should return explicit failure reasons for:

- malformed ticket
- MAC mismatch
- expired ticket
- wrong device ID
- wrong institution
- wrong action
- replay detected
- invalid device state for requested action

## Migration Note

The app and backend can migrate to this ticket model while the firmware still carries transitional implementation details. In this repo, the harness currently uses a shared master key for ticket verification; production should replace that with per-device secret provisioning.
