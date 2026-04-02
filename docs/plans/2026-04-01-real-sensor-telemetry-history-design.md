# Real Sensor Telemetry And History Design

## Goal

Replace the firmware transport harness's simulated runtime data with real hardware telemetry, persist every reading to the microSD card, sync all unsynced historical records into the app and Convex, and remove the unused reed-switch door flow from the firmware, mobile app, and backend.

## Hardware Contract

The firmware will read from the following hardware:

- `DS18B20` vaccine temperature probe on `GPIO17`
- `RTC` module on I2C
- `INA219` current and power monitor on I2C
- `SH1106 OLED` on I2C
- `passive buzzer` on `GPIO16`
- `microSD` on SPI:
  - `SCK` -> `GPIO18`
  - `MISO` -> `GPIO19`
  - `MOSI` -> `GPIO23`
  - `CS` -> `GPIO5`

The existing capacitive-touch OLED UI and BLE/Wi-Fi runtime transport remain in place.

## Firmware Architecture

### 1. Real telemetry sampling

The transport harness should gain a hardware telemetry layer that:

- initializes DS18B20, RTC, INA219, OLED, buzzer, and SD
- samples the latest vaccine temperature, bus voltage, shunt voltage, current, and power
- derives a battery percentage estimate from the electrical readings
- derives `mktStatus` from temperature thresholds
- records whether each peripheral is healthy

The current `/api/v1/runtime/status` payload should stop using simulated values and instead return the newest real snapshot.

### 2. SD-backed historical logging

Every successful sampling cycle should append one record to a CSV log on the SD card. The SD log is the canonical historical record for the device.

Recommended CSV fields:

- `sequence`
- `recordedAtEpochMs`
- `rtcIso`
- `timeSource`
- `vaccineTempC`
- `batteryVoltageV`
- `shuntVoltageMv`
- `currentMa`
- `powerMw`
- `batteryPercentEstimate`
- `mktStatus`
- `sensorHealth`

`sequence` must be monotonic and persisted in preferences so records stay unique across reboots.

The firmware should not delete or rewrite historical rows after sync. Instead, the app will request all rows after the last successfully synced sequence.

### 3. Runtime transport contract

Keep `/api/v1/runtime/status` as the fast snapshot endpoint, but update it to include real telemetry fields:

- `currentTempC`
- `recordedAt`
- `rtcIso`
- `timeSource`
- `batteryVoltageV`
- `currentMa`
- `powerMw`
- `batteryPercentEstimate`
- `mktStatus`
- `latestSequence`
- `sdCardMounted`
- `statusText`
- `alerts`

Add a new paged history endpoint:

- `/api/v1/runtime/history?afterSequence=<n>&limit=<n>`

The history endpoint should read CSV rows from SD, parse them into JSON, and return:

- `rows`
- `nextSequence`
- `hasMore`

This keeps the SD storage format simple while making the mobile contract reliable and easy to test.

### 4. OLED and buzzer behavior

The OLED home and diagnostics screens should reflect the real device state:

- vaccine temperature
- battery estimate plus electrical summary
- RTC time
- active runtime transport and sync state
- SD card health

The passive buzzer is local-only and should not be synced. It should be used for:

- SD fault
- sensor initialization or read fault
- critical temperature alert
- critically low battery alert

## App Data Flow

### 1. Latest snapshot

The mobile app should keep using the connection test and monitoring flows to fetch the latest runtime snapshot. The runtime snapshot becomes the current device view in SQLite and the UI.

### 2. Historical sync

After the latest snapshot is fetched successfully, the app should:

1. look up the last successfully synced `sequence` for the device
2. call the history endpoint for all rows after that sequence
3. persist the returned rows locally
4. batch-upload them to Convex
5. advance the sync cursor only after the Convex batch succeeds
6. repeat until `hasMore` is false

The sync model is "every unsynced row from SD". No sampling window or retention cutoff is applied during sync.

### 3. Local persistence

SQLite device state should store the newest runtime snapshot fields and no longer store `doorOpen`.

SQLite historical readings should be expanded from temperature-centric rows into telemetry rows keyed by `deviceId + sequence`, so the sync path is idempotent locally as well.

## Convex Data Model

### 1. Latest device snapshot

The `devices` table should gain the latest hardware snapshot fields required for list and detail views:

- `currentTempC`
- `recordedAt`
- `rtcIso`
- `timeSource`
- `batteryVoltageV`
- `currentMa`
- `powerMw`
- `batteryPercentEstimate`
- `mktStatus`
- `latestSequence`
- `lastSeenAt`

### 2. Historical telemetry table

Add a new `deviceTelemetryReadings` table for historical rows, keyed by:

- `deviceId`
- `sequence`

Each row should store the parsed SD telemetry record so Convex can support historical charts and later analytics.

### 3. Ingestion contract

Add a mutation that ingests telemetry rows in batches and upserts by `deviceId + sequence`. The same mutation should also update the `devices` table with the newest snapshot if the incoming `sequence` is newer than the stored one.

This allows safe retries without duplicate historical rows.

## Door/Reed Removal

The system no longer has a reed switch. Remove `doorOpen` and `door_open` handling from:

- firmware runtime snapshot and alert generation
- mobile device types and SQLite state
- mobile UI and settings
- Convex schema and notification preferences
- Convex incident evaluation and tests

After removal, the notification system should only evaluate:

- `temperature`
- `battery_low`
- `device_offline`

## Error Handling

### Sensor and peripheral failures

- DS18B20 failure: keep runtime alive, mark sensor health degraded, log what is available, and surface a clear status text
- RTC failure: fall back to a generated time value and set `timeSource` to a degraded mode
- INA219 failure: keep temperature and connectivity flowing, but mark power metrics unavailable
- SD failure: continue serving live snapshots, report `sdCardMounted=false`, and skip historical export until the card is available again

### Sync failures

- if local persistence fails, do not advance the cursor
- if Convex batch ingestion fails, do not advance the cursor
- if the app stops mid-sync, the next attempt resumes from the last confirmed sequence

## Testing Strategy

### Firmware

- verify hardware init and runtime payload generation paths
- verify SD CSV append and history pagination
- verify buzzer and OLED state transitions for degraded and critical conditions

### App

- update connection-service tests for the new runtime payload
- add history sync tests for paging, idempotent retries, and cursor advancement
- update SQLite repository tests for the new latest snapshot and telemetry records

### Convex

- add schema and mutation coverage for telemetry ingestion
- verify latest snapshot updates only move forward by sequence
- remove door-open notification coverage and keep temperature, battery, and offline coverage
