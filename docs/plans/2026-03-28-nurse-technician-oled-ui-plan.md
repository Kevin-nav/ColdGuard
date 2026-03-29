# Nurse/Technician OLED UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the ESP32 transport harness OLED UI so pairing, success/failure feedback, and full unpair/re-pair workflows feel professional and nurse/technician-friendly instead of developer-heavy.

**Architecture:** Keep the existing two-touch interaction model and SH1106 display stack, but introduce an explicit UI-facing workflow state, route BLE recovery and decommission events into that state machine, and replace the current home/menu/detail copy with task-first screens, progress views, and professional outcome states. Treat the existing `https://coldguard.org/device/...` and `coldguard://device/...` pairing formats as unchanged, and keep the local `http://192.168.4.1/...` URL limited to SoftAP/runtime handoff after pairing.

**Tech Stack:** ESP32 Arduino C++, U8g2 SH1106 OLED, BLE recovery harness, Preferences, WebServer, Serial logging

---

### Task 1: Lock the approved pairing URL and reset behavior in documentation

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/README.md`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/docs/plans/2026-03-28-nurse-technician-oled-ui-design.md`

**Step 1: Update the docs first**

Document these approved rules explicitly:

- pairing accepts `https://coldguard.org/device/<deviceId>?claim=<bootstrapToken>&v=1`
- pairing accepts `coldguard://device/<deviceId>?claim=<bootstrapToken>&v=1`
- the local `http://192.168.4.1/api/v1/connection-test` URL is runtime/SoftAP only
- `Unpair device` means full decommission back to blank state

**Step 2: Review the docs for consistency**

Check that the README wording matches the design doc exactly and does not imply `http://` pairing support.

**Step 3: Commit**

```bash
git add firmware/esp32_transport_harness/README.md docs/plans/2026-03-28-nurse-technician-oled-ui-design.md
git commit -m "docs: clarify pairing links and unpair behavior"
```

### Task 2: Add a UI-facing workflow state to the firmware device state model

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_state.h`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/esp32_transport_harness.ino`

**Step 1: Write the failing firmware state assertions**

Add targeted harness coverage or temporary assertions that prove the firmware can represent these UI states:

- blank idle
- token ready
- waiting for phone
- secure verification
- saving enrollment
- pairing success
- pairing failure
- paired idle
- decommissioning
- decommission success

**Step 2: Run the firmware verification command**

Run the transport harness verification command used for this repo.
Expected: FAIL because the device state model does not yet carry UI workflow state.

**Step 3: Write minimal implementation**

Add fields or enums to represent:

- current UI workflow state
- optional transient message or failure code
- timestamps for transient progress/outcome visibility

Initialize and reset them correctly during boot, clear-enrollment, and decommission paths.

**Step 4: Run the verification command again**

Run the same transport harness verification command.
Expected: PASS for the new state-model coverage.

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_state.h firmware/esp32_transport_harness/src/device_state.cpp firmware/esp32_transport_harness/esp32_transport_harness.ino
git commit -m "feat: add ui workflow state to firmware device model"
```

### Task 3: Wire BLE enrollment and decommission events into the UI workflow

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/ble_recovery.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/ble_recovery.h`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_state.h`

**Step 1: Write the failing event-flow coverage**

Add coverage that proves the UI workflow transitions on real BLE/decommission events:

- `enroll.begin` moves from token-ready to waiting/verification
- successful proof/ticket checks move toward saving
- `enroll.commit` completion lands on pairing success
- enrollment failure records pairing failure
- decommission start enters decommissioning
- decommission completion lands on decommission success and then blank

**Step 2: Run the verification command**

Run the transport harness verification command.
Expected: FAIL because BLE recovery does not currently publish those UI transitions.

**Step 3: Write minimal implementation**

Update BLE recovery handlers so they set the new UI workflow state at the appropriate points. Preserve the current protocol responses and security logic. Do not add fake progress timers.

**Step 4: Run the verification command again**

Run the same transport harness verification command.
Expected: PASS

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/ble_recovery.cpp firmware/esp32_transport_harness/src/ble_recovery.h firmware/esp32_transport_harness/src/device_state.h
git commit -m "feat: drive oled workflow from ble recovery events"
```

### Task 4: Replace the current menu and home copy with task-first nurse/technician wording

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.h`

**Step 1: Write the failing UI contract notes**

Add a concise test checklist or harness-visible assertions for:

- `New enrollment` renamed to `Pair new device`
- `Diagnostics` demoted behind `Device status`
- `Factory reset` removed from the main operator flow
- home screen states use simplified nurse/technician wording

**Step 2: Run the firmware verification command**

Run the transport harness verification command or the repo’s preferred device UI validation path.
Expected: FAIL because current strings and menu structure are still developer-oriented.

**Step 3: Write minimal implementation**

Update menu items, home-state labels, and footer hints so the UI reads like:

- `Ready to pair`
- `Scan to pair`
- `Pairing in progress`
- `Device paired`
- `Wi-Fi issue`
- `Attention needed`
- `Pair new device`
- `Wi-Fi setup`
- `Device status`
- `Unpair device`

Preserve the two-touch semantics while reducing technical wording.

**Step 4: Run the verification command again**

Run the same validation command.
Expected: PASS

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp firmware/esp32_transport_harness/src/device_ui.h
git commit -m "feat: simplify oled home and menu wording"
```

