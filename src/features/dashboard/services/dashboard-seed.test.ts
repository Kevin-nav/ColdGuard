import { seedDashboardDataForInstitution } from "./dashboard-seed";

const mockGetDevicesForInstitution = jest.fn();
const mockSaveDevicesForInstitution = jest.fn();
const mockSaveReadings = jest.fn();

jest.mock("../../../lib/storage/sqlite/device-repository", () => ({
  getDevicesForInstitution: (institutionId: string) => mockGetDevicesForInstitution(institutionId),
  saveDevicesForInstitution: (...args: unknown[]) => mockSaveDevicesForInstitution(...args),
}));

jest.mock("../../../lib/storage/sqlite/reading-repository", () => ({
  saveReadings: (readings: unknown) => mockSaveReadings(readings),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("seeds devices under the institution id while preserving the institution name", async () => {
  mockGetDevicesForInstitution
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "institution-1-device-1" }]);

  await seedDashboardDataForInstitution({
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
  });

  expect(mockGetDevicesForInstitution).toHaveBeenNthCalledWith(1, "institution-1");
  expect(mockSaveDevicesForInstitution).toHaveBeenCalledWith(
    "institution-1",
    expect.any(Array),
    "Korle-Bu Teaching Hospital",
  );
  expect(mockGetDevicesForInstitution).toHaveBeenNthCalledWith(2, "institution-1");
  expect(mockSaveReadings).toHaveBeenCalled();
});
