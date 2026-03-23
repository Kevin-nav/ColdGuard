# SH1106 OLED Two-Touch UI Design

**Date:** 2026-03-23

## Goal

Migrate the ESP32 transport harness device UI from the current 16x2 I2C LCD to a 1.3" SH1106 I2C OLED while keeping the existing two-touch interaction model, runtime status behavior, confirmation flow, and Serial observability.

## Scope

This applies to the on-device firmware UI in:

- `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- `firmware/esp32_transport_harness/src/device_ui.*`
- `firmware/esp32_transport_harness/README.md`

This does not change:

- the BLE recovery protocol
- the Wi-Fi transport contract
- the two-touch interaction model
- the runtime phase model introduced for responsiveness

## Hardware Assumptions

Confirmed hardware and working initialization:

- 1.3" I2C OLED
- SH1106 driver
- `U8g2` works on the target board
- I2C wiring uses `Wire.begin(21, 22)`
- the device keeps the current two-touch inputs
- the built-in LED remains on `GPIO 2`

Confirmed working example:

- `U8G2_SH1106_128X64_NONAME_F_HW_I2C`

## Product Decision

Approved direction:

- keep the current two-touch UI behavior
- keep the current `home/menu/detail/confirm` state machine
- replace only the display layer first
- use the OLED space to improve readability, selection clarity, and screen hierarchy

This is intentionally a renderer/layout migration, not another interaction redesign.

## Architecture Options

### Option 1: Replace only the renderer

Keep the current state machine and input model, and swap the LCD rendering for OLED rendering.

Advantages:

- lowest risk
- fastest to verify on hardware
- preserves the UX changes already implemented

Disadvantages:

- visual improvements are bounded by the current screen model

### Option 2: Moderate OLED redesign

Keep two-touch behavior, but redesign more of the screen composition around the 128x64 layout.

Advantages:

- better use of the OLED
- stronger menu and detail clarity

Disadvantages:

- more code churn
- more tuning on hardware

### Option 3: Full OLED-native rewrite

Rebuild the UI around richer navigation and denser presentation.

Advantages:

- maximum visual upside

Disadvantages:

- unnecessary risk right now
- would reopen already-settled interaction behavior

## Recommendation

Adopt Option 1 with a light amount of Option 2 polish.

The device already has a better touch flow and runtime state model. The best next step is to replace the renderer and use the OLED to make the current behavior legible and intentional, without reopening control semantics.

## Screen Structure

The OLED should use four consistent visual zones:

- header
- body
- selection/highlight region when applicable
- footer hint

### Home

Purpose:

- remain clean and readable at a glance
- surface the current runtime state clearly

Layout:

- header: device nickname or device ID
- body primary line: enrollment or runtime state
- body secondary line: transport or runtime transition
- footer: concise menu hint when space allows

### Menu

Purpose:

- make selection visually obvious

Layout:

- header: `Menu`
- body: 3-4 visible rows
- selected row uses an inverted highlight bar or filled rectangle
- non-selected rows use plain text
- footer: small hint for nav/select behavior

### Detail

Purpose:

- present status, pairing, Wi-Fi tools, and diagnostics clearly

Layout:

- header: detail section title
- body: one or two larger value groups
- optional divider line
- footer: page hint or available action hint

### Confirm

Purpose:

- make destructive or stateful actions unambiguous

Required actions:

- `New enrollment`
- `Clear Wi-Fi`
- `Factory reset`

Layout:

- centered action prompt
- smaller warning text or next-step text
- footer hint such as `Tap no  Hold yes`

## Rendering Rules

The OLED should improve clarity through hierarchy, not visual clutter.

Recommended rules:

- use an obvious title font for headers
- use a readable body font for values and hints
- use inverted highlight bars for menu selection
- use spacing and alignment instead of excessive border boxes
- keep the home screen visually lighter than menu and confirm screens
- keep frame diffing so the display does not redraw unchanged content

## Firmware Structure

Keep the current architecture and change the renderer implementation.

### Input Layer

- unchanged
- continues to emit the current semantic nav/select events

### UI State Machine

- unchanged
- continues to own `home/menu/detail/confirm`
- continues to own confirmations and runtime phase presentation

### OLED Renderer

- new `U8g2`-based draw path
- responsible for layout composition, fonts, highlight rendering, and framebuffer submission
- should only send the buffer when the visible frame changes

## Library and Initialization

The device UI should switch from `LiquidCrystal_I2C` to `U8g2`.

Recommended driver:

- `U8G2_SH1106_128X64_NONAME_F_HW_I2C`

Recommended initialization:

- call `Wire.begin(21, 22)`
- initialize the display in `initializeDeviceUi(...)`
- preserve the existing boot calibration and UI-ready behavior

## Serial Logging

Serial remains part of the UI contract.

The OLED migration should preserve the current structured `[UI]` logging families:

- `[UI] Screen -> ...`
- `[UI] Input -> ...`
- `[UI] Selection -> ...`
- `[UI] Confirm -> ...`
- `[UI] Runtime -> ...`

The migration should not remove or weaken the current Serial observability.

## Testing Strategy

Primary verification will be on hardware.

Bench checks:

1. boot and verify the SH1106 OLED initializes correctly over I2C
2. verify the current two-touch controls still navigate and confirm correctly
3. verify the menu highlight is visually obvious
4. verify detail pages are more readable than the current LCD version
5. verify confirm screens are clear and centered
6. verify runtime transitions remain visible on the OLED
7. verify unchanged frames do not visibly flicker
8. verify Serial logs still match visible on-device behavior

## Risks

- SH1106 modules vary slightly in offset behavior across libraries and clones
- font choice can make the OLED feel either clean or crowded
- `U8g2` framebuffer rendering may need careful diffing to avoid unnecessary `sendBuffer()` churn
- copy written for the 16x2 LCD may look awkward unless it is retuned for the OLED layout

## Recommendation Summary

Keep the current two-touch behavior and UI state machine, replace the LCD renderer with a `U8g2` SH1106 OLED renderer, and use the larger screen to improve visual hierarchy, selection clarity, and confirmation readability without reopening the underlying firmware interaction model.
