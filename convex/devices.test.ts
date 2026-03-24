import {
  __testing,
  assignDevice,
  issueDeviceActionTicket,
  issueSupervisorActionTicket,
  recordConnectionTest,
  registerEnrollment,
} from "./devices";

beforeEach(() => {
  process.env.NODE_ENV = "test";
  process.env.TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64 =
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgs27Y743ykh9PjkxziKEWvye/1w/2NNCs3w8ZQ8zpeDqhRANCAARWXAYGhrfHpfj16UZUSmVL56OnAOBf0BU6Eu+G5gajxwlQxJkuu6kxDxjvpRwp3V7sMkfBp8D1+K0CHnqgWk1P";
  process.env.TEST_DEVICE_ACTION_TICKET_MASTER_KEY = "coldguard-test-master-key";
  delete process.env.CG_DEVICE_SIGNING_KEY_PKCS8_B64;
  delete process.env.CG_DEVICE_ACTION_TICKET_MASTER_KEY;
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
  delete process.env.CG_DEVICE_SIGNING_KEY_PKCS8_B64;
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
  delete process.env.CG_DEVICE_SIGNING_KEY_PKCS8_B64;
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

test("builds device action tickets with canonical metadata and mac", async () => {
  const ticket = await __testing.buildActionTicketForTesting({
    action: "connect",
    counter: 7,
    deviceId: "device-1",
    expiresAt: 1_700_000_300_000,
    institutionId: "institution-1",
    issuedAt: 1_700_000_000_000,
    operatorId: "firebase-user-1",
    ticketId: "ticket-1",
  });

  expect(ticket).toMatchObject({
    action: "connect",
    counter: 7,
    deviceId: "device-1",
    expiresAt: 1_700_000_300_000,
    institutionId: "institution-1",
    issuedAt: 1_700_000_000_000,
    operatorId: "firebase-user-1",
    ticketId: "ticket-1",
    v: 1,
  });
  expect(ticket.mac).toMatch(/^[0-9a-f]{64}$/);
  expect(__testing.buildActionTicketCanonicalString(ticket)).toBe(
    "1|ticket-1|device-1|institution-1|connect|1700000000000|1700000300000|7|firebase-user-1",
  );
});

test("binds device action ticket macs to the target device", async () => {
  const baseArgs = {
    action: "connect" as const,
    counter: 7,
    expiresAt: 1_700_000_300_000,
    institutionId: "institution-1",
    issuedAt: 1_700_000_000_000,
    operatorId: "firebase-user-1",
    ticketId: "ticket-1",
  };

  const first = await __testing.buildActionTicketForTesting({
    ...baseArgs,
    deviceId: "device-1",
  });
  const second = await __testing.buildActionTicketForTesting({
    ...baseArgs,
    deviceId: "device-2",
  });

  expect(first.mac).not.toBe(second.mac);
});

test("issues short-lived supervisor action tickets for enroll", async () => {
  const now = 1_700_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);

  const ctx = createMutationCtx({
    user: {
      _id: "user-1",
      displayName: "Supervisor One",
      firebaseUid: "firebase-user-1",
      institutionId: "institution-1",
      role: "Supervisor",
      staffId: null,
    },
  });

  const ticket = await (issueSupervisorActionTicket as any)._handler(ctx, {
    action: "enroll",
    deviceId: "device-1",
  });

  expect(ticket).toMatchObject({
    action: "enroll",
    counter: 1,
    deviceId: "device-1",
    expiresAt: now + 5 * 60 * 1000,
    institutionId: "institution-1",
    issuedAt: now,
    operatorId: "firebase-user-1",
    v: 1,
  });
  expect(ticket.mac).toMatch(/^[0-9a-f]{64}$/);

  jest.restoreAllMocks();
});

test("issues short-lived supervisor connect tickets for devices not yet registered", async () => {
  const now = 1_700_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);

  const ctx = createMutationCtx({
    user: {
      _id: "user-1",
      displayName: "Supervisor One",
      firebaseUid: "firebase-user-1",
      institutionId: "institution-1",
      role: "Supervisor",
      staffId: null,
    },
  });

  const ticket = await (issueSupervisorActionTicket as any)._handler(ctx, {
    action: "connect",
    deviceId: "device-1",
  });

  expect(ticket).toMatchObject({
    action: "connect",
    counter: 1,
    deviceId: "device-1",
    expiresAt: now + 5 * 60 * 1000,
    institutionId: "institution-1",
    issuedAt: now,
    operatorId: "firebase-user-1",
    v: 1,
  });
  expect(ticket.mac).toMatch(/^[0-9a-f]{64}$/);

  jest.restoreAllMocks();
});

