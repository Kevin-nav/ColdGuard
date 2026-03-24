import {
  getDeviceById,
  getDevicesForInstitution,
  replaceCachedDevicesForInstitution,
  saveDevicesForInstitution,
  updateDeviceConnectionSyncState,
  updateDeviceConnectionTestStatus,
} from "./device-repository";

const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetAllAsync: jest.Mock<any, any> = jest.fn(async () => []);
const mockGetFirstAsync: jest.Mock<any, any> = jest.fn(async () => null);
const mockWithTransactionAsync: jest.Mock<any, any> = jest.fn(async (task) => task());

jest.mock("./client", () => ({
  initializeSQLite: jest.fn(async () => ({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    withTransactionAsync: mockWithTransactionAsync,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("saves legacy seeded devices for an institution", async () => {
  await saveDevicesForInstitution("Korle-Bu Teaching Hospital", [
    {
      id: "d1",
      nickname: "Cold Room A",
      macAddress: "AA:BB:CC:DD:01",
      currentTempC: 4.5,
      mktStatus: "safe",
      batteryLevel: 92,
      doorOpen: false,
      lastSeenAt: 1000,
    },
  ]);

  expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
  expect(mockRunAsync).toHaveBeenNthCalledWith(
    1,
    "DELETE FROM devices WHERE institution_id = ?",
    "Korle-Bu Teaching Hospital",
  );
  expect(mockRunAsync).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining("INSERT INTO devices"),
    "d1",
    "Korle-Bu Teaching Hospital",
    "Korle-Bu Teaching Hospital",
    "Cold Room A",
    "AA:BB:CC:DD:01",
    "legacy-fw-unknown",
    1,
    "enrolled",
    1,
    "viewer",
    null,
    null,
    "[]",
    4.5,
    "safe",
    92,
    0,
    1000,
    null,
    "idle",
    "idle",
    null,
    null,
    null,
  );
});

test("replaces cached backend-backed devices for an institution", async () => {
  await replaceCachedDevicesForInstitution({
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
    devices: [
      {
        id: "device-1",
        nickname: "Cold Room Alpha",
        macAddress: "AA:BB:CC:DD:EE:01",
        firmwareVersion: "fw-1.0.0",
        protocolVersion: 1,
        deviceStatus: "enrolled",
        grantVersion: 4,
        accessRole: "manager",
        primaryAssigneeName: "Akosua Mensah",
        primaryAssigneeStaffId: "KB1001",
        viewerNames: ["Mariam Fuseini"],
        currentTempC: 4.4,
        mktStatus: "safe",
        batteryLevel: 91,
        doorOpen: false,
        lastSeenAt: 1200,
        lastConnectionTestAt: 1250,
        lastConnectionTestStatus: "success",
        lastConnectionSyncStatus: "synced",
        lastConnectionSyncUpdatedAt: 1260,
        lastConnectionSyncFailureStage: null,
        lastConnectionSyncError: null,
      },
    ],
  });

  expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
  expect(mockRunAsync).toHaveBeenNthCalledWith(
    1,
    "DELETE FROM devices WHERE institution_id = ?",
    "institution-1",
  );
});

test("propagates insert failures from the transaction helper", async () => {
  mockRunAsync.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("insert failed"));

  await expect(
    replaceCachedDevicesForInstitution({
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      devices: [
        {
          id: "device-1",
          nickname: "Cold Room Alpha",
          macAddress: "AA:BB:CC:DD:EE:01",
          firmwareVersion: "fw-1.0.0",
          protocolVersion: 1,
          deviceStatus: "enrolled",
          grantVersion: 4,
          accessRole: "manager",
          primaryAssigneeName: "Akosua Mensah",
          primaryAssigneeStaffId: "KB1001",
          viewerNames: ["Mariam Fuseini"],
          currentTempC: 4.4,
          mktStatus: "safe",
          batteryLevel: 91,
          doorOpen: false,
          lastSeenAt: 1200,
          lastConnectionTestAt: 1250,
          lastConnectionTestStatus: "success",
          lastConnectionSyncStatus: "idle",
          lastConnectionSyncUpdatedAt: null,
          lastConnectionSyncFailureStage: null,
          lastConnectionSyncError: null,
        },
      ],
    }),
  ).rejects.toThrow("insert failed");

  expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
  expect(mockRunAsync).toHaveBeenNthCalledWith(
    1,
    "DELETE FROM devices WHERE institution_id = ?",
    "institution-1",
  );
});

test("loads devices by institution id and queries legacy empty-string rows", async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      id: "d1",
      institution_id: "institution-1",
      institution_name: "Korle-Bu Teaching Hospital",
      nickname: "Cold Room A",
      mac_address: "AA:BB:CC:DD:01",
      firmware_version: "fw-1.0.0",
      protocol_version: 1,
      device_status: "enrolled",
      grant_version: 2,
      access_role: "primary",
      primary_assignee_name: "Akosua Mensah",
      primary_assignee_staff_id: "KB1001",
      viewer_names_json: "[\"Mariam Fuseini\"]",
      current_temp_c: 4.5,
      mkt_status: "safe",
      battery_level: 92,
      door_open: 0,
      last_seen_at: 1000,
      last_connection_test_at: 1100,
      last_connection_test_status: "success",
      last_connection_sync_status: "failed",
      last_connection_sync_updated_at: 1150,
      last_connection_sync_failure_stage: "record_connection_test",
      last_connection_sync_error: "convex unavailable",
    },
  ]);

  await expect(getDevicesForInstitution("institution-1")).resolves.toEqual([
    {
      id: "d1",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      nickname: "Cold Room A",
      macAddress: "AA:BB:CC:DD:01",
      firmwareVersion: "fw-1.0.0",
      protocolVersion: 1,
      status: "enrolled",
      deviceStatus: "enrolled",
      grantVersion: 2,
      accessRole: "primary",
      primaryAssigneeName: "Akosua Mensah",
      primaryAssigneeStaffId: "KB1001",
      viewerNames: ["Mariam Fuseini"],
      currentTempC: 4.5,
      mktStatus: "safe",
      batteryLevel: 92,
      doorOpen: false,
      lastSeenAt: 1000,
      lastConnectionTestAt: 1100,
      lastConnectionTestStatus: "success",
      lastConnectionSyncStatus: "failed",
      lastConnectionSyncUpdatedAt: 1150,
      lastConnectionSyncFailureStage: "record_connection_test",
      lastConnectionSyncError: "convex unavailable",
    },
  ]);

  expect(mockGetAllAsync).toHaveBeenCalledWith(
    expect.stringContaining("COALESCE(NULLIF(institution_id, ''), ?) AS institution_id"),
    "institution-1",
    "institution-1",
  );
});

