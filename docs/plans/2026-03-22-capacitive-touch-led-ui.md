# Capacitive Touch and Built-In LED UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the ESP32 harness push-button UI with capacitive touch input, add built-in LED mode signaling, and emit Serial logs for significant UI actions including fresh enrollment links.

**Architecture:** Keep the LCD menu and device-state behavior in `device_ui.*`, but replace the input layer with a `touchRead(T0)` state machine and add a non-blocking LED state renderer for `GPIO 2`. Keep all significant UI actions observable across LCD, LED, and Serial without changing the existing app-side transport contracts beyond already-supported enrollment readiness behavior.

**Tech Stack:** Arduino ESP32, `touchRead`, `LiquidCrystal_I2C`, `Preferences`, BLE advertising, Serial logging

---

### Task 1: Update Device UI Configuration for Touch and LED

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.h`
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Reference: `docs/plans/2026-03-22-capacitive-touch-led-ui-design.md`

**Step 1: Extend `DeviceUiConfig`**

Add fields for:

- `touchPin`
- `ledPin`
- `touchThresholdFactor`
- `touchDebounceMs`
- `longPressMs`

Keep existing LCD and firmware metadata fields intact.

**Step 2: Replace sketch-level button pin constants**

In `firmware/esp32_transport_harness/esp32_transport_harness.ino`, replace the old menu button constant with:

- `T0` for touch input
- `2` for built-in LED

Populate the new `DeviceUiConfig` fields.

**Step 3: Verify source consistency**

Check that the sketch still constructs a valid `DeviceUiConfig` and passes it to `initializeDeviceUi(...)`.

**Step 4: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.h firmware/esp32_transport_harness/esp32_transport_harness.ino
git commit -m "feat: add capacitive touch and led ui config"
```

### Task 2: Replace Push-Button Polling with Capacitive Touch Detection

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Remove button-specific state**

Delete or replace:

- `gButtonStablePressed`
- `gLongPressHandled`
- `gButtonStateChangedAtMs`
- `gButtonPressedAtMs`
- `gLastPhysicalButtonState`

with touch-oriented state:

- baseline and threshold
- last touched state
- last trigger time
- touch start time
- touch-active flag

**Step 2: Implement touch calibration**

During `initializeDeviceUi(...)`:

- read `touchRead(gConfig.touchPin)`
- derive the threshold using `touchThresholdFactor`
- print baseline and threshold to Serial

**Step 3: Implement non-blocking touch press classification**

Create or update the input polling helper so it:

- samples `touchRead(gConfig.touchPin)`
- interprets `value < threshold` as touched
- debounces rising edges
- records touch start time
- classifies the released press as short or long
- routes short/long actions to the existing menu behavior

Use the current UI semantics, only changing the physical input source.

**Step 4: Verify source readability**

Keep the state machine small and non-blocking. Avoid `delay(...)` in the input path.

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: replace menu button with capacitive touch input"
```

### Task 3: Add Built-In LED Continuous Mode Signaling

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Add LED mode model**

Define a small internal LED state model that can represent:

- runtime normal
- menu
- enrollment ready
- pending/recovery
- error

**Step 2: Add non-blocking LED renderer**

Implement a helper that updates `GPIO 2` based on `millis()` and current UI/device state without using blocking loops or delays.

**Step 3: Map device state to continuous LED patterns**

Recommended mapping:

- runtime normal: slow heartbeat
- menu: solid on
- enrollment ready: repeating double pulse
- pending enrollment or recovering state: fast pulse
- error code present: repeating triple blink

**Step 4: Call the LED renderer from the UI tick**

Ensure `tickDeviceUi(...)` updates LED state every loop alongside input processing and LCD rendering.

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: add built-in led mode signaling"
```

### Task 4: Add LED Event Overlays for Significant Actions

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Add event overlay state**

Track a temporary overlay pattern with:

- type
- start time
- duration

**Step 2: Trigger overlays from important UI actions**

At minimum, trigger overlays for:

- new enrollment generated
- facility Wi-Fi cleared
- factory reset

**Step 3: Ensure overlays return to continuous mode automatically**

The overlay must expire naturally and hand control back to the continuous LED mode renderer.

**Step 4: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: add led event overlays for ui actions"
```

### Task 5: Add Serial Logging for Significant UI Actions

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`

**Step 1: Add a small UI logging helper**

Standardize device-side UI log messages with a prefix like:

```cpp
Serial.println("[UI] ...");
```

**Step 2: Log major actions**

Log:

- menu opened
- selected menu item
- pairing code viewed
- facility Wi-Fi cleared
- factory reset
- notable mode transitions when useful

**Step 3: Always print fresh enrollment values**

When `New enrollment` runs, always print:

- device id
- bootstrap token
- full enrollment link

Do this every time a new enrollment token is generated, not just at boot.

**Step 4: Keep boot logging compatible**

Do not remove the existing boot-time serial context.

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp firmware/esp32_transport_harness/esp32_transport_harness.ino
git commit -m "feat: log significant touch ui actions to serial"
```

### Task 6: Update Docs for Touch Input and LED Behavior

**Files:**
- Modify: `firmware/esp32_transport_harness/README.md`
- Modify: `docs/runbooks/esp32-transport-harness.md`

**Step 1: Replace button references**

Document:

- capacitive touch on `T0`
- built-in LED on `GPIO 2`

**Step 2: Document current controls**

Explain:

- short touch
- long touch
- how to enter menu
- how to generate a new enrollment

**Step 3: Document observability**

Add notes for:

- continuous LED mode patterns
- event overlays
- serial logs for new enrollment link generation and other major actions

**Step 4: Commit**

```bash
git add firmware/esp32_transport_harness/README.md docs/runbooks/esp32-transport-harness.md
git commit -m "docs: describe capacitive touch and led ui behavior"
```

### Task 7: Bench Verification

**Files:**
- No code changes required

**Step 1: Flash the harness**

Open:

- `firmware/esp32_transport_harness/esp32_transport_harness.ino`

Flash with the existing ESP32 harness board settings.

**Step 2: Verify touch calibration output**

Expected Serial output should include the measured touch baseline and computed threshold.

**Step 3: Verify interaction behavior**

Check:

- short touch advances menu items/pages
- long touch opens the menu
- long touch selects a menu item

**Step 4: Verify LED behavior**

Check:

- runtime heartbeat
- menu steady mode
- enrollment-ready pattern
- event overlay after `New enrollment`

**Step 5: Verify enrollment logging**

Generate a new enrollment and confirm Serial prints:

- `[UI]` action logs
- fresh bootstrap token
- full enrollment link

**Step 6: Record any board-specific quirks**

If LED polarity or touch threshold needs tuning on this board, document the needed value adjustment in the runbook.