test("rejects unauthorized device action ticket issuance for an unassigned nurse", async () => {
  const ctx = createMutationCtx({
    assignmentsByStaff: [],
    device: {
      _id: "device-row-1",
      deviceId: "device-1",
      grantVersion: 4,
      institutionId: "institution-1",
      status: "active",
    },
    user: {
      _id: "user-2",
      displayName: "Nurse One",
      firebaseUid: "firebase-user-2",
      institutionId: "institution-1",
      role: "Nurse",
      staffId: "KB1002",
    },
  });

  await expect(
    (issueDeviceActionTicket as any)._handler(ctx, {
      action: "connect",
      deviceId: "device-1",
    }),
  ).rejects.toThrow("DEVICE_ACCESS_DENIED");
});

test("issues connect action tickets at the device's current grant version", async () => {
  const now = 1_700_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);

  const ctx = createMutationCtx({
    assignmentsByStaff: [
      {
        deviceId: "device-1",
        isActive: true,
        staffId: "KB1002",
      },
    ],
    device: {
      _id: "device-row-1",
      deviceId: "device-1",
      grantVersion: 4,
      institutionId: "institution-1",
      status: "active",
    },
    user: {
      _id: "user-2",
      displayName: "Nurse One",
      firebaseUid: "firebase-user-2",
      institutionId: "institution-1",
      role: "Nurse",
      staffId: "KB1002",
    },
  });

  const ticket = await (issueDeviceActionTicket as any)._handler(ctx, {
    action: "connect",
    deviceId: "device-1",
  });

  expect(ticket).toMatchObject({
    action: "connect",
    counter: 4,
    deviceId: "device-1",
    expiresAt: now + 5 * 60 * 1000,
    institutionId: "institution-1",
    issuedAt: now,
  });

  jest.restoreAllMocks();
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

test("rejects re-enrollment for a device owned by another institution", async () => {
  const ctx = createMutationCtx({
    device: {
      _id: "device-row-1",
      deviceId: "device-1",
      grantVersion: 4,
      institutionId: "institution-2",
      status: "active",
    },
    user: {
      _id: "user-1",
      displayName: "Supervisor One",
      firebaseUid: "firebase-user-1",
      institutionId: "institution-1",
      role: "Supervisor",
      staffId: null,
    },
  });

  await expect(
    (registerEnrollment as any)._handler(ctx, {
      bleName: "ColdGuard_0001",
      deviceId: "device-1",
      firmwareVersion: "fw-1.0.0",
      macAddress: "AA:BB:CC:DD:EE:01",
      nickname: "Cold Room Alpha",
      protocolVersion: 1,
    }),
  ).rejects.toThrow("DEVICE_ACCESS_DENIED");

  expect(ctx.db.patch).not.toHaveBeenCalled();
});

test("keeps institution ownership unchanged when re-enrolling an existing device", async () => {
  const ctx = createMutationCtx({
    device: {
      _id: "device-row-1",
      deviceId: "device-1",
      grantVersion: 4,
      institutionId: "institution-1",
      status: "active",
    },
    user: {
      _id: "user-1",
      displayName: "Supervisor One",
      firebaseUid: "firebase-user-1",
      institutionId: "institution-1",
      role: "Supervisor",
      staffId: null,
    },
  });

  await (registerEnrollment as any)._handler(ctx, {
    bleName: "ColdGuard_0001",
    deviceId: "device-1",
    firmwareVersion: "fw-1.0.0",
    macAddress: "AA:BB:CC:DD:EE:01",
    nickname: "Cold Room Alpha",
    protocolVersion: 1,
  });

  expect(ctx.db.patch).toHaveBeenCalledWith(
    "device-row-1",
    expect.objectContaining({
      bleName: "ColdGuard_0001",
      firmwareVersion: "fw-1.0.0",
      grantVersion: 5,
      macAddress: "AA:BB:CC:DD:EE:01",
      nickname: "Cold Room Alpha",
      protocolVersion: 1,
      status: "active",
    }),
  );
  expect(ctx.db.patch.mock.calls[0]?.[1]).not.toHaveProperty("institutionId");
});

test("bumps device grant version before inserting new assignments", async () => {
  const now = 1_700_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);

  const ctx = createMutationCtx({
    activeAssignments: [
      {
        _id: "assignment-old-1",
        assignmentRole: "primary",
        deviceId: "device-1",
        isActive: true,
      },
    ],
    device: {
      _id: "device-row-1",
      deviceId: "device-1",
      grantVersion: 4,
      institutionId: "institution-1",
      nickname: "Cold Room Alpha",
      status: "active",
    },
    nurses: [
      {
        displayName: "Akosua Mensah",
        isActive: true,
        role: "Nurse",
        staffId: "KB1001",
      },
      {
        displayName: "Mariam Fuseini",
        isActive: true,
        role: "Nurse",
        staffId: "KB1002",
      },
    ],
    user: {
      _id: "user-1",
      displayName: "Supervisor One",
      firebaseUid: "firebase-user-1",
      institutionId: "institution-1",
      role: "Supervisor",
      staffId: null,
    },
  });

  await (assignDevice as any)._handler(ctx, {
    deviceId: "device-1",
    primaryStaffId: "KB1001",
    viewerStaffIds: ["KB1002"],
  });

  expect(ctx.db.patch).toHaveBeenCalledWith("assignment-old-1", {
    isActive: false,
    revokedAt: now,
  });
  expect(ctx.db.patch).toHaveBeenCalledWith("device-row-1", {
    grantVersion: 5,
    updatedAt: now,
  });
  expect(ctx.db.patch.mock.invocationCallOrder[1]).toBeLessThan(ctx.db.insert.mock.invocationCallOrder[0]);

  jest.restoreAllMocks();
});

