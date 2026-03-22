# Capacitive Touch and Built-In LED UI Design

**Date:** 2026-03-22

## Goal

Replace the current physical push-button menu control in the ESP32 transport harness with capacitive touch input, add continuous built-in LED mode signaling with event overlays, and ensure significant device-side UI actions are emitted to Serial for debugging.

## Scope

This change applies to the local device UI layer in the ESP32 transport harness:

- replace `GPIO` button reads with `touchRead(T0)`-driven short/long press detection
- use the ESP32 built-in LED on `GPIO 2` for continuous mode feedback
- keep the existing LCD menu structure and menu actions
- add consistent Serial logging for meaningful menu-driven actions and mode transitions

This does not change the app-side transport policy, BLE protocol shape, or Wi-Fi priority rules.

## Hardware Assumptions

- capacitive touch input uses `T0`
- built-in LED uses `GPIO 2`
- LCD remains the existing I2C `16x2` display at `0x27`

## Input Model

The capacitive touch control should preserve the current interaction model:

- short press:
  - advance to the next menu item when in menu mode
  - advance to the next detail page when in a detail screen
- long press:
  - open the menu from runtime mode
  - select the current menu item from the menu
  - perform the special clear action from `WiFi tools`

Touch detection should:

- calibrate a baseline on boot using `touchRead(T0)`
- derive a threshold from that baseline
- debounce transitions
- classify presses as short or long using the same general semantics as the user’s proven sketch

## LED Model

The built-in LED should continuously indicate the current device mode, with brief event overlays for important actions.

Recommended continuous patterns:

- runtime normal: slow heartbeat
- menu open: solid on
- enrollment ready: repeating double pulse
- pending/recovery activity: faster pulse
- error present: repeating triple blink

Recommended event overlays:

- new enrollment generated
- facility Wi-Fi cleared
- factory reset
- critical BLE or runtime error recorded

Overlay patterns should run briefly, then automatically return to the continuous mode pattern.

## Serial Logging

The device UI should emit clear Serial logs for significant UI-driven events.

Always log:

- menu opened
- menu selection executed
- new enrollment generated
- new bootstrap token
- full enrollment link
- pairing code viewed
- facility Wi-Fi cleared
- factory reset
- major mode transitions

This is explicitly to support debugging when the LCD or LED behavior is not enough by itself.

## Firmware Structure

The existing `device_ui.*` module should remain the center of this behavior.

Planned structure:

- `DeviceUiConfig` grows to describe touch input and built-in LED pins plus touch timing/threshold tuning
- button polling state is replaced with capacitive touch state
- LED behavior is updated from mode state inside the same UI tick loop
- helper functions are added for:
  - touch calibration and sampling
  - press classification
  - LED mode rendering
  - event overlay scheduling
  - serial event logging

The menu content itself stays unchanged unless required for clarity.

## Significant Behavior Changes

### Enrollment

Selecting `New enrollment` should:

- generate a fresh bootstrap token
- persist it
- mark the device as enrollment-ready
- refresh BLE advertising
- show the result on the LCD
- print the fresh bootstrap token and enrollment link to Serial every time

### Diagnostics and Debugging

If the UI causes a meaningful device state change, that action should be visible in all three places:

- LCD
- Serial
- LED mode or event pattern

This is the central observability rule for the harness.

## Testing Strategy

Primary verification will be bench validation because the environment does not currently provide local ESP32 build tooling.

Bench checks:

1. boot device and confirm touch threshold is printed
2. verify short and long touch presses map to the intended menu actions
3. verify built-in LED reflects runtime, menu, enrollment-ready, and error states
4. generate a new enrollment token and confirm:
   - LCD shows enrollment-ready state
   - Serial prints token and full link
   - BLE hello reports `enrollmentReady=true`
5. clear facility Wi-Fi from the menu and confirm LCD/Serial/LED feedback
6. factory reset and confirm blank-state behavior returns

## Risks

- capacitive touch thresholds can drift by board and environment
- continuous LED patterns must not block the main loop
- Serial logging must stay concise enough for debugging without flooding output
- built-in LED polarity can differ by board variant, so the implementation should isolate LED on/off semantics

## Recommendation

Implement the touch and LED behavior entirely inside `device_ui.*`, keep the menu structure stable, and treat Serial logging as part of the user-visible debugging contract rather than a best-effort side effect.
