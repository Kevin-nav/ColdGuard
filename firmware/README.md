# Firmware Profiles

ColdGuard firmware should be treated as profile-based, not as one forever-growing image.

Current profile direction:

- `factory`
  - manufacturing and bench validation
  - extended diagnostics
  - temporary test helpers that should not ship in field firmware
- `production`
  - field firmware
  - Wi-Fi-first runtime
  - BLE only for discovery, provisioning, decommission, and recovery
  - supports decommission and re-enrollment without USB reflashing
- `rescue`
  - optional USB recovery image for badly misconfigured devices
  - not required for routine institution reassignment

The transport harness in `esp32_transport_harness/` is the current development target for the production recovery boundary. Keep it focused on:

- local BLE recovery commands
- action-ticket verification
- Wi-Fi handoff for runtime connectivity tests

Do not use the production profile as the place to accumulate factory-only tooling.
