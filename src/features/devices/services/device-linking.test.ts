import {
  buildEnrollmentRouteParams,
  consumePendingDeviceEnrollment,
  parseDeviceEnrollmentLink,
  persistPendingDeviceEnrollment,
} from "./device-linking";

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock("../../../lib/storage/secure-store", () => ({
  clearPendingDeviceEnrollment: () => mockDeleteItemAsync(),
  getPendingDeviceEnrollment: () => mockGetItemAsync(),
  savePendingDeviceEnrollment: (value: string) => mockSetItemAsync(value),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItemAsync.mockResolvedValue(null);
  mockSetItemAsync.mockResolvedValue(undefined);
  mockDeleteItemAsync.mockResolvedValue(undefined);
});

test("parses coldguard.org device enrollment links", () => {
  expect(
    parseDeviceEnrollmentLink("https://coldguard.org/device/CG-ESP32-A100?claim=claim-alpha-100&v=1"),
  ).toEqual({
    claim: "claim-alpha-100",
    deviceId: "CG-ESP32-A100",
    qrPayload: "coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1",
    sourceUrl: "https://coldguard.org/device/CG-ESP32-A100?claim=claim-alpha-100&v=1",
    version: "1",
  });
});

test("parses custom-scheme device enrollment links", () => {
  expect(parseDeviceEnrollmentLink("coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1")).toEqual(
    expect.objectContaining({
      claim: "claim-alpha-100",
      deviceId: "CG-ESP32-A100",
      version: "1",
    }),
  );
});

test("builds router params from an enrollment payload", () => {
  expect(
    buildEnrollmentRouteParams({
      claim: "claim-alpha-100",
      deviceId: "CG-ESP32-A100",
      qrPayload: "coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1",
      sourceUrl: "https://coldguard.org/device/CG-ESP32-A100?claim=claim-alpha-100&v=1",
      version: "1",
    }),
  ).toEqual({
    claim: "claim-alpha-100",
    deviceId: "CG-ESP32-A100",
    payload: "coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1",
    v: "1",
  });
});

test("persists and consumes a pending enrollment payload", async () => {
  const payload = {
    claim: "claim-alpha-100",
    deviceId: "CG-ESP32-A100",
    qrPayload: "coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1",
    sourceUrl: "https://coldguard.org/device/CG-ESP32-A100?claim=claim-alpha-100&v=1",
    version: "1",
  };

  await persistPendingDeviceEnrollment(payload);

  expect(mockSetItemAsync).toHaveBeenCalledWith(JSON.stringify(payload));

  mockGetItemAsync.mockResolvedValue(JSON.stringify(payload));

  await expect(consumePendingDeviceEnrollment()).resolves.toEqual(payload);
  expect(mockDeleteItemAsync).toHaveBeenCalled();
});
