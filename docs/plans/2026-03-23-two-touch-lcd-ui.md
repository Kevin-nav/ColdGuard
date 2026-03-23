# Two-Touch LCD UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the ESP32 transport harness to a two-touch LCD UI with clearer selection feedback, explicit confirmations, and improved responsiveness during runtime mode changes.

**Architecture:** Keep `device_ui.*` as the main UI module, but split the implementation into input handling, UI state transitions, and render diffing. Update the main sketch and runtime helpers only where needed to support a second touch input, non-blocking status feedback, and a structured Serial UI log contract.

**Tech Stack:** Arduino ESP32 firmware, `LiquidCrystal_I2C`, ESP32 capacitive touch input, `WiFi`, `BLEAdvertising`, `Preferences`, bench validation over Serial

---

### Task 1: Expand the firmware configuration for a second touch input and explicit UI roles

**Files:**
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `firmware/esp32_transport_harness/src/device_ui.h`
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Add the new configuration fields**

Update `DeviceUiConfig` so it describes:

- navigation touch pin
- select touch pin
- per-input debounce and hold timing if you decide to tune them separately

Update the sketch constants in `esp32_transport_harness.ino` to provide:

- the existing navigation touch pin on `T0`
- one additional ESP32 touch-capable pin for selection

**Step 2: Rename the current single-touch assumptions**

Replace the single-input names in `device_ui.cpp` with role-based names such as:

- `nav`
- `select`

Remove assumptions that one touch sensor owns both browsing and activation.

**Step 3: Boot-log both sensors**

During `initializeDeviceUi`, calibrate both touch inputs and print one concise `[UI]` line per sensor with baseline and threshold values.

**Step 4: Bench-check boot behavior**

Run the firmware on hardware and verify Serial shows both touch inputs calibrating successfully.

Expected:

- two sensor calibration logs
- LCD still initializes correctly
- no regression in boot flow

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/esp32_transport_harness.ino firmware/esp32_transport_harness/src/device_ui.h firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: add two-touch UI configuration"
```

### Task 2: Replace the single-touch gesture handler with semantic input events

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Introduce a small input event model**

Add internal enums or structs for:

- `UiInputEvent`
- `NavTap`
- `NavHold`
- `SelectTap`
- `SelectHold`

Keep this internal to `device_ui.cpp` unless another module needs it.

**Step 2: Refactor touch processing**

Replace the current single `processTouch(...)` flow with:

- per-sensor sampling
- per-sensor debounce
- per-sensor hold detection
- one event dispatch path into the UI state machine

**Step 3: Preserve responsiveness**

Ensure short taps can register faster than the current one-size-fits-all behavior where `200ms` debounce and `700ms` hold handling make the UI feel sluggish.

**Step 4: Add input logs**

Emit concise `[UI] Input -> ...` logs for the semantic events, not raw touch values.

**Step 5: Bench-check input behavior**

Validate on device:

- navigation touch moves selection predictably
- select touch activates the current item
- hold navigation returns home or backs out
- hold select opens the menu from home and confirms when required

**Step 6: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: add semantic two-touch input events"
```

### Task 3: Rework the UI state machine into home, menu, detail, and confirm screens

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Define the new screen model**

Refactor the current `UiMode` usage so it supports:

- `Home`
- `Menu`
- `Detail`
- `Confirm`

Use internal detail context or action targets to distinguish status, pairing, Wi-Fi tools, diagnostics, and destructive actions.

**Step 2: Add explicit confirmation flow**

Route these actions through confirmation screens:

- `New enrollment`
- `Clear Wi-Fi`
- `Factory reset`

Acceptance should require the select hold on a dedicated confirm screen.

**Step 3: Make back behavior explicit**

Support returning from detail and confirm screens using navigation hold or timeout, rather than reopening the main menu in ad hoc ways.

**Step 4: Add selection and screen logs**

Emit logs for:

- screen transitions
- selection changes
- confirmation accepted or cancelled

**Step 5: Bench-check the screen flow**

Validate:

