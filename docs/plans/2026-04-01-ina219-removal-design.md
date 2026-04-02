# INA219 Removal Design

**Goal:** Remove INA219 power-sensor support from the firmware and stop consuming INA219-derived telemetry in the application stack.

## Scope

- Remove `Adafruit_INA219` usage and INA219-dependent telemetry from the ESP32 transport harness.
- Remove INA219-derived runtime/history fields from the firmware HTTP payloads.
- Remove INA219-derived fields from app-side parsing, storage, dashboards, detail views, mock data, and notification evaluation.
- Keep temperature, RTC, SD-card, enrollment, transport, and connectivity behavior intact.

## Contract Changes

- Firmware runtime status payload no longer publishes:
  - `batteryLevel`
  - `batteryPercentEstimate`
  - `batteryVoltageV`
  - `shuntVoltageMv`
  - `currentMa`
  - `powerMw`
  - `powerSensorHealthy`
- Firmware runtime history rows no longer publish INA219-derived battery/power columns.
- Battery-low alerts are removed from firmware runtime alerts and app/backend notification logic.

## Firmware Design

- Delete INA219 include guards, global instance, initialization, and telemetry reads.
- Simplify `DeviceState`, `TelemetrySample`, and `RuntimeSnapshot` to temperature/RTC/SD telemetry only.
- Remove battery-derived warning and critical logic since there is no remaining battery source.
- Update OLED UI summaries so they no longer display battery values or treat missing INA219 as degraded hardware.

## App/Backend Design

- Remove INA219-derived fields from runtime payload types and telemetry history record types.
- Update runtime snapshot parsing and history ingestion to accept the smaller firmware payload.
- Remove battery/power metrics from device cards and device detail screens.
- Remove battery-low notification generation and related preference handling because those alerts were driven by INA219-derived battery estimates.
- Keep existing SQLite/Convex persistence usable for temperature/runtime data; unused legacy columns may remain physically present if not required for active code paths.

## Testing

- Firmware: verify no active source references `INA219` or the removed runtime fields.
- App/backend: run targeted tests for runtime parsing, device repository/storage, dashboard/device detail rendering, and notification logic.
