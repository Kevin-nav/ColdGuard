# Nurse/Technician OLED UI Design

**Date:** 2026-03-28

## Goal

Redesign the ESP32 transport harness OLED UI so it feels professional for nurses and technicians, guides pairing and recovery clearly, surfaces real pairing progress and outcomes, and supports full device decommissioning back to a blank state for re-pairing.

## Scope

This applies to the on-device firmware UI in:

- `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- `firmware/esp32_transport_harness/src/device_ui.*`
- `firmware/esp32_transport_harness/src/device_state.*`
- `firmware/esp32_transport_harness/src/ble_recovery.*`
- `firmware/esp32_transport_harness/README.md`

This includes:

- simpler nurse/technician-facing OLED copy
- dedicated pairing progress, success, and failure screens
- a clearer menu structure
- full unpair/decommission flow back to blank state
- preserving the existing accepted pairing link formats

This does not change:

- the accepted pairing entry formats
- the Wi-Fi runtime contract and local `http://` SoftAP/runtime handoff semantics
- the two-touch interaction model
- the BLE enrollment security model itself

## Accepted Pairing Links

The app currently accepts exactly two pairing entry formats:

- `https://coldguard.org/device/<deviceId>?claim=<bootstrapToken>&v=1`
- `coldguard://device/<deviceId>?claim=<bootstrapToken>&v=1`

The local SoftAP/runtime URL such as `http://192.168.4.1/api/v1/connection-test` remains a post-pairing/runtime handoff URL only. It is actively used after BLE handoff and Wi-Fi setup, but it is not a valid pairing QR, pairing entry format, or alternate enrollment URL.

## Product Decision

Approved direction:

- target nurses and technicians, not developers
- prefer task-first copy and guided next actions over status dumps
- show real pairing workflow progress on-screen
- show distinct pairing success and failure screens
- support `Unpair device` as a full decommission back to blank state
- require issuing a fresh token to re-pair after unpair/decommission

## Architecture Options

### Option 1: Task-first workflow UI

Use the OLED as a guided device console:

- home screen shows the current high-level state and next action
- pairing gets dedicated in-progress and outcome screens
- menu contains short action-oriented labels
- technical detail is pushed behind a lighter support/status screen

Advantages:

- best fit for a 128x64 OLED
- least developer-heavy
- easiest for repeat clinical workflows
- creates a clean place for pairing animations

Disadvantages:

- requires adding explicit UI-facing workflow states
- needs some BLE recovery hooks so progress screens reflect real events

### Option 2: Compact dashboard UI

Keep several technical states visible at once on the home screen:

- pairing state
- Wi-Fi state
- device name/id
- alerts

Advantages:

- more information at a glance
- closer to a support dashboard

Disadvantages:

- easy to become dense and developer-heavy again
- weaker emphasis on next action

### Option 3: Wizard-first flow

Convert most actions into deeper guided flows with multiple transition screens.

Advantages:

- safest operator guidance
- clearest sequencing for first-time users

Disadvantages:

- slower for repeated technician use
- more state and navigation complexity than needed

## Recommendation

Adopt Option 1.

The OLED should behave like a professional guided device console. The home screen should tell the technician what state the device is in and what happens next. Pairing should become a real visible workflow, not a hidden protocol event with only a token page and Serial logs.

## Screen Model

The OLED should keep the existing two-touch interaction model, but the visible screen set should shift toward task-first communication.

### Home

The home screen should show:

- a compact top label with nickname or device identity
- one large status headline
- one short explanation or next action
- a minimal footer hint

Primary home states:

- `Ready to pair`
- `Scan to pair`
- `Pairing in progress`
- `Device paired`
- `Wi-Fi setup needed`
- `Wi-Fi issue`
- `Attention needed`

### Menu

The menu should become short and action-oriented:

- `Pair new device`
- `Show pairing code`
- `Wi-Fi setup`
- `Device status`
- `Unpair device`
- `Back`

This replaces developer-heavy labels such as `New enrollment`, `Diagnostics`, and the normal-user use of `Factory reset`.

### Pairing Screens

Pairing should have dedicated transient and steady-state screens:

- token issued / ready to scan
- waiting for phone
- verifying secure pairing
- saving setup
- pairing complete
- pairing failed

These screens should reflect real workflow steps from the firmware, not a fake timer.

