# Quick Connect Default Experience Design

**Date:** 2026-04-02

## Goal

Make the demo-ready quick-connect flow the default user experience across the ESP32 firmware and the mobile app, while keeping the existing BLE enrollment and developer tooling available behind advanced settings.

## Problem

The current default experience is still oriented around supervised BLE enrollment, claim tokens, transport debugging, and developer-facing status language.

That does not fit the immediate demo and field goal:

- any app user with the app and shown SoftAP credentials should be able to connect
- the device should be reachable without BLE as the first step
- nurses should see a simple MKT-first interface, not transport internals
- raw telemetry must still be captured locally and pushed upstream as soon as possible for later processing

## Approved Approach

Adopt a dual-path model with a clear default:

1. `Quick Connect` becomes the default path
- firmware starts in quick-connect-ready mode
- the app foregrounds quick connect as the primary device action
- the connection path is Wi-Fi-first through the device SoftAP

2. `Advanced Setup` remains available
- existing BLE enrollment and deeper diagnostics remain in the codebase
- developer and service functions move behind settings or advanced menus
- the secure, more complex path is preserved for later hardening

## Default Operating Model

### Firmware

On boot, the device should expose a persistent SoftAP profile intended for quick manual connection. The SoftAP identity and credential survive reboot until the operator explicitly changes them from the on-device settings flow or from a controlled app settings surface.

The default OLED experience should show:

- device display name
- quick-connect-ready state
- SoftAP SSID
- SoftAP credential
- current MKT value

The home flow should no longer default to claim-token, BLE-primary, or debugging information.

### App

The app should default to a quick-connect-first workflow:

- user opens `Devices`
- primary call to action is `Quick Connect`
- user enters the device identifier and shown SoftAP credential
- app joins the SoftAP directly without initial BLE work
- app reads runtime snapshot and history from the local runtime API
- app stores raw readings locally and displays the connected device in a nurse-friendly interface

The app-side connection should create a local-access session rather than requiring full device enrollment or assignment.

## Firmware UI And Settings Model

The firmware should split its operator surfaces into two layers.

### Default nurse-facing layer

Visible by default:

- quick connect status
- device name
- MKT display
- simple connection and health text

### Settings / advanced layer

Hidden behind intentional navigation:

- enrollment token generation
- BLE pairing and claim-token views
- verbose transport diagnostics
- factory/service operations
- credential rotation and other configuration tools

This keeps the demo path simple while preserving field-service access when needed.

## Telemetry Contract

### Source-of-truth payload

The runtime API and history payloads should continue to send raw telemetry data, not MKT as the primary stored value.

Required raw data:

- raw temperature
- timestamp / RTC time
- sequence number
- related runtime status metadata already needed for ingestion

### Firmware display value

The firmware should calculate and display MKT locally on the OLED so the device itself shows the care-facing metric.

### App display value

The app should calculate MKT from stored raw readings when the UI needs to render it. MKT becomes a display/computed metric, not the canonical stored telemetry payload.

### Storage and upload model

The app should:

- store raw readings locally in SQLite immediately after fetch
- push those stored raw readings to the database as soon as it can
- avoid waiting for a fixed deferred upload window when connectivity is available

If upstream sync fails, the app should leave the raw readings queued locally and retry on the next successful opportunity.

## Nurse-Facing App UX

The device surfaces in the app should be simplified.

### Devices screen

The default action becomes `Quick Connect`, not QR/BLE enrollment. Device cards should emphasize:

- MKT
- care status
- last update time
- simple connection state

### Device detail screen

The primary detail experience should show:

- MKT
- current care status
- last sync time
- simple connectivity status
- raw temperature as secondary detail

Developer-heavy transport language should not dominate the main screen.

### Advanced app surface

Transport diagnostics, BLE-first enrollment, developer codes, and low-level controls should move to a lower-visibility advanced/settings surface so they remain available without confusing nurses.

## Compatibility And Migration

This is a UX and workflow realignment, not a full rewrite.

The existing building blocks should be reused where possible:

- SoftAP runtime API at `192.168.4.1`
- local runtime config persistence
- local SQLite telemetry history
- best-effort telemetry upload to Convex
- existing BLE enrollment path for advanced use

Where current payloads still expose legacy fields such as firmware-side `mktStatus` or enrollment metadata, the app may temporarily tolerate them for compatibility, but nurse-facing display logic should move toward app-computed MKT based on raw readings.

## Error Handling

### Firmware

- quick-connect SoftAP startup failure should be surfaced clearly on the OLED
- quick-connect credential settings should persist atomically
- MKT display should degrade gracefully if insufficient telemetry history exists

### App

- invalid quick-connect credentials should show a plain-English retry message
- SoftAP join failures should not surface BLE-oriented error wording
- missing or insufficient raw history should fall back to simpler display text until MKT can be computed
- failed database upload should not block local viewing; it should remain queued for retry

## Testing

Required validation:

- firmware boots into quick-connect-ready mode by default
- SoftAP credentials persist across reboot until changed
- OLED default screens show quick-connect info and MKT
- advanced firmware settings still expose developer/service tools
- app quick connect succeeds without initial BLE
- raw readings are saved locally after runtime fetch
- app computes MKT from raw readings for nurse-facing display
- database sync is attempted immediately after raw readings are stored
- nurse-facing screens no longer foreground transport/developer details

## Out Of Scope

The following are not required for this pass:

- removing the existing BLE enrollment path
- redesigning the backend data model beyond what raw-reading ingestion needs
- a full role/authorization overhaul for the demo quick-connect flow
- a final security hardening pass for public/demo access
