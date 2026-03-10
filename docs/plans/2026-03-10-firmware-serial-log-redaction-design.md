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

- Verify both BLE serial log sites use the sanitizer.
- Verify startup and SoftAP logs remain redacted by default.
- Manual/source validation only; no firmware build is available in this session.
