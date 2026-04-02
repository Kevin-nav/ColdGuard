import { getRecentReadingsForDevice, getRecentReadingsForInstitution, saveReadings } from "./reading-repository";

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

test("saves readings", async () => {
  await saveReadings([
    {
      id: "r1",
      institutionName: "Korle-Bu Teaching Hospital",
      deviceId: "d1",
      currentTempC: 4.2,
      mktStatus: "safe",
      recordedAt: 1000,
      rtcIso: "2026-04-01T00:00:00.000Z",
      sdCardMounted: true,
      sequence: 1,
      timeSource: "rtc",
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
      current_temp_c: 4.2,
      mkt_status: "safe",
      recorded_at: 1000,
      rtc_iso: "2026-04-01T00:00:00.000Z",
      sd_card_mounted: 1,
      sequence: 1,
      time_source: "rtc",
    },
  ]);

  await expect(getRecentReadingsForInstitution("Korle-Bu Teaching Hospital")).resolves.toEqual([
    {
      id: "r1",
      institutionName: "Korle-Bu Teaching Hospital",
      deviceId: "d1",
      currentTempC: 4.2,
      mktStatus: "safe",
      recordedAt: 1000,
      rtcIso: "2026-04-01T00:00:00.000Z",
      sdCardMounted: false,
      sequence: 1,
      timeSource: "rtc",
    },
  ]);
});

test("loads recent readings for a device", async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      id: "r2",
      institution_name: "Korle-Bu Teaching Hospital",
      device_id: "d1",
      current_temp_c: 4.4,
      mkt_status: "safe",
      recorded_at: 2000,
      rtc_iso: "2026-04-01T00:10:00.000Z",
      sd_card_mounted: 0,
      sequence: 2,
      time_source: "rtc",
    },
  ]);

  await expect(getRecentReadingsForDevice("d1")).resolves.toEqual([
    {
      id: "r2",
      institutionName: "Korle-Bu Teaching Hospital",
      deviceId: "d1",
      currentTempC: 4.4,
      mktStatus: "safe",
      recordedAt: 2000,
      rtcIso: "2026-04-01T00:10:00.000Z",
      sdCardMounted: false,
      sequence: 2,
      timeSource: "rtc",
    },
  ]);
});
