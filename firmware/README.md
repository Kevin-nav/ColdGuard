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

The current harness also carries the real telemetry integration used by the mobile stack:

- `DS18B20` vaccine temperature probe on `GPIO17`
- `Passive buzzer` on `GPIO16`
- `RTC` and `SH1106 OLED` on I2C `SDA=21`, `SCL=22`
- internal flash history buffering for unsent telemetry rows

Historical telemetry is stored in a bounded internal flash backlog. The app syncs every unsent row by `sequence`; when storage fills, the firmware evicts the oldest buffered rows. The old reed-switch / door-open signal is no longer part of the firmware contract.

Do not use the production profile as the place to accumulate factory-only tooling.
