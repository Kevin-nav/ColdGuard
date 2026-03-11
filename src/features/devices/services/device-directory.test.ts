import {
  ensureDeviceActionTicket,
  ensureDeviceConnectionGrant,
  ensureSupervisorActionTicket,
  ensureSupervisorAdminGrant,
  listAssignableNurses,
  syncVisibleDevices,
} from "./device-directory";

const mockQuery = jest.fn();
const mockMutation = jest.fn();
const mockReplaceCachedDevicesForInstitution = jest.fn();
const mockGetDevicesForInstitution = jest.fn();
const mockGetConnectionGrant = jest.fn();
const mockGetDeviceActionTicket = jest.fn();
const mockSaveConnectionGrant = jest.fn();
const mockSaveDeviceActionTicket = jest.fn();

jest.mock("../../../lib/convex/client", () => ({
  getConvexClient: jest.fn(() => ({
    mutation: mockMutation,
    query: mockQuery,
  })),
}));

jest.mock("../../../lib/storage/sqlite/device-repository", () => ({
  getDevicesForInstitution: (institutionIdentifier: string) =>
    mockGetDevicesForInstitution(institutionIdentifier),
  replaceCachedDevicesForInstitution: (args: unknown) => mockReplaceCachedDevicesForInstitution(args),
}));

jest.mock("../../../lib/storage/sqlite/connection-grant-repository", () => ({
  getConnectionGrant: (...args: unknown[]) => mockGetConnectionGrant(...args),
  getDeviceActionTicket: (...args: unknown[]) => mockGetDeviceActionTicket(...args),
  saveConnectionGrant: (args: unknown) => mockSaveConnectionGrant(args),
  saveDeviceActionTicket: (args: unknown) => mockSaveDeviceActionTicket(args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("syncs role-scoped devices into the local cache", async () => {
  mockGetDevicesForInstitution.mockResolvedValue([
    {
      id: "device-1",
      nickname: "Cold Room Alpha",
      macAddress: "AA:BB:CC:DD:01",
      currentTempC: 4.6,
      mktStatus: "safe",
      batteryLevel: 93,
      doorOpen: false,
      lastSeenAt: 1000,
      firmwareVersion: "fw-1.0.0",
      protocolVersion: 1,
      deviceStatus: "enrolled",
      grantVersion: 2,
      accessRole: "viewer",
      primaryAssigneeName: null,
      primaryAssigneeStaffId: null,
      viewerNames: [],
      lastConnectionTestAt: null,
      lastConnectionTestStatus: "idle",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
    },
  ]);
  mockQuery.mockResolvedValue([
    {
      assignmentRole: "primary",
      bleName: "ColdGuard_A100",
      deviceId: "device-1",
      firmwareVersion: "fw-1.0.0",
      grantVersion: 2,
      lastConnectionTestAt: null,
      lastSeenAt: 2000,
      nickname: "Cold Room Alpha",
      primaryAssigneeName: "Akosua Mensah",
      primaryStaffId: "KB1001",
      status: "active",
      viewerAssignments: [{ displayName: "Mariam Fuseini", staffId: "KB1003" }],
    },
  ]);

  await expect(
    syncVisibleDevices({
      firebaseUid: "firebase-u1",
      displayName: "Akosua Mensah",
      email: "akosua@example.com",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      staffId: "KB1001",
      role: "Nurse",
      lastUpdatedAt: 1,
    }),
  ).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "device-1",
        nickname: "Cold Room Alpha",
      }),
    ]),
  );

  expect(mockReplaceCachedDevicesForInstitution).toHaveBeenCalledWith(
    expect.objectContaining({
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
    }),
  );
});

