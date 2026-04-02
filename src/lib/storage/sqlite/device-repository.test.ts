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
      latestSequence: 1,
      lastSeenAt: 1000,
      recordedAt: 1000,
      rtcIso: "2026-04-01T00:00:00.000Z",
      sdCardMounted: true,
      timeSource: "rtc",
    },
  ]);

  expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
  expect(mockRunAsync).toHaveBeenNthCalledWith(
    1,
    "DELETE FROM devices WHERE institution_id = ?",
    "Korle-Bu Teaching Hospital",
  );
  expect(mockRunAsync.mock.calls[1][0]).toContain("INSERT INTO devices");
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
        latestSequence: 8,
        lastSeenAt: 1200,
        recordedAt: 1200,
        rtcIso: "2026-04-01T00:00:00.000Z",
        sdCardMounted: false,
        timeSource: "rtc",
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
          latestSequence: 8,
          lastSeenAt: 1200,
          recordedAt: 1200,
          rtcIso: "2026-04-01T00:00:00.000Z",
          sdCardMounted: false,
          timeSource: "rtc",
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
  expect(mockRunAsync.mock.calls[0][0]).toBe("DELETE FROM devices WHERE institution_id = ?");
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
      latest_sequence: 1,
      recorded_at: 1000,
      rtc_iso: "2026-04-01T00:00:00.000Z",
      time_source: "rtc",
      sd_card_mounted: 0,
      last_seen_at: 1000,
      last_connection_test_at: 1100,
      last_connection_test_status: "success",
      last_connection_sync_status: "failed",
      last_connection_sync_updated_at: 1150,
      last_connection_sync_failure_stage: "record_connection_test",
      last_connection_sync_error: "convex unavailable",
    },
  ]);

  await expect(getDevicesForInstitution("institution-1")).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "d1",
        institutionId: "institution-1",
        accessRole: "primary",
        lastConnectionTestStatus: "success",
      }),
    ]),
  );

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
      latest_sequence: 1,
      recorded_at: 1000,
      rtc_iso: "2026-04-01T00:00:00.000Z",
      time_source: "rtc",
      sd_card_mounted: 0,
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
    latest_sequence: 1,
    recorded_at: 1000,
    rtc_iso: "2026-04-01T00:00:00.000Z",
    time_source: "rtc",
    sd_card_mounted: 1,
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
