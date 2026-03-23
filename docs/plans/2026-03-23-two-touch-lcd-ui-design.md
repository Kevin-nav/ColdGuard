# Two-Touch LCD UI Design

**Date:** 2026-03-23

## Goal

Improve the ESP32 transport harness device UX by replacing the single-touch interaction model with a two-touch capacitive UI, making LCD selection and confirmation states clearer, and keeping the LCD, LED, and Serial feedback responsive while the device moves through runtime, enrollment, Wi-Fi, and recovery modes.

## Scope

This design applies to the local firmware UI in:

- `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- `firmware/esp32_transport_harness/src/device_ui.*`
- `firmware/esp32_transport_harness/src/wifi_runtime.*`

This does not change the BLE protocol contract, backend action-ticket format, or app-side transport policy.

## Product Priorities

Priority order for this work:

1. clearer on-screen selection and feedback
2. more responsive touch interaction
3. better UI responsiveness while the ESP32 changes modes or performs longer operations

## Hardware Direction

The device should move from one capacitive input to two capacitive inputs.

- keep the built-in LED on `GPIO 2`
- keep the LCD on I2C address `0x27`
- keep the existing touch input on `T0`
- add a second ESP32 touch-capable pin for a dedicated action input

The second input should not reuse `GPIO 2` because that would collide with the built-in LED mode signaling already used by the harness.

## Recommended Interaction Model

Use a two-touch model with distinct navigation and action roles.

- `Touch A`: navigate
- `Touch B`: select or confirm
- `Hold A`: return home or back out of a detail flow
- `Hold B`: open the menu from the home screen, or confirm a destructive action from a confirmation screen

This is preferred over dedicating the second touch to `Back` because the main UX problem is ambiguous selection and activation, not lack of a way out.

## Architecture Options

### Option 1: Keep the current state machine and polish it

Preserve the current screen list and add clearer rendering, confirmations, and responsiveness improvements.

Advantages:

- low risk
- smallest code movement

Disadvantages:

- keeps the current ad hoc screen model
- makes it harder to keep behavior consistent across screens

### Option 2: Build a unified cursor-based UI shell

Treat nearly every interactive screen as part of one consistent navigation shell with shared layout, selection, confirmation, and back behavior.

Advantages:

- best selection clarity
- consistent screen behavior
- easier to connect responsiveness fixes to a single UI model

Disadvantages:

- moderate refactor work

### Option 3: Build a guided task-flow UI

Reframe the device UI into step-by-step flows for pairing, Wi-Fi, and service actions.

Advantages:

- very explicit for operators

Disadvantages:

- too heavy for a 16x2 LCD
- adds more transitions and text pressure than the current hardware supports well

## Recommendation

Adopt Option 2.

The 16x2 LCD is too constrained for a flow-heavy experience, and polishing the existing single-touch model will still leave the firmware with inconsistent activation and confirmation patterns. A unified two-touch shell is the cleanest way to improve selection clarity and mode responsiveness without rewriting the whole firmware.

## Screen Model

The UI should standardize on four screen types.

### Home

Purpose:

- show a compact runtime snapshot
- remain readable when idle
- advertise the menu entry point

Behavior:

- line 1 shows device nickname or ID
- line 2 shows condensed device state and a short action hint when space permits

Example style:

- `ColdGuard West`
- `ready facility`

### Menu List

Purpose:

- show current selection clearly
- make navigation feel stable and intentional

Behavior:

- top line shows current selected item with a clear marker
- bottom line previews the next item or shows a concise hint

Example style:

- `> New enroll`
- `  Pair code`

### Detail View

Purpose:

- present status, diagnostics, Wi-Fi tools, and pairing details

Behavior:

- navigation touch cycles subpages or rows
- action touch opens an available action or confirm screen
- hold navigation returns to home or parent menu

### Confirm View

Purpose:

- prevent accidental destructive or stateful actions

Required uses:

- `New enrollment`
- `Clear Wi-Fi`
- `Factory reset`

Behavior:

- line 1 names the action
- line 2 explains the choice using concise prompts

Example style:

- `Clear WiFi?`
- `Tap N / Hold Y`

## Rendering Rules

The LCD should feel steady rather than busy.

- avoid full-screen transient takeovers unless the message is critical
- prefer contextual confirmation text that returns to the prior screen
- redraw only when visible content changes or when a scroll step advances
- keep the current selection marker stable across menu interactions
- keep runtime screens cleaner than menu and confirm screens

## Input Model

The input layer should emit semantic events instead of directly mutating UI state.

Suggested event set:

- `NavTap`
- `NavHold`
- `SelectTap`
- `SelectHold`

The UI state machine should translate those events into screen changes, selection moves, confirm acceptance, or back navigation.

## Responsiveness Requirements

The UI must remain responsive while the device changes operating modes.

Required changes:

- calibrate both touch inputs independently at boot
- support per-input debounce and hold timing
- separate touch sampling from LCD rendering
- avoid rewriting both LCD rows every loop
- represent in-progress operations with a visible busy state instead of freezing the UI
- reduce or remove blocking waits during longer Wi-Fi operations so LED and LCD updates continue

## Firmware Structure

Keep `device_ui.*` as the module boundary, but separate it internally into three responsibilities.

### Input Layer

- sample both touch pins
- manage calibration and thresholding
- manage debounce and hold detection
- emit high-level input events

### UI State Machine

- own screen state, selection index, detail page, confirmation target, and timeouts
- map input events to transitions
- expose a render model rather than writing directly to the LCD

### Renderer

- turn the current UI state into LCD rows and LED mode
- minimize redraws
- preserve smoothness while the main loop continues to service runtime work

## LED Model

Keep the LED as a continuous mode signal with event overlays.

The LED remains important because:

- it gives feedback when the LCD is not being watched directly
- it helps distinguish runtime, menu, pending, and error states
- it should continue updating during long operations

The new two-touch model should not take over the LED pin.

## Serial Logging Contract

Serial output remains a first-class UI feedback channel, not an incidental debug side effect.

Recommended log families:

- `[UI] Screen -> home/menu/detail/confirm`
- `[UI] Input -> nav_tap/select_tap/nav_hold/select_hold`
- `[UI] Selection -> item=<menu item>`
- `[UI] Action -> <action> started/completed`
- `[UI] Confirm -> action=<action> accepted/cancelled`
- `[UI] Mode signal -> <led mode>`
- `[UI] Runtime -> station_connecting/station_connected/softap_started/...`

Sensitive data handling:

- continue printing fresh bootstrap token and enrollment link when `New enrollment` is generated
- keep other sensitive BLE and runtime payloads redacted unless verbose secret logging is enabled

## Error Handling

The device UI should make failures visible in three places whenever practical:

- LCD
- LED
- Serial

If a mode change or operation fails, the user should see:

- a concise LCD status or confirm result
- an LED error or pending pattern
- a matching Serial event describing what failed

## Testing Strategy

Primary validation will be bench testing because the repository does not currently include a local firmware test harness for this device UI behavior.

Bench checks:

1. boot and verify both touch inputs calibrate and log thresholds
2. verify menu navigation always shows a clear selected row
3. verify runtime home remains readable and not cluttered
4. verify `New enrollment`, `Clear Wi-Fi`, and `Factory reset` require explicit confirmation
5. verify LCD and LED continue updating while Wi-Fi connection or recovery work is in progress
6. verify Serial logs align with visible on-device behavior

## Risks

- capacitive thresholds may vary by board and environment
- moving to two inputs increases calibration complexity
- keeping the loop responsive may require restructuring blocking runtime paths
- the 16x2 LCD still limits copy length, so prompts must stay concise

## Recommendation Summary

Implement a two-touch cursor-based UI shell inside `device_ui.*`, keep the LED on `GPIO 2`, preserve Serial observability, and refactor input, rendering, and mode transitions so the device feels clear and responsive across enrollment, runtime, and Wi-Fi operations.
