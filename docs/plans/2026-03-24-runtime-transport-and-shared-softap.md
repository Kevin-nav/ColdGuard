# Runtime Transport And Shared SoftAP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the ESP32 harness own realistic runtime payload generation and expose Bluetooth-primary, temporary-SoftAP transport semantics that the app device page and diagnostics reflect correctly.

**Architecture:** Extract runtime snapshot generation into a dedicated firmware module, then have the HTTP runtime endpoints serialize that snapshot. On the app side, extend runtime payload parsing and update the device page so connection actions and diagnostics clearly distinguish primary Bluetooth control from temporary SoftAP access.

**Tech Stack:** Arduino ESP32 C++, Expo React Native, TypeScript, Expo SQLite, Jest

---

### Task 1: Extract firmware runtime mock data

**Files:**
- Create: `firmware/esp32_transport_harness/src/runtime_mock_data.h`
- Create: `firmware/esp32_transport_harness/src/runtime_mock_data.cpp`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`

### Task 2: Expose transport/session metadata in runtime endpoints

**Files:**
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.cpp`
- Modify: `firmware/esp32_transport_harness/src/wifi_runtime.h`

### Task 3: Extend app runtime payload typing and parsing

**Files:**
- Modify: `src/features/devices/types.ts`
- Modify: `src/features/devices/services/connection-service.ts`
- Test: `src/features/devices/services/connection-service.test.ts`

### Task 4: Update device page transport wording and diagnostics

**Files:**
- Modify: `app/device/[id].tsx`
- Test: `src/features/dashboard/__tests__/device-details-screen.test.tsx`

### Task 5: Verify end-to-end behavior

**Files:**
- Test: `src/features/devices/services/connection-service.test.ts`
- Test: `src/features/dashboard/__tests__/device-details-screen.test.tsx`
