import {
  getDeviceById,
  getDevicesForInstitution,
  replaceCachedDevicesForInstitution,
  saveDevicesForInstitution,
  updateDeviceConnectionTestStatus,
} from "./device-repository";

const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetAllAsync: jest.Mock<any, any> = jest.fn(async () => []);
const mockGetFirstAsync: jest.Mock<any, any> = jest.fn(async () => null);
const mockWithExclusiveTransactionAsync: jest.Mock<any, any> = jest.fn(async (task) =>
  task({
    runAsync: mockRunAsync,
  }),
);

jest.mock("./client", () => ({
  initializeSQLite: jest.fn(async () => ({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    withExclusiveTransactionAsync: mockWithExclusiveTransactionAsync,
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

  expect(mockWithExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
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
      },
    ],
  });

  expect(mockWithExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  expect(mockRunAsync).toHaveBeenNthCalledWith(
    1,
    "DELETE FROM devices WHERE institution_id = ?",
    "institution-1",
  );
});

test("propagates insert failures from the exclusive transaction helper", async () => {
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
        },
      ],
    }),
  ).rejects.toThrow("insert failed");

  expect(mockWithExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  expect(mockRunAsync).toHaveBeenNthCalledWith(
    1,
    "DELETE FROM devices WHERE institution_id = ?",
    "institution-1",
  );
});

test("loads devices by institution id or name", async () => {
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
    },
  ]);
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
