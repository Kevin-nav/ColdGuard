import { getDevicesForInstitution, saveDevicesForInstitution } from "./device-repository";

const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetAllAsync: jest.Mock<any, any> = jest.fn(async () => []);

jest.mock("./client", () => ({
  initializeSQLite: jest.fn(async () => ({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("saves devices for an institution", async () => {
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

  expect(mockRunAsync).toHaveBeenCalled();
});

test("loads devices for an institution", async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      id: "d1",
      institution_name: "Korle-Bu Teaching Hospital",
      nickname: "Cold Room A",
      mac_address: "AA:BB:CC:DD:01",
      current_temp_c: 4.5,
      mkt_status: "safe",
      battery_level: 92,
      door_open: 0,
      last_seen_at: 1000,
    },
  ]);

  await expect(getDevicesForInstitution("Korle-Bu Teaching Hospital")).resolves.toEqual([
    {
      id: "d1",
      institutionName: "Korle-Bu Teaching Hospital",
      nickname: "Cold Room A",
      macAddress: "AA:BB:CC:DD:01",
      currentTempC: 4.5,
      mktStatus: "safe",
      batteryLevel: 92,
      doorOpen: false,
      lastSeenAt: 1000,
    },
  ]);
});