### Status Screen

Keep a lighter support/status screen for bench and support work, but it should be secondary:

- enrolled/blank/ready
- Wi-Fi connected or retrying
- BLE name
- last error if present

It should not be the main experience.

### Unpair / Decommission

`Unpair device` should be the approved reset path.

Behavior:

- confirm with clear destructive wording
- perform full decommission back to blank state
- erase current pairing state
- require issuing a fresh pairing token before re-pairing
- land on a blank/ready state when complete

## Visual Direction

The OLED should feel like a small clinical device console rather than a developer dashboard.

Rules:

- prefer fewer words and larger text
- avoid raw protocol/runtime labels like `softap`, `grant`, `pending`, `runtime`
- keep sentence-style wording
- reserve all-caps only for rare badges or alert emphasis
- use whitespace and stronger hierarchy instead of filling every area with text

Visual hierarchy:

- centered emphasis for home, pairing progress, success, and failure
- clear inverted highlight bars for menu selection
- confirm screens should look distinct and deliberate
- support/status screens can remain more utilitarian, but still not developer-heavy

## Motion And Animation

Animation should be simple, readable, and tied to real device state.

Recommended motion patterns:

- token issued: subtle pulse or blink around the `Scan to pair` state
- waiting for phone: animated dots or scan pulse
- secure verification: left-to-right sweep or short progress bar movement
- saving/finalizing: segmented fill or loading steps
- success: brief checkmark pulse or boxed confirmation flash
- failure: warning icon pulse or brief inversion effect

These should be deliberate state cues, not decorative effects.

## Firmware State Model

To support a better UI, the firmware needs a UI-facing workflow state instead of relying only on coarse flags such as `enrollmentReady` and `pendingEnrollment.active`.

Recommended UI workflow states:

- `blank_idle`
- `token_ready`
- `waiting_for_phone`
- `secure_verification`
- `saving_enrollment`
- `pairing_success`
- `pairing_failed`
- `paired_idle`
- `wifi_setup`
- `wifi_retry`
- `wifi_failed`
- `decommission_confirm`
- `decommissioning`
- `decommission_success`

This can be stored as lightweight UI state and transient metadata. The purpose is to let the OLED reflect actual workflow progress and show reliable success/failure outcomes.

## BLE Recovery Integration

The BLE recovery flow should expose or trigger UI-relevant transitions around:

- `enroll.begin` received
- handshake proof validated
- action ticket validated
- pending enrollment staged
- `enroll.commit` started
- enrolled state saved
- decommission started
- decommission complete
- enrollment/decommission failure

Without these hooks, the OLED cannot present real pairing progress accurately.

## Interaction Model

Keep the existing two-touch semantics:

- nav tap: move through menu rows or status pages
- nav hold: back/home
- select tap: open/activate
- select hold: confirm destructive actions

The redesign is visual and workflow-oriented, not a control rewrite.

## Testing Strategy

Bench validation should prove the new OLED behavior is both readable and truthful.

Required checks:

1. blank device boots to a clean `Ready to pair` state
2. `Pair new device` issues a fresh token and lands on `Scan to pair`
3. the OLED advances through real pairing-progress states when a phone begins enrollment
4. pairing success shows a distinct success screen before settling into `Device paired`
5. pairing failure shows a clear cause and recovery guidance
6. `Unpair device` returns the device to blank state and requires a new token to re-pair
7. Wi-Fi setup/retry/failure wording is understandable without developer context
8. touch navigation still behaves reliably with the new screen flow
9. Serial `[UI]` logs still map cleanly to visible state transitions

## Risks

- pairing progress can look misleading if the OLED state machine is not driven by real BLE recovery transitions
- copy can regress into a support console unless wording is aggressively simplified
- transient success/failure screens need careful timing so they are noticeable but not disruptive
- decommission and new-token issuance must remain clearly separated so staff do not assume old codes still work

## Recommendation Summary

Rework the ESP32 OLED into a task-first nurse/technician UI with real pairing progress screens, distinct outcome states, an action-oriented menu, and a full `Unpair device` decommission path back to blank state. Keep pairing entry limited to the current `https://coldguard.org/device/...` and `coldguard://device/...` formats, while leaving the local `http://` runtime URL in its current post-pairing handoff role.
