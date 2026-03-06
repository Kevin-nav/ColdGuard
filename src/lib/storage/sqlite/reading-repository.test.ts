const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetAllAsync: jest.Mock<any, any> = jest.fn(async () => []);

jest.mock("./client", () => ({
  initializeSQLite: jest.fn(async () => ({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
  })),
}));

const { getRecentReadingsForInstitution, saveReadings } = require("./reading-repository");

beforeEach(() => {
  jest.clearAllMocks();
});

test("saves readings", async () => {
  await saveReadings([
    {
      id: "r1",
      institutionName: "Korle-Bu Teaching Hospital",
      deviceId: "d1",
      tempC: 4.2,
      mktC: 5,
      doorOpen: false,
      recordedAt: 1000,
      sessionId: null,
    },
  ]);

  expect(mockRunAsync).toHaveBeenCalled();
});

test("loads recent readings for an institution", async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      id: "r1",
      institution_name: "Korle-Bu Teaching Hospital",
      device_id: "d1",
      temp_c: 4.2,
      mkt_c: 5,
      door_open: 0,
      recorded_at: 1000,
      session_id: null,
    },
  ]);

  await expect(getRecentReadingsForInstitution("Korle-Bu Teaching Hospital")).resolves.toEqual([
    {
      id: "r1",
      institutionName: "Korle-Bu Teaching Hospital",
      deviceId: "d1",
      tempC: 4.2,
      mktC: 5,
      doorOpen: false,
      recordedAt: 1000,
      sessionId: null,
    },
  ]);
});
