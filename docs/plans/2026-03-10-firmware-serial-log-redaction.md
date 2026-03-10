# Firmware Serial Log Redaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redact secret-bearing fields from firmware BLE serial logs without removing useful protocol trace logging.

**Architecture:** Add a lightweight JSON-string redaction helper in the ESP32 harness and route both BLE request and response logging through it. Keep raw payload transmission unchanged and preserve the existing explicit unsafe debug escape hatch.

**Tech Stack:** Arduino-ESP32, C++, BLE, Preferences

---

### Task 1: Add Payload Redaction Helpers

**Files:**
- Modify: `firmware/esp32_transport_harness/esp32_transport_harness.ino`

**Step 1: Add a helper that redacts string values for known JSON keys**

- Implement a helper that finds JSON string fields by key and replaces the value with `"<redacted>"`.
- Implement a wrapper that applies that helper to `bootstrapToken`, `grantToken`, `handshakeToken`, `handshakeProof`, and `password`.

**Step 2: Route BLE serial logs through the sanitizer**

- Update `sendBleResponse` to print the sanitized payload.
- Update `CommandCallbacks::onWrite` to print the sanitized payload.

**Step 3: Verify source-level behavior**

- Confirm both log sites no longer print raw payloads.
- Confirm existing startup and SoftAP logs remain redacted by default.
