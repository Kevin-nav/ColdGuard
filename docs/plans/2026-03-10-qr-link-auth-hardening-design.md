# QR Link Auth Hardening Design

**Problem**

The current onboarding flow treats a scanned institution QR code as sufficient to link a user to a facility and return the facility handshake token. In practice that makes QR possession equivalent to institution authentication, which is too weak for a healthcare deployment and exposes institution-scoped data before staff credentials are verified.

**Decision**

QR scan will be used for institution selection only. Staff credentials will remain the only path that links a user to an institution, assigns role and staff identity, and returns the handshake token used for device workflows.

**Auth Boundary**

- `users.linkInstitutionByQr` resolves an institution from its QR code and returns display data only.
- `users.linkInstitutionByQr` must not patch `users.institutionId`, `users.role`, or `users.staffId`.
- `users.linkInstitutionByQr` must not return `handshakeToken`.
- `users.linkInstitutionByCredentials` remains the only mutation that links the user, assigns role and staff identity, and returns `handshakeToken`.

**Frontend Flow**

- QR scan preselects the institution and moves the user into the same staff ID and passcode flow used for manual institution selection.
- Local profile caching and dashboard seeding happen only after credential-based linking succeeds.
- Secure storage of the clinic handshake token happens only after credential-based linking succeeds.

**Security Hardening**

- `convex/devices.ts` must only accept `TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64` when `NODE_ENV === "test"`.
- Non-test environments must require `COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY_PKCS8_B64` and fail loudly otherwise.
- Role values must be normalized at the backend boundary to `"Supervisor"` or `"Nurse"` before storing them on users or writing device audit events.
- Schema validation for `users.role` and `institutionCredentials.role` should match the same role enum so downstream authorization and audit writes cannot drift.

**Error Handling**

- Unknown QR codes keep the current `INSTITUTION_CODE_NOT_RECOGNIZED` failure.
- Failed credential attempts keep the existing throttle and lockout behavior.
- A QR scan alone must leave the user unlinked and unable to access institution-scoped Convex queries.

**Testing**

- Add backend tests proving QR linking does not patch the user and does not return `handshakeToken`.
- Add frontend tests proving QR scan preselects the institution and then requires credentials before profile storage, dashboard seed, and route transition.
- Add grant-signing tests proving the test key env var is rejected outside test mode.
- Add role normalization tests proving invalid or legacy role strings fall back safely to `"Nurse"` and valid supervisor roles remain `"Supervisor"`.
