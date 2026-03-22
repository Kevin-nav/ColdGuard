# Device-Side Enrollment Menu Design

**Date:** 2026-03-21

## Goal

Add a device-side control surface for ColdGuard so pairing and recovery are driven by explicit hardware state instead of hidden bootstrap state. This should support current debugging with an I2C LCD and evolve cleanly toward the production OLED/menu workflow.

## Current Problem

The current pairing path is too opaque:

- the app can attempt enrollment when the device is not clearly in an enrollment-ready state
- blank-state bootstrap tokens can drift from what the user scanned or saved
- after resets or retries, it is hard to tell whether the device is ready for a new enrollment
- debugging depends too heavily on serial logs instead of user-visible device state

This makes pairing fragile and slows down iteration.

## Product Decision

Approved behavior:

- the device gets a physical input with long-press behavior
- the device exposes an on-device menu
- `New enrollment` generates a fresh token
- that token persists across reboot until enrollment succeeds or the operator explicitly replaces or clears it
- the display becomes the authoritative local UI for pairing/debug state

## Architecture Options

### Option 1: Minimal button-only enrollment trigger

Long-press enters pairing mode with no real menu.

Advantages:

- quickest to build
- low UI complexity

Disadvantages:

- poor discoverability
- weak debugging value
- does not scale to production service workflows

### Option 2: Small pairing submenu only

Add a minimal menu just for enrollment and reset tasks.

Advantages:

- better than pure button-only flow
- limited firmware/UI complexity

Disadvantages:

- still grows into a second redesign later
- weak fit for production diagnostics and service actions

### Option 3: Full device-side menu

Build the real interaction model now with a menu that supports enrollment, device info, Wi-Fi tools, diagnostics, and reset actions.

Advantages:

- best match for production
- reusable code path for later OLED
- explicit, debuggable device state
- supports field service and QA

Disadvantages:

- more up-front firmware work
- requires a simple input/state-machine framework

## Recommendation

Adopt Option 3 now, but implement it in a modular way so the display driver can later swap from I2C LCD to OLED without rewriting the menu state machine.

## Approved Design

### 1. Device Interaction Model

The device has one local operator surface:

- a hardware button or toggle-style input with short-press and long-press semantics
- an LCD screen for current development

The firmware owns a simple UI state machine with:

- idle runtime screen
- menu screen
- enrollment-ready screen
- diagnostics screens
- confirmation screens for destructive actions

The app must not assume the device is pairable unless the device has explicitly entered the proper enrollment state.

### 2. Menu Structure

Recommended initial menu:

- `Status`
- `New enrollment`
- `Show pairing code`
- `Wi-Fi tools`
- `Diagnostics`
- `Factory reset`

Suggested submenu contents:

- `Wi-Fi tools`
  - show current facility SSID
  - clear facility Wi-Fi
  - view SoftAP status
- `Diagnostics`
  - device ID
  - enrollment state
  - transport state
  - last error code
  - firmware version

### 3. Enrollment State Model

Pairing should become an explicit state, not an accidental side effect of being blank.

Proposed state model:

- `blank`
  - no active enrollment token prepared yet
- `enrollment_ready`
  - fresh token generated and persisted
  - user can pair with the app
- `pending`
  - enrollment has begun but not committed
- `enrolled`
  - device is provisioned and operating normally

Key rule:

- selecting `New enrollment` generates a fresh token and moves the device into `enrollment_ready`

### 4. Enrollment Token Lifecycle

Approved token behavior:

- `New enrollment` always generates a fresh token
- that token is saved to flash immediately
- the token survives reboot
- the token remains valid until:
  - enrollment succeeds
  - the operator selects `New enrollment` again
  - the operator clears the enrollment state

This gives you repeatable retry behavior while still matching production persistence expectations.

### 5. Pairing UX

Pairing should be driven by what the device is actually showing.

Recommended device screen content during enrollment:

- device ID
- enrollment-ready label
- fresh pairing/enrollment code
- optional time or generation counter

The app should eventually require this state before allowing enrollment to start. If the device is not in `enrollment_ready`, the app should show a plain-English message instead of attempting blind pairing.

### 6. Display Abstraction

Because the current development display is an I2C LCD and the target production display is OLED, the firmware should separate:

- display rendering interface
- menu/navigation state machine
- device state provider

That way:

- LCD is the first renderer
- OLED becomes a renderer swap later
- menu behavior remains stable

### 7. Input Model

Recommended minimum input behavior:

- short press:
  - advance menu selection
  - acknowledge status pages
- long press:
  - open menu from idle
  - confirm menu actions when already inside the menu

If more buttons are added later, the menu controller can expand without changing the enrollment state model.

### 8. Diagnostics Value

This menu is not only for users. It is a debugging and QA asset.

The diagnostics screens should expose:

- device ID
- current enrollment state
- whether a pairing token exists
- whether SoftAP is up
- whether facility Wi-Fi is connected
- current active transport
- last failure/error code
- firmware version

This directly reduces dependence on serial logs during testing.

### 9. Relationship To App UI

The app should complement the device UI, not replace it.

App-side error handling should:

- show plain-English transport and pairing failures
- allow copying the raw developer error code for debugging
- reflect when the device is not in an enrollment-ready state

This keeps the user experience clean while still helping developers debug real transport failures.

## Testing And Verification

Required validation:

- enter menu via long press
- generate new enrollment token
- reboot device and confirm token persists
- enroll successfully using the shown code
- generate another token after clearing/resetting enrollment
- verify diagnostics reflect real runtime state

## Result

This design makes pairing explicit, testable, and production-oriented. It replaces hidden bootstrap behavior with a visible device-controlled workflow that will scale from current LCD debugging to production OLED hardware.