test("loads a single device by id", async () => {
  mockGetFirstAsync.mockResolvedValue({
    id: "d1",
    institution_id: "institution-1",
    institution_name: "Korle-Bu Teaching Hospital",
    nickname: "Cold Room A",
    mac_address: "AA:BB:CC:DD:01",
    firmware_version: "fw-1.0.0",
    protocol_version: 1,
    device_status: "enrolled",
    grant_version: 2,
    access_role: "viewer",
    primary_assignee_name: null,
    primary_assignee_staff_id: null,
    viewer_names_json: "[]",
    current_temp_c: 4.5,
    mkt_status: "safe",
    battery_level: 92,
    door_open: 0,
    last_seen_at: 1000,
    last_connection_test_at: null,
    last_connection_test_status: null,
    last_connection_sync_status: "idle",
    last_connection_sync_updated_at: null,
    last_connection_sync_failure_stage: null,
    last_connection_sync_error: null,
  });

  await expect(getDeviceById("d1")).resolves.toEqual(
    expect.objectContaining({
      id: "d1",
      institutionId: "institution-1",
      accessRole: "viewer",
      lastConnectionTestStatus: "idle",
    }),
  );
});

test("loads a single device by id with legacy institution normalization when institution id is provided", async () => {
  mockGetFirstAsync.mockResolvedValue({
    id: "d1",
    institution_id: "institution-1",
    institution_name: "Korle-Bu Teaching Hospital",
    nickname: "Cold Room A",
    mac_address: "AA:BB:CC:DD:01",
    firmware_version: "fw-1.0.0",
    protocol_version: 1,
    device_status: "enrolled",
    grant_version: 2,
    access_role: "viewer",
    primary_assignee_name: null,
    primary_assignee_staff_id: null,
    viewer_names_json: "[]",
    current_temp_c: 4.5,
    mkt_status: "safe",
    battery_level: 92,
    door_open: 0,
    last_seen_at: 1000,
    last_connection_test_at: null,
    last_connection_test_status: null,
  });

  await expect(getDeviceById("d1", "institution-1")).resolves.toEqual(
    expect.objectContaining({
      institutionId: "institution-1",
    }),
  );

  expect(mockGetFirstAsync).toHaveBeenCalledWith(
    expect.stringContaining("COALESCE(NULLIF(institution_id, ''), ?) AS institution_id"),
    "institution-1",
    "d1",
  );
});

test("updates cached connection test status", async () => {
  await updateDeviceConnectionTestStatus({
    deviceId: "device-1",
    testedAt: 5000,
    status: "running",
  });

  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("UPDATE devices"),
    5000,
    "running",
    "device-1",
  );
});

test("updates cached connection sync status", async () => {
  await updateDeviceConnectionSyncState({
    deviceId: "device-1",
    errorMessage: "convex unavailable",
    failureStage: "record_connection_test",
    status: "failed",
    updatedAt: 6000,
  });

  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("UPDATE devices"),
    "failed",
    6000,
    "record_connection_test",
    "convex unavailable",
    "device-1",
  );
});