test("rejects connection test writes from an unassigned nurse", async () => {
  const ctx = createMutationCtx({
    assignmentsByStaff: [],
    device: {
      _id: "device-row-1",
      deviceId: "device-1",
      grantVersion: 4,
      institutionId: "institution-1",
      lastSeenAt: 100,
      status: "active",
    },
    user: {
      _id: "user-2",
      displayName: "Nurse One",
      firebaseUid: "firebase-user-2",
      institutionId: "institution-1",
      role: "Nurse",
      staffId: "KB1002",
    },
  });

  await expect(
    (recordConnectionTest as any)._handler(ctx, {
      deviceId: "device-1",
      lastSeenAt: 200,
      status: "success",
      summary: "Connection test passed",
      transport: "ble",
    }),
  ).rejects.toThrow("DEVICE_ACCESS_DENIED");

  expect(ctx.db.patch).not.toHaveBeenCalled();
  expect(ctx.db.insert).not.toHaveBeenCalled();
});

test("allows connection test writes from an assigned nurse", async () => {
  const now = 1_700_000_000_100;
  jest.spyOn(Date, "now").mockReturnValue(now);

  const ctx = createMutationCtx({
    assignmentsByStaff: [
      {
        deviceId: "device-1",
        isActive: true,
        staffId: "KB1002",
      },
    ],
    device: {
      _id: "device-row-1",
      deviceId: "device-1",
      grantVersion: 4,
      institutionId: "institution-1",
      lastSeenAt: 100,
      status: "active",
    },
    user: {
      _id: "user-2",
      displayName: "Nurse One",
      firebaseUid: "firebase-user-2",
      institutionId: "institution-1",
      role: "Nurse",
      staffId: "KB1002",
    },
  });

  await (recordConnectionTest as any)._handler(ctx, {
    deviceId: "device-1",
    lastSeenAt: 200,
    status: "success",
    summary: "Connection test passed",
    transport: "ble",
  });

  expect(ctx.db.patch).toHaveBeenCalledWith("device-row-1", {
    lastConnectionTestAt: now,
    lastConnectionTestStatus: "success",
    lastSeenAt: 200,
    updatedAt: now,
  });

  jest.restoreAllMocks();
});

function createMutationCtx(args: {
  assignmentsByStaff?: any[];
  activeAssignments?: any[];
  device?: any;
  nurses?: any[];
  user: {
    _id: string;
    displayName: string | null;
    firebaseUid: string;
    institutionId: string;
    role: "Nurse" | "Supervisor";
    staffId: string | null;
  };
}) {
  const patch = jest.fn(async () => undefined);
  const insert = jest.fn(async () => "inserted-row");
  const query = jest.fn((table: string) => ({
    withIndex: (indexName: string, buildIndex?: (queryBuilder: any) => unknown) => {
      buildIndex?.(createIndexBuilder());

      if (table === "users" && indexName === "by_firebase_uid") {
        return {
          unique: async () => ({
            _id: args.user._id,
            displayName: args.user.displayName,
            firebaseUid: args.user.firebaseUid,
            institutionId: args.user.institutionId,
            role: args.user.role,
            staffId: args.user.staffId,
          }),
        };
      }

      if (table === "devices" && indexName === "by_device_id") {
        return {
          unique: async () => args.device ?? null,
        };
      }

      if (table === "deviceAssignments" && indexName === "by_institution_staff_active") {
        return {
          collect: async () => args.assignmentsByStaff ?? [],
        };
      }

      if (table === "deviceAssignments" && indexName === "by_device_active") {
        return {
          collect: async () => args.activeAssignments ?? [],
        };
      }

      if (table === "institutionCredentials" && indexName === "by_institution_staff_id") {
        return {
          collect: async () => args.nurses ?? [],
        };
      }

      throw new Error(`Unexpected query ${table}:${indexName}`);
    },
  }));

  return {
    auth: {
      getUserIdentity: jest.fn(async () => ({ subject: args.user.firebaseUid })),
    },
    db: {
      insert,
      patch,
      query,
    },
  };
}

function createIndexBuilder() {
  return {
    eq() {
      return this;
    },
  };
}
