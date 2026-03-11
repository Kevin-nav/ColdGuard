# Firmware Serial Log Redaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redact secret-bearing fields from firmware BLE serial logs without removing useful protocol trace logging.

**Architecture:** Add a lightweight JSON-string redaction helper in the ESP32 harness and route both BLE request and response logging through it. Keep raw payload transmission unchanged and preserve the existing explicit unsafe debug escape hatch.

**Tech Stack:** Arduino-ESP32, C++, BLE, Preferences

---

### Task 1: Add Payload Redaction Helpers

**Files:**
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`
- Create: `firmware/esp32_transport_harness/tests/serial_log_redaction_test.cpp`
- Create: `firmware/esp32_transport_harness/tests/serial_log_redaction_test.md` if a lightweight harness note is needed

**Step 1: Add a helper that redacts string values for known JSON keys**

- Implement a helper that finds JSON string fields by key and replaces the value with `"<redacted>"`.
- Implement a wrapper that applies that helper to `bootstrapToken`, `grantToken`, `handshakeToken`, `handshakeProof`, and `password`.

**Step 2: Route BLE serial logs through the sanitizer**

- Update `sendBleResponse` to print the sanitized payload.
- Update `CommandCallbacks::onWrite` to print the sanitized payload.

**Step 3: Add automated sanitizer and log-path tests**

- Add tests named around the actual components, for example:
  - `sanitizePayloadForLogging_redacts_all_sensitive_fields`
  - `sendBleResponse_logs_redacted_payload_but_preserves_ble_bytes`
  - `commandCallbacks_onWrite_logs_redacted_payload_but_dispatches_original_payload`
  - `startup_and_softap_logs_redact_secrets_when_verbose_logging_disabled`
  - `startup_and_softap_logs_emit_raw_values_when_verbose_logging_enabled`
- Feed the tests representative payloads containing every known sensitive field and assert the serial log copy is redacted.
- Assert the original BLE payload bytes remain unchanged so the sanitizer only affects logging.
- Add a regression-style test that fails if any newly logged sensitive key is emitted without redaction.

**Step 4: Run the automated tests**

Run: `platformio test -d firmware/esp32_transport_harness` or the repo's chosen firmware test harness command
Expected: PASS

**Step 5: Verify source-level behavior**

- Confirm both log sites still route through the sanitizer after the test extraction.
- Confirm startup and SoftAP logs remain redacted by default.
