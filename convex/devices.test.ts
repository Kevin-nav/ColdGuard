import { __testing } from "./devices";

beforeEach(() => {
  process.env.COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY_PKCS8_B64 =
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgs27Y743ykh9PjkxziKEWvye/1w/2NNCs3w8ZQ8zpeDqhRANCAARWXAYGhrfHpfj16UZUSmVL56OnAOBf0BU6Eu+G5gajxwlQxJkuu6kxDxjvpRwp3V7sMkfBp8D1+K0CHnqgWk1P";
});

test("builds ES256 grants with issuer and key metadata", async () => {
  const grant = await __testing.buildGrantForTesting({
    deviceId: "device-1",
    expiresAt: 1_700_000_123_456,
    grantVersion: 2,
    institutionId: "institution-1",
    issuedToFirebaseUid: "firebase-user-1",
    permission: "connect",
    role: "Nurse",
  });

  const decoded = __testing.decodeToken(grant.token);

  expect(decoded.header).toMatchObject({
    alg: "ES256",
    kid: "coldguard-esp32-transport-v1",
    typ: "JWT",
  });
  expect(decoded.payload).toMatchObject({
    alg: "ES256",
    deviceId: "device-1",
    exp: 1_700_000_123_456,
    grantVersion: 2,
    institutionId: "institution-1",
    iss: "coldguard-api",
    permission: "connect",
    scope: "connect",
    sub: "device-1",
  });
  expect(grant.token.split(".")).toHaveLength(3);
});

test("does not emit legacy HS256 grant headers", async () => {
  const grant = await __testing.buildGrantForTesting({
    deviceId: "device-1",
    expiresAt: 1_700_000_123_456,
    grantVersion: 2,
    institutionId: "institution-1",
    issuedToFirebaseUid: "firebase-user-1",
    permission: "manage",
    role: "Supervisor",
  });

  const decoded = __testing.decodeToken(grant.token);
  expect(decoded.header.alg).toBe("ES256");
  expect(decoded.header.alg).not.toBe("HS256");
});
