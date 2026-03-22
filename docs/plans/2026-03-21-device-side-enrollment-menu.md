# Device-Side Enrollment Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a production-oriented device-side menu with long-press entry, LCD rendering, explicit enrollment-ready state, fresh persisted enrollment tokens, and app-visible pairing/diagnostic integration.

**Architecture:** The ESP32 firmware gains a UI/input state machine separated from display rendering so the current I2C LCD and future OLED can share the same menu logic. Enrollment becomes an explicit device-controlled mode with persisted token state, while the app shows plain-English failures and exposes copyable developer error codes.

**Tech Stack:** ESP32 Arduino firmware, Preferences persistence, I2C LCD display, app React Native UI, existing BLE enrollment transport.

---

### Task 1: Define the firmware UI state model

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_state.h`
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`
- Create: `firmware/esp32_transport_harness/src/device_ui.h`
- Create: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Write the state checklist**

Document and encode the minimum states:
- idle runtime
- menu
- enrollment ready
- pending enrollment
- diagnostics
- confirmation/reset

**Step 2: Implement the minimal state model**

Add persistent fields for:
- explicit enrollment-ready mode
- persisted current enrollment token
- last diagnostic error code if needed

**Step 3: Verify behavior**

Expected:
- runtime state and enrollment-ready state are distinct

### Task 2: Add long-press input handling and menu navigation

**Files:**
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`

**Step 1: Write the bench checklist**

Cover:
- short press navigation
- long press enters menu
- long press confirms selection
- idle timeout returns to runtime screen if desired

**Step 2: Implement the minimal input loop**

Poll the button, debounce it, and emit:
- short press events
- long press events

Wire those events into the menu state machine.

**Step 3: Bench verify**

Expected:
- operator can reliably open and navigate the menu without serial input

### Task 3: Add LCD renderer abstraction

**Files:**
- Create: `firmware/esp32_transport_harness/src/display_renderer.h`
- Create: `firmware/esp32_transport_harness/src/display_renderer.cpp`
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`

**Step 1: Define the renderer contract**

Support rendering:
- status lines
- menu selection
- enrollment-ready screen
- diagnostics pages

**Step 2: Implement the LCD renderer**

Use the current I2C LCD for development while keeping renderer calls independent of menu logic.

**Step 3: Bench verify**

Expected:
- display updates without coupling display code to BLE or Wi-Fi logic

### Task 4: Make enrollment token generation explicit and persistent

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`
- Modify: `firmware/esp32_transport_harness/src/ble_recovery.cpp`

**Step 1: Write the token lifecycle checklist**

Cover:
- selecting `New enrollment`
- reboot before pairing
- repeated `New enrollment`
- successful enrollment clears or retires the pending token appropriately

**Step 2: Implement the minimal token lifecycle**

Change behavior so:
- blank state alone does not imply passive pairing readiness
- `New enrollment` generates and persists a fresh token
- the token survives reboot
- enrollment only accepts the currently active token

**Step 3: Bench verify**

Expected:
- stale older claims are rejected
- newly generated claims pair successfully after reboot

### Task 5: Gate app enrollment on explicit enrollment-ready state

**Files:**
- Modify: `src/features/devices/services/ble-client.ts`
- Modify: `src/features/devices/services/connection-service.ts`
- Modify: `app/device/enroll.tsx`

**Step 1: Write the failing tests**

Add coverage proving:
- enrollment refuses to continue when device is blank but not explicitly enrollment-ready
- the UI shows a plain-English explanation
- the raw developer code can still be copied

**Step 2: Run tests**

Run: `npm test -- src/features/devices/services/connection-service.test.ts src/features/dashboard/__tests__/device-details-screen.test.tsx`
Expected: FAIL before the gating/UI changes.

**Step 3: Implement the minimal app change**

Use the BLE hello/state response to distinguish:
- not ready for enrollment
- ready for enrollment
- pending or already enrolled

**Step 4: Re-run tests**

Expected: PASS

### Task 6: Add user-friendly error messaging with copyable developer codes

**Files:**
- Modify: `app/device/[id].tsx`
- Modify: `app/device/enroll.tsx`
- Create: `src/features/devices/services/error-presenter.ts`
- Modify: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

**Step 1: Write the failing UI tests**

Cover:
- plain-English transport failure message
- copy action for developer error code
- diagnostics still expose the underlying raw code

**Step 2: Run tests**

Run: `npm test -- src/features/dashboard/__tests__/device-details-screen.test.tsx`
Expected: FAIL because raw errors are currently rendered directly.

**Step 3: Implement the minimal UI layer**

Map known transport and pairing errors to plain-English summaries while keeping a copyable raw code string available for support/debugging.

**Step 4: Re-run tests**

Expected: PASS

### Task 7: Add on-device diagnostics pages

**Files:**
- Modify: `firmware/esp32_transport_harness/src/device_ui.cpp`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/device_state.cpp`

**Step 1: Write the diagnostics checklist**

Expose:
- device ID
- enrollment state
- token-present state
- SoftAP status
- station-connected status
- active transport
- firmware version
- last error code

**Step 2: Implement the minimal diagnostics screens**

Use existing runtime state rather than inventing duplicate sources of truth.

**Step 3: Bench verify**

Expected:
- device-side diagnostics match serial/runtime state

### Task 8: Document the operator workflow

**Files:**
- Modify: `docs/runbooks/esp32-transport-harness.md`
- Modify: `firmware/README.md` if present

**Step 1: Document the menu workflow**

Cover:
- long press to enter menu
- generating a new enrollment token
- reboot persistence
- successful enrollment handoff
- clearing/reset behavior

**Step 2: Verify docs against firmware behavior**

Expected:
- docs match the implemented operator flow without requiring serial-only recovery