### Task 5: Add dedicated pairing progress, success, and failure screens

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.h`

**Step 1: Write the failing UI state coverage**

Add validation for these visible pairing phases:

- token issued / ready to scan
- waiting for phone
- verifying secure pairing
- saving setup
- pairing complete
- pairing failed

**Step 2: Run the firmware verification command**

Run the transport harness verification command or the repo’s device UI validation path.
Expected: FAIL because the OLED currently only exposes token details and coarse enrollment states.

**Step 3: Write minimal implementation**

Add dedicated render paths for the new pairing states. Make the displayed text map to real workflow state, not inferred timing. Keep success/failure screens visible long enough to be noticed before returning to the steady home state.

**Step 4: Run the verification command again**

Run the same validation command.
Expected: PASS

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp firmware/esp32_transport_harness/src/device_ui.h
git commit -m "feat: add dedicated pairing progress and outcome screens"
```

### Task 6: Add simple professional OLED motion tied to real workflow state

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Write the failing visual-behavior checklist**

Define verifiable motion behavior for:

- waiting for phone: animated dots or scan pulse
- secure verification: sweep/progress movement
- saving setup: segmented progress movement
- success: brief checkmark or confirmation pulse
- failure: warning pulse

**Step 2: Run the bench validation path**

Run the available device UI validation path and perform a hardware spot check.
Expected: FAIL or incomplete because the current UI has no dedicated pairing motion states.

**Step 3: Write minimal implementation**

Add time-based rendering that is keyed off the current UI workflow state. Avoid decorative animation unrelated to actual device progress.

**Step 4: Re-run validation**

Run the same validation path and repeat the hardware spot check.
Expected: PASS with readable, restrained motion.

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp
git commit -m "feat: add workflow-driven oled motion cues"
```

### Task 7: Replace the normal-user reset path with full unpair/decommission flow

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/ble_recovery.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/README.md`

**Step 1: Write the failing decommission-flow coverage**

Add validation that proves:

- `Unpair device` shows a destructive confirm screen
- accepting the action fully decommissions the device
- the device returns to blank state
- the previous pairing token is no longer considered active
- the operator must issue a fresh token to pair again

**Step 2: Run the verification command**

Run the transport harness verification command.
Expected: FAIL if the UI still exposes the older reset path or the post-reset state is ambiguous.

**Step 3: Write minimal implementation**

Swap the operator-facing reset path to `Unpair device`, route it through full decommission behavior, and ensure the post-decommission OLED returns to the correct blank/ready state.

**Step 4: Run the verification command again**

Run the same command.
Expected: PASS

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp firmware/esp32_transport_harness/src/ble_recovery.cpp firmware/esp32_transport_harness/src/device_state.cpp firmware/esp32_transport_harness/README.md
git commit -m "feat: replace reset flow with full unpair decommission"
```

### Task 8: Re-tune support/status screens and Serial logs around the new UI model

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/README.md`

**Step 1: Write the failing support-screen checklist**

Add validation that proves:

- `Device status` still exposes useful support information
- support screens are secondary and not overly technical
- `[UI]` logs map cleanly to the new screen and workflow state transitions

**Step 2: Run the validation path**

Run the transport harness verification command and perform a bench review.
Expected: FAIL or reveal mismatches between logs and visible screens.

**Step 3: Write minimal implementation**

Retune the support/status copy and log labels so support visibility remains strong without dragging the primary UI back into developer language.

**Step 4: Re-run validation**

Run the same validation path.
Expected: PASS

**Step 5: Commit**

```bash
git add firmware/esp32_transport_harness/src/device_ui.cpp firmware/esp32_transport_harness/README.md
git commit -m "docs: align support status screens with new oled workflow"
```

### Task 9: Perform full bench verification of the nurse/technician OLED flow

**Files:**
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/firmware/esp32_transport_harness/README.md`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/docs/plans/2026-03-28-nurse-technician-oled-ui-design.md`
- Modify: `C:/Users/Kevin/Projects/LabVIEW/ColdGuard/docs/plans/2026-03-28-nurse-technician-oled-ui-plan.md`

**Step 1: Run focused firmware verification**

Run the repo’s transport harness verification command.
Expected: PASS

**Step 2: Run the on-device bench checklist**

Verify on hardware:

1. blank boot shows `Ready to pair`
2. `Pair new device` issues a fresh code
3. OLED transitions through real pairing progress states
4. pairing success visibly confirms before settling
5. pairing failure provides recovery guidance
6. `Unpair device` fully clears the device
7. re-pair requires a fresh token
8. Wi-Fi issue states remain understandable
9. touch controls remain reliable

Expected: PASS

**Step 3: Update docs with final bench findings**

Record any wording, timing, or hardware-tuning changes discovered during bench validation.

**Step 4: Commit**

```bash
git add firmware/esp32_transport_harness/README.md docs/plans/2026-03-28-nurse-technician-oled-ui-design.md docs/plans/2026-03-28-nurse-technician-oled-ui-plan.md
git commit -m "docs: finalize nurse technician oled ui rollout"
```
