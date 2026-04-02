# Quick Connect Consolidation Design

**Date:** 2026-04-02

## Goal

Replace the scattered demo quick-connect flow with a single app-owned experience that asks the user for only one thing: the 8-digit quick-connect code shown on the device.

## Problem

The current quick-connect path is confusing because the app asks for device identity and network details up front, while Android still performs a separate Wi-Fi network join flow behind the scenes.

That creates a split experience:

- the app asks for `deviceId`, `SSID`, and password
- the phone may still prompt around Wi-Fi connection
- the user is forced to think about transport details instead of just opening the nearby device

## Approved Approach

Adopt a code-only quick-connect flow for demo use:

1. The app asks only for the 8-digit quick-connect code.
2. The Android bridge discovers nearby `ColdGuard_*` Wi-Fi networks.
3. The app tries the entered code against those nearby candidates.
4. Once connected, the app reads the runtime payload from `http://192.168.4.1`.
5. The runtime payload becomes the source of truth for the actual device identity and local session state.

## UX

### Devices screen

The quick-connect form becomes:

- one input: quick-connect code
- one primary action: connect nearby device
- one helper message telling the user to keep the device on the Quick Connect screen

The app should own the connection states with plain-English progress:

- looking for nearby devices
- connecting to device
- reading live data
- opening device

### Device detail

Once connected, the detail screen should continue to work, but the quick-connect copy should describe a local session instead of transport-first internal behavior.

## Architecture

### Android bridge

Add a native function that returns nearby `ColdGuard_*` Wi-Fi SSIDs. This keeps Wi-Fi discovery in the Android layer where permissions and platform APIs already exist.

### App connection service

Replace the manual quick-connect path with a code-driven orchestration flow:

- request nearby Wi-Fi permission
- discover nearby `ColdGuard_*` networks
- attempt connection with the entered code
- fetch runtime snapshot
- persist the resulting local quick-connect device using the discovered runtime payload

### Persistence

The app still stores:

- local quick-connect device record
- runtime config including connected SoftAP SSID and password
- fetched runtime snapshot and history

But it no longer requires the user to provide device identity or SSID manually.

## Error Handling

The app should show one plain-English message per failure type:

- no nearby ColdGuard devices found
- quick-connect code did not work for nearby devices
- device connected but runtime data could not be read

Transport-heavy copy and developer-first wording should stay out of the demo path.

## Testing

Required verification:

- Android bridge reports nearby `ColdGuard_*` networks
- quick connect works with only the 8-digit code
- the app persists the discovered device identity from the runtime payload
- the devices screen no longer asks for device ID or SSID for demo quick connect
- quick-connect detail copy stays simple and local-session focused
