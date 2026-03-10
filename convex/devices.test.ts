import { __testing } from "./devices";

beforeEach(() => {
  process.env.NODE_ENV = "test";
  process.env.TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64 =
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgs27Y743ykh9PjkxziKEWvye/1w/2NNCs3w8ZQ8zpeDqhRANCAARWXAYGhrfHpfj16UZUSmVL56OnAOBf0BU6Eu+G5gajxwlQxJkuu6kxDxjvpRwp3V7sMkfBp8D1+K0CHnqgWk1P";
  delete process.env.COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY_PKCS8_B64;
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

test("throws a clear error when no signing key env var is available", async () => {
  delete process.env.COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY_PKCS8_B64;
  delete process.env.TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64;

  await expect(
    __testing.buildGrantForTesting({
      deviceId: "device-1",
      expiresAt: 1_700_000_123_456,
      grantVersion: 2,
      institutionId: "institution-1",
      issuedToFirebaseUid: "firebase-user-1",
      permission: "manage",
      role: "Supervisor",
    }),
  ).rejects.toThrow("DEVICE_SIGNING_KEY_MISSING");
});

test("rejects the test signing key outside test runtime", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.COLDGUARD_DEVICE_SIGNING_PRIVATE_KEY_PKCS8_B64;
  process.env.TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64 =
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgs27Y743ykh9PjkxziKEWvye/1w/2NNCs3w8ZQ8zpeDqhRANCAARWXAYGhrfHpfj16UZUSmVL56OnAOBf0BU6Eu+G5gajxwlQxJkuu6kxDxjvpRwp3V7sMkfBp8D1+K0CHnqgWk1P";

  await expect(
    __testing.buildGrantForTesting({
      deviceId: "device-1",
      expiresAt: 1_700_000_123_456,
      grantVersion: 2,
      institutionId: "institution-1",
      issuedToFirebaseUid: "firebase-user-1",
      permission: "manage",
      role: "Supervisor",
    }),
  ).rejects.toThrow("DEVICE_SIGNING_KEY_TEST_ENV_ONLY");
});

test("rejects supervisor admin grants for devices owned by another institution", () => {
  expect(() =>
    __testing.ensureSupervisorAdminGrantTargetOwnership(
      { institutionId: "institution-2" },
      "institution-1",
    ),
  ).toThrow("DEVICE_ACCESS_DENIED");
});

test("allows supervisor admin grants for blank devices that are not yet registered", () => {
  expect(() =>
    __testing.ensureSupervisorAdminGrantTargetOwnership(null, "institution-1"),
  ).not.toThrow();
});
