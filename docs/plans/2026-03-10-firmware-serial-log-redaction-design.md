# Firmware Serial Log Redaction Design

**Problem**

The ESP32 transport harness still prints raw BLE request and response payloads to serial. Those payloads can contain bearer material such as `bootstrapToken`, `grantToken`, `handshakeToken`, `handshakeProof`, and the Wi-Fi `password`.

**Decision**

Keep BLE serial logging, but redact known secret-bearing fields before printing. The firmware should continue to log command flow and non-secret metadata while preventing secret leakage over serial by default.

**Approach**

- Add a small payload sanitizer that rewrites known sensitive JSON string fields to `"<redacted>"`.
- Apply the sanitizer only to serial logging, never to the actual BLE payload sent or received.
- Use the sanitizer in both BLE log points:
  - incoming writes in `CommandCallbacks::onWrite`
  - outgoing responses in `sendBleResponse`
- Keep `kVerboseSecretLogging` as the explicit unsafe debugging escape hatch.

**Sensitive Fields**

- `bootstrapToken`
- `grantToken`
- `handshakeToken`
- `handshakeProof`
- `password`

**Validation**

- Add automated tests for the sanitizer itself using representative payloads that include `bootstrapToken`, `grantToken`, `handshakeToken`, `handshakeProof`, and `password`, and assert the logged copy is redacted.
- Add automated tests for the BLE serial log sites in `CommandCallbacks::onWrite` and `sendBleResponse` so the tests prove redaction is applied to logging flow only and does not mutate the BLE payload bytes sent or received.
- Add automated tests for the startup and SoftAP log formatting paths so `Bootstrap Token` and the SoftAP `password` are redacted by default.
- Add automated tests for the `kVerboseSecretLogging` escape hatch so the same log paths remain unredacted only when explicitly enabled.
- Add regression-oriented test names and assertions that reference the sanitizer, BLE serial log sites, startup/SoftAP logs, and the escape hatch directly so future log additions fail loudly if a sensitive field is emitted unredacted.
