# ESP32 Transport Rearchitecture Design

**Date:** 2026-03-11

## Goal

Redesign the ColdGuard device/app/backend interaction so the ESP32 can support decommission, re-enrollment, and normal runtime growth without depending on a large always-on BLE plus public-key-verification firmware image.

## Current Problem

The current transport harness combines:

- classic ESP32 BLE transport
- Wi-Fi SoftAP handoff
- `WebServer`
- `Preferences`
- on-device ES256 grant verification via `mbedtls`

That already exceeds the default `ESP32 Dev Module` app partition limit and leaves little room for the full production firmware.

## Constraints

- Decommission and re-enrollment must work from the app without USB reflashing.
- The ESP32 should not require direct internet connectivity to decommission or re-enroll.
- The system must remain secure; size reductions cannot come from weakening authorization.
- The phone may have poor internet during the workflow, but the overall system does not need to support fully offline supervisor reassignment with no backend participation at all.

## Product Direction

### Runtime Transport

- Wi-Fi is the normal runtime transport for the device.
- BLE is a provisioning and recovery transport, not the main operational transport.

BLE remains responsible for:

- first enrollment
- Wi-Fi provisioning or recovery
- decommission
- re-enrollment to a new institution
- local fallback when the runtime Wi-Fi path is not available

Wi-Fi remains responsible for:

- normal device operation
- regular backend sync
- primary production telemetry and command flows

### Internet Dependence

- The ESP32 does not need direct internet during decommission or re-enrollment.
- The phone is the control-plane client and should obtain authorization from the backend before performing sensitive local actions.
- If connectivity degrades after the app already fetched authorization, the app should still be able to complete the local device action and reconcile backend state afterward.

This is the intended control flow:

```text
online prepare
  -> app fetches short-lived action ticket
  -> local BLE execution against ESP32
  -> backend reconciliation now or later
```

## Security Model

### Core Principle

Move expensive authorization verification off the ESP32 without removing authorization.

### Backend

The backend remains the source of truth for:

- who may enroll a device
- who may connect to a device
- who may decommission a device
- which institution a device belongs to

The backend should issue short-lived, action-specific, device-bound tickets for sensitive operations.

### Device Authorization Tickets

Each ticket should be bound to:

- `deviceId`
- `institutionId` when relevant
- `action`
- `issuedAt`
- `expiresAt`
- `counter` or `nonce`
- optional operator metadata for audit correlation

The ticket payload should be authenticated with a MAC/HMAC derived from a unique per-device secret.

### ESP32 Verification

The ESP32 should verify:

- ticket MAC
- `deviceId`
- `institutionId` when applicable
- requested action
- expiry window
- replay state via counter or nonce tracking in NVS

The ESP32 should no longer perform full ES256/JWT-style public-key verification for routine local transport actions.

### Hardening Requirements

- unique secret per device
- no shared global device-control secret
- short ticket TTL
- replay protection persisted in NVS
- separate scopes for `enroll`, `connect`, `decommission`, and `reassign`
- server-side rate limiting and audit logging
- decommission wipes all institution-bound state

## Device Lifecycle

The intended lifecycle is:

```text
blank
  -> enroll
  -> enrolled
  -> normal Wi-Fi runtime
  -> decommission
  -> blank
  -> re-enroll to same or different institution
```

### State Wiped During Decommission

- institution ID
- handshake or institution secret
- Wi-Fi credentials
- action-ticket replay state tied to institutional control
- local assignment or authorization state derived from the institution

### State Retained Across Decommission

- device identity
- device hardware secret
- firmware
- manufacturing identity and immutable hardware metadata

## Firmware Profiles

Separate firmware profiles are intended to reduce shipped feature weight, not to remove field re-enrollment capability.

### Factory Profile

Used only during manufacturing or bench diagnostics.

May include:

- verbose serial diagnostics
- factory test endpoints
- provisioning helpers
- hardware validation flows

### Production Profile

The field firmware image.

Must include:

- normal runtime logic
- Wi-Fi operation
- minimal BLE recovery and provisioning path
- decommission
- re-enrollment

This profile must not carry factory-only diagnostics or test-only transport helpers.

### Optional Rescue Profile

Reserved for USB-only service recovery if needed later.

This is not the primary path and is not required for routine institution reassignment.

## Modularization Strategy

Modularization is required for maintainability and for compile-time exclusion of unused features.

It is not expected to significantly reduce flash by itself.

The firmware should be split into modules with clear boundaries such as:

- `auth`
- `provisioning`
- `ble_recovery`
- `wifi_runtime`
- `device_state`
- `sensors`
- `factory_diagnostics`

Profiles should include or exclude modules at build time rather than relying on one monolithic image.

## App Responsibilities

The app should:

- authenticate the operator with backend
- fetch short-lived action tickets while online
- cache tickets briefly for local execution
- execute sensitive local actions over BLE
- queue backend reconciliation if connectivity is weak after local success
- surface exact failure stage to the operator

The app should not be the ultimate source of authorization. It only carries backend-issued authorization to the device.

## Backend Responsibilities

The backend should:

- issue per-device action tickets
- maintain device ownership and institution assignment
- record audit events for enroll, decommission, and reassignment
- support post-action reconciliation from the app
- reject stale or unauthorized ticket requests

## Migration Direction

The recommended migration path is:

1. Keep the current BLE-plus-Wi-Fi user flow functioning.
2. Replace on-device ES256 verification with per-device action tickets.
3. Reduce BLE in production firmware to provisioning and recovery responsibilities only.
4. Move normal production communication to Wi-Fi.
5. Split factory-only logic out of the production firmware profile.
6. Migrate the BLE stack to NimBLE if BLE remains on the classic ESP32 target.

## Non-Goals

- fully offline institution reassignment with no backend participation
- shipping separate firmware per institution
- requiring USB reflashing for routine decommission or re-enrollment
- weakening device security to solve flash constraints

## Recommendation

Adopt a Wi-Fi-first production architecture with BLE limited to provisioning and recovery, and replace heavy on-device public-key grant verification with short-lived backend-issued action tickets authenticated by a per-device secret plus replay protection.