- home screen stays simple
- menu shows the current selected item clearly
- detail screens feel consistent
- destructive actions cannot fire without a confirm screen

**Step 6: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: unify device ui screen flow"
```

### Task 4: Add render diffing so the LCD only updates when visible content changes

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Introduce render state tracking**

Track the last rendered LCD lines and any scroll timing state needed to support long text.

**Step 2: Refactor the renderer**

Change `renderLines(...)` and related helpers so the LCD only writes:

- when a line changes
- when a scrolling string advances to a new visible window

Avoid rewriting both rows on every loop iteration.

**Step 3: Keep transient feedback contextual**

Replace full-screen transient takeovers where practical with contextual confirmations that return the user to the relevant detail or menu screen.

**Step 4: Bench-check visual behavior**

Verify:

- selection highlight feels stable
- LCD no longer appears twitchy under rapid loop activity
- long labels still scroll when needed

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: reduce lcd redraw churn"
```

### Task 5: Keep UI responsive during runtime and Wi-Fi mode changes

**Files:**
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_state.h`
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Identify blocking UI pain points**

Focus first on any path that blocks the main loop long enough to freeze LCD, LED, or touch interaction, especially the facility Wi-Fi provisioning flow.

**Step 2: Add explicit busy or transition state**

Expose enough runtime state for the UI to show:

- station connecting
- SoftAP starting
- runtime unavailable
- recent runtime error

Represent this on the LCD instead of leaving the old screen frozen.

**Step 3: Reduce blocking waits**

Refactor long Wi-Fi waits into shorter loop-friendly checks where feasible. If a fully non-blocking rewrite is too large for this pass, at minimum break the longest waits into smaller intervals that still allow visible feedback updates.

**Step 4: Align LED and Serial with transition states**

Make sure the LED mode and `[UI] Runtime -> ...` logs reflect these transitions.

**Step 5: Bench-check responsiveness**

Validate on device:

- the LCD still changes while the device is trying to connect to facility Wi-Fi
- the LED does not stall during long operations
- touch input remains usable where the flow permits it

**Step 6: Commit**

```bash
git add firmware/esp32_transport_harness/src/wifi_runtime.cpp firmware/esp32_transport_harness/src/device_state.h firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: improve runtime ui responsiveness"
```

### Task 6: Preserve and formalize the Serial UI contract

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `firmware/esp32_transport_harness/README.md`

**Step 1: Normalize the UI log vocabulary**

Use stable event families such as:

- `[UI] Screen -> ...`
- `[UI] Input -> ...`
- `[UI] Selection -> ...`
- `[UI] Action -> ...`
- `[UI] Confirm -> ...`
- `[UI] Runtime -> ...`

**Step 2: Keep sensitive output intentional**

Continue printing:

- fresh bootstrap token
- enrollment link

Only when `New enrollment` is generated, matching the current harness workflow.

**Step 3: Update the firmware README**

Document:

- two-touch control semantics
- confirmation behavior
- expected Serial UI log categories

**Step 4: Bench-check the logging contract**

Trigger each major action and confirm the Serial output matches the LCD behavior.

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp firmware/esp32_transport_harness/README.md
git commit -m "docs: document two-touch ui logging contract"
```

### Task 7: Final bench validation and cleanup

**Files:**
- Modify: `firmware/esp32_transport_harness/README.md`

**Step 1: Run the full device validation pass**

Verify:

1. both touch inputs calibrate at boot
2. menu selection is always visually obvious
3. home screen remains readable
4. `New enrollment`, `Clear Wi-Fi`, and `Factory reset` require confirmation
5. runtime and Wi-Fi transitions remain visible and responsive
6. Serial logs align with LCD and LED behavior

**Step 2: Fix any small copy or prompt issues**

Tighten LCD wording so it fits the 16x2 display without losing clarity.

**Step 3: Update docs if bench behavior differs**

Adjust the README or plan notes so the actual shipped controls match the documentation.

**Step 4: Commit**

```bash
git add firmware/esp32_transport_harness/README.md
git commit -m "chore: finalize two-touch ui validation notes"
```
