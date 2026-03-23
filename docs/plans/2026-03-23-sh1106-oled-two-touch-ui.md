# SH1106 OLED Two-Touch UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the transport harness 16x2 LCD renderer with a SH1106 `128x64` OLED renderer while preserving the current two-touch interaction model, confirmations, runtime state feedback, and Serial observability.

**Architecture:** Keep the current input handling and UI state machine intact, and move the display implementation in `device_ui.*` from `LiquidCrystal_I2C` line-based output to `U8g2` frame-based rendering. Update screen copy and layout only as needed to fit the OLED, and keep frame diffing so the display stays visually stable.

**Tech Stack:** Arduino ESP32 firmware, `U8g2`, `Wire`, SH1106 I2C OLED, existing two-touch device UI state machine, bench validation over Serial

---

### Task 1: Replace the display dependency and configuration assumptions

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_ui.h`
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`

**Step 1: Update display configuration fields**

Adjust `DeviceUiConfig` so it no longer encodes 16x2 LCD-specific assumptions unless a field is still genuinely needed.

Keep:

- touch pins
- LED pin
- firmware/protocol config

Add only what the OLED renderer actually needs.

**Step 2: Replace the display library usage**

Remove `LiquidCrystal_I2C` usage in `device_ui.cpp` and replace it with the `U8g2` SH1106 display object.

Target driver:

- `U8G2_SH1106_128X64_NONAME_F_HW_I2C`

**Step 3: Initialize I2C with the working OLED pins**

Use the confirmed wiring:

- `Wire.begin(21, 22)`

Make sure this is only done in one place so I2C ownership stays clear.

**Step 4: Verify the firmware still boots into the UI path**

Bench-check:

- OLED powers on
- boot calibration logs still print
- no regression in UI initialization

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp firmware/esp32_transport_harness/src/device_ui.h firmware/esp32_transport_harness/esp32_transport_harness.ino
git commit -m "feat: switch device ui to sh1106 oled"
```

### Task 2: Replace line-based rendering with OLED frame composition

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Introduce a render model for the current screen**

Create a small internal frame-description model or helper flow that turns the current UI state into:

- header text
- body rows
- selected row index when applicable
- footer hint

Do not rewrite the UI state machine.

**Step 2: Build a frame renderer**

Use `U8g2` drawing operations to render:

- home
- menu
- detail
- confirm

Use:

- text alignment
- section spacing
- inverted selection highlight for menu rows

**Step 3: Preserve the current screen semantics**

Ensure the existing behavior still maps through:

- runtime/home state
- menu selection
- detail paging
- confirm screens
- transient status notices

**Step 4: Bench-check basic rendering**

Verify:

- text is legible
- selected menu row is obvious
- confirm screen is clearer than the old LCD version

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: render device ui screens on oled"
```

### Task 3: Tune fonts, spacing, and copy for the OLED

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Choose the font set**

Use one larger font for headers and one smaller font for body/hints. Keep the selection readable from a short distance.

**Step 2: Retune screen copy**

Retain the meaning of the current messages, but shorten or expand text where needed so the OLED looks intentional rather than reusing LCD-era phrasing blindly.

Focus on:

- home status wording
- runtime transition wording
- confirm prompts
- footer hints

**Step 3: Keep the home screen visually light**

Do not let the extra space turn the home screen into a cluttered dashboard.

**Step 4: Bench-check readability**

Verify:

- home is easy to parse
- menu rows fit cleanly
- detail screens do not feel cramped
- confirm prompts are unmistakable

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: tune oled ui typography and copy"
```

### Task 4: Preserve render diffing and reduce OLED buffer churn

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Adapt the current frame cache**

Keep the no-redraw behavior introduced for the LCD, but make it work with the OLED frame model.

Only call `sendBuffer()` when the visible frame changes.

**Step 2: Make scrolling or animated states explicit**

If any text still needs scrolling, ensure the cache invalidates only when the visible frame window changes.

**Step 3: Bench-check for flicker**

Verify:

- static screens stay steady
- menu selection changes immediately
- runtime phase changes update promptly

**Step 4: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: optimize oled frame updates"
```

### Task 5: Keep Serial, LED, and OLED behavior aligned

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Confirm no UI log regressions**

Preserve the current structured `[UI]` log families.

**Step 2: Make sure OLED screens match runtime and LED semantics**

Check that:

- pending runtime phases still map to visible pending states
- error runtime phases still map to error states
- confirm actions still log accept/cancel correctly

**Step 3: Bench-check cross-channel observability**

Verify:

- OLED shows the same state change the log reports
- LED still reflects pending/error/menu state correctly

**Step 4: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "chore: align oled ui with led and serial states"
```

### Task 6: Update firmware documentation for the OLED hardware

**Files:**
- Modify: `firmware/esp32_transport_harness/README.md`

**Step 1: Replace LCD-specific hardware guidance**

Document:

- SH1106 OLED
- `U8g2`
- I2C pins `21/22`
- current two-touch controls

**Step 2: Update the bench checklist**

Include:

- OLED boot verification
- menu highlight verification
- confirm screen verification
- runtime transition visibility checks

**Step 3: Commit**

```bash
git add firmware/esp32_transport_harness/README.md
git commit -m "docs: update harness docs for oled ui"
```

### Task 7: Final bench validation and cleanup

**Files:**
- Modify: `firmware/esp32_transport_harness/README.md`

**Step 1: Run the full device validation pass**

Verify:

1. OLED initializes cleanly at boot
2. both touch inputs still calibrate and behave correctly
3. home/menu/detail/confirm screens all render correctly
4. menu selection highlight is obvious
5. runtime transitions are visible
6. Serial logs still match visible UI behavior
7. LED state signaling still matches the current UI state

**Step 2: Fix any layout or copy issues found on hardware**

Keep fixes narrow and specific to what the OLED actually shows.

**Step 3: Update docs if behavior differs from the draft wording**

Ensure the README matches what the flashed device really does.

**Step 4: Commit**

```bash
git add firmware/esp32_transport_harness/README.md
git commit -m "chore: finalize oled ui validation notes"
```