test("preserves a cached success status when the server still reports idle", async () => {
  mockGetDevicesForInstitution.mockResolvedValue([
    {
      id: "device-1",
      nickname: "Cold Room Alpha",
      macAddress: "AA:BB:CC:DD:01",
      currentTempC: 4.6,
      mktStatus: "safe",
      batteryLevel: 93,
      doorOpen: false,
      lastSeenAt: 1000,
      firmwareVersion: "fw-1.0.0",
      protocolVersion: 1,
      deviceStatus: "enrolled",
      grantVersion: 2,
      accessRole: "viewer",
      primaryAssigneeName: null,
      primaryAssigneeStaffId: null,
      viewerNames: [],
      lastConnectionTestAt: 1100,
      lastConnectionTestStatus: "success",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
    },
  ]);
  mockQuery.mockResolvedValue([
    {
      assignmentRole: "primary",
      bleName: "ColdGuard_A100",
      deviceId: "device-1",
      firmwareVersion: "fw-1.0.0",
      grantVersion: 2,
      lastConnectionTestAt: 1100,
      lastConnectionTestStatus: "idle",
      lastSeenAt: 2000,
      nickname: "Cold Room Alpha",
      primaryAssigneeName: "Akosua Mensah",
      primaryStaffId: "KB1001",
      status: "active",
      viewerAssignments: [],
    },
  ]);

  await syncVisibleDevices({
    firebaseUid: "firebase-u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  });

  expect(mockReplaceCachedDevicesForInstitution).toHaveBeenCalledWith(
    expect.objectContaining({
      devices: [
        expect.objectContaining({
          id: "device-1",
          lastConnectionTestAt: 1100,
          lastConnectionTestStatus: "success",
        }),
      ],
    }),
  );
});

test("lists assignable nurses from convex", async () => {
  mockQuery.mockResolvedValue([
    {
      displayName: "Akosua Mensah",
      role: "Nurse",
      staffId: "KB1001",
    },
  ]);

  await expect(listAssignableNurses()).resolves.toEqual([
    {
      displayName: "Akosua Mensah",
      role: "Nurse",
      staffId: "KB1001",
    },
  ]);
});

test("reuses a cached supervisor admin grant when still valid", async () => {
  mockGetConnectionGrant.mockResolvedValue({
    payloadJson: JSON.stringify({
      deviceId: "device-1",
      exp: Date.now() + 60_000,
      grantVersion: 1,
      institutionId: "institution-1",
      issuedToFirebaseUid: "firebase-u1",
      permission: "manage",
      role: "Supervisor",
      token: "grant-1",
      v: 1,
    }),
    expiresAt: Date.now() + 60_000,
  });

  await expect(
    ensureSupervisorAdminGrant(
      {
        firebaseUid: "firebase-u1",
        displayName: "Yaw Boateng",
        email: "yaw@example.com",
        institutionId: "institution-1",
        institutionName: "Korle-Bu Teaching Hospital",
        staffId: "KB1002",
        role: "Supervisor",
        lastUpdatedAt: 1,
      },
      "device-1",
    ),
  ).resolves.toEqual(
    expect.objectContaining({
      permission: "manage",
      token: "grant-1",
    }),
  );

  expect(mockMutation).not.toHaveBeenCalled();
});

test("fetches and caches device grants when no current cache exists", async () => {
  mockGetConnectionGrant.mockResolvedValue(null);
  mockMutation.mockResolvedValue({
    deviceId: "device-1",
    exp: Date.now() + 60_000,
    grantVersion: 2,
    institutionId: "institution-1",
    issuedToFirebaseUid: "firebase-u1",
    permission: "connect",
    role: "Nurse",
    token: "grant-2",
    v: 1,
  });

  await expect(ensureDeviceConnectionGrant("device-1")).resolves.toEqual(
    expect.objectContaining({
      deviceId: "device-1",
      token: "grant-2",
    }),
  );

  expect(mockSaveConnectionGrant).toHaveBeenCalledWith(
    expect.objectContaining({
      scopeType: "device",
      scopeId: "device-1",
    }),
  );
});

test("reuses a cached supervisor action ticket when still valid", async () => {
  mockGetDeviceActionTicket.mockResolvedValue({
    action: "decommission",
    payloadJson: JSON.stringify({
      action: "decommission",
      counter: 2,
      deviceId: "device-1",
      expiresAt: Date.now() + 60_000,
      institutionId: "institution-1",
      issuedAt: Date.now(),
      mac: "abc123",
      operatorId: "firebase-u1",
      ticketId: "ticket-1",
      v: 1,
    }),
    expiresAt: Date.now() + 60_000,
  });

  await expect(
    ensureSupervisorActionTicket(
      {
        firebaseUid: "firebase-u1",
        displayName: "Yaw Boateng",
        email: "yaw@example.com",
        institutionId: "institution-1",
        institutionName: "Korle-Bu Teaching Hospital",
        staffId: "KB1002",
        role: "Supervisor",
        lastUpdatedAt: 1,
      },
      "device-1",
      "decommission",
    ),
  ).resolves.toEqual(
    expect.objectContaining({
      action: "decommission",
      ticketId: "ticket-1",
    }),
  );

  expect(mockMutation).not.toHaveBeenCalled();
});

test("fetches and caches device action tickets when no current cache exists", async () => {
  mockGetDeviceActionTicket.mockResolvedValue(null);
  mockMutation.mockResolvedValue({
    action: "connect",
    counter: 2,
    deviceId: "device-1",
    expiresAt: Date.now() + 60_000,
    institutionId: "institution-1",
    issuedAt: Date.now(),
    mac: "abc123",
    operatorId: "firebase-u1",
    ticketId: "ticket-2",
    v: 1,
  });

  await expect(ensureDeviceActionTicket("device-1", "connect")).resolves.toEqual(
    expect.objectContaining({
      action: "connect",
      ticketId: "ticket-2",
    }),
  );

  expect(mockSaveDeviceActionTicket).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "connect",
      scopeType: "device",
      scopeId: "device-1",
    }),
  );
});
