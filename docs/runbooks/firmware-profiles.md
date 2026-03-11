# Firmware Profiles

ColdGuard firmware is expected to ship as profile-based builds rather than one monolithic image.

## Profiles

### `factory`

Purpose:

- manufacturing validation
- bench diagnostics
- bring-up helpers

Should include:

- serial-heavy diagnostics
- temporary factory test endpoints
- validation helpers that are useful only during setup and manufacturing

Should exclude:

- assumptions that this image is the field image

### `production`

Purpose:

- field deployment
- routine clinic operation
- field decommission and re-enrollment

Should include:

- normal sensing and business logic
- Wi-Fi-first runtime communication
- BLE discovery and provisioning
- BLE recovery commands for decommission and re-enrollment

Should exclude:

- factory-only diagnostics
- debug-only endpoints
- broad test helpers that increase flash use but do not help field recovery

Important:

- `production` must still support decommission
- `production` must still support re-enrollment to another institution
- those actions must not require USB reflashing

### `rescue`

Purpose:

- manual USB recovery for devices that cannot be recovered through the normal production recovery path

This profile is optional and should stay narrow.

## Build Direction

For the current Arduino-based harness, profile boundaries are represented by module boundaries and feature scope:

- `firmware/esp32_transport_harness/src/device_state.*`
- `firmware/esp32_transport_harness/src/action_ticket.*`
- `firmware/esp32_transport_harness/src/ble_recovery.*`
- `firmware/esp32_transport_harness/src/wifi_runtime.*`

As the firmware grows, profile selection should be controlled by build flags or explicit entry points so that factory-only features are not linked into production images.

## Field Reassignment

Institution reassignment should use:

1. `device.decommission`
2. return to blank state
3. fresh enrollment

That flow belongs in `production`, not in a separate institution-specific image.
