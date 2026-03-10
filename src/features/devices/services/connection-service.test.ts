import {
  MockColdGuardBleClient,
  decommissionColdGuardDevice,
  enrollColdGuardDevice,
  parseDeviceQrPayload,
  runColdGuardConnectionTest,
} from "./connection-service";
import { resetMockHardwareRegistry } from "./mock-hardware-registry";

const mockDeleteConnectionGrant = jest.fn();
const mockGetDeviceById = jest.fn();
const mockSaveDeviceConnectionSnapshot = jest.fn();
const mockUpdateDeviceConnectionTestStatus = jest.fn();
const mockGetClinicHandshakeToken = jest.fn();
const mockEnsureDeviceConnectionGrant = jest.fn();
const mockEnsureSupervisorAdminGrant = jest.fn();
const mockRegisterEnrolledDevice = jest.fn();
const mockDecommissionManagedDevice = jest.fn();
const mockRecordDeviceConnectionTest = jest.fn();
const mockFetch = jest.fn();
const mockWifiBridgeRelease = jest.fn();

Object.defineProperty(global, "fetch", {
  value: (...args: unknown[]) => mockFetch(...args),
  writable: true,
});

jest.mock("../../../lib/storage/sqlite/connection-grant-repository", () => ({
  deleteConnectionGrant: (...args: unknown[]) => mockDeleteConnectionGrant(...args),
}));

jest.mock("../../../lib/storage/sqlite/device-repository", () => ({
  getDeviceById: (...args: unknown[]) => mockGetDeviceById(...args),
  saveDeviceConnectionSnapshot: (...args: unknown[]) => mockSaveDeviceConnectionSnapshot(...args),
  updateDeviceConnectionTestStatus: (...args: unknown[]) => mockUpdateDeviceConnectionTestStatus(...args),
}));

jest.mock("../../../lib/storage/secure-store", () => ({
  getClinicHandshakeToken: () => mockGetClinicHandshakeToken(),
}));

jest.mock("./device-directory", () => ({
  ensureDeviceConnectionGrant: (...args: unknown[]) => mockEnsureDeviceConnectionGrant(...args),
  ensureSupervisorAdminGrant: (...args: unknown[]) => mockEnsureSupervisorAdminGrant(...args),
  registerEnrolledDevice: (...args: unknown[]) => mockRegisterEnrolledDevice(...args),
  decommissionManagedDevice: (...args: unknown[]) => mockDecommissionManagedDevice(...args),
  recordDeviceConnectionTest: (...args: unknown[]) => mockRecordDeviceConnectionTest(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetMockHardwareRegistry();
  mockGetClinicHandshakeToken.mockResolvedValue("handshake-token");
  mockEnsureSupervisorAdminGrant.mockResolvedValue({
    deviceId: "CG-ESP32-A100",
    exp: Date.now() + 60_000,
    grantVersion: 1,
    institutionId: "institution-1",
    issuedToFirebaseUid: "firebase-u1",
    permission: "manage",
    role: "Supervisor",
    token: "admin-grant",
    v: 1,
  });
  mockEnsureDeviceConnectionGrant.mockResolvedValue({
    deviceId: "CG-ESP32-A100",
    exp: Date.now() + 60_000,
    grantVersion: 1,
    institutionId: "institution-1",
    issuedToFirebaseUid: "firebase-u2",
    permission: "connect",
    role: "Nurse",
    token: "device-grant",
    v: 1,
  });
  mockRegisterEnrolledDevice.mockResolvedValue({
    deviceId: "CG-ESP32-A100",
    nickname: "Cold Room Alpha",
  });
  mockGetDeviceById.mockResolvedValue({
    id: "CG-ESP32-A100",
    institutionId: "institution-1",
  });
  mockRecordDeviceConnectionTest.mockResolvedValue(undefined);
  mockSaveDeviceConnectionSnapshot.mockResolvedValue(undefined);
  mockWifiBridgeRelease.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({
    json: async () => ({
      batteryLevel: 89,
      currentTempC: 4.7,
      doorOpen: false,
      firmwareVersion: "fw-1.0.0",
      lastSeenAt: Date.now(),
      macAddress: "MOCK-A100",
      mktStatus: "safe",
      statusText: "Mock BLE-to-WiFi handover completed.",
    }),
    ok: true,
  });
});

test("parses valid device qr payloads", () => {
  expect(parseDeviceQrPayload("coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1")).toEqual({
    bootstrapToken: "claim-alpha-100",
    deviceId: "CG-ESP32-A100",
  });
});

test("rejects invalid device qr payloads", () => {
  expect(() => parseDeviceQrPayload("coldguard://institution/not-a-device")).toThrow(
    "INVALID_DEVICE_QR_PAYLOAD",
  );
});

test("enrolls a blank mock device and registers it", async () => {
  const result = await enrollColdGuardDevice({
    nickname: "Cold Room Alpha",
    profile: {
      firebaseUid: "firebase-u1",
      displayName: "Yaw Boateng",
      email: "yaw@example.com",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      staffId: "KB1002",
      role: "Supervisor",
      lastUpdatedAt: 1,
    },
    qrPayload: "coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1",
    bleClient: new MockColdGuardBleClient(),
  });

  expect(result).toEqual({
    deviceId: "CG-ESP32-A100",
    nickname: "Cold Room Alpha",
  });
  expect(mockRegisterEnrolledDevice).toHaveBeenCalledWith(
    expect.objectContaining({
      bleName: "ColdGuard_A100",
      deviceId: "CG-ESP32-A100",
      nickname: "Cold Room Alpha",
    }),
  );
});

test("runs a mock BLE-to-WiFi connection test and records success", async () => {
  const payload = await runColdGuardConnectionTest({
    deviceId: "CG-ESP32-A100",
    bleClient: new MockColdGuardBleClient(),
    wifiBridge: {
      connect: async (ticket) => ({
        localIp: "192.168.4.2",
        ssid: ticket.ssid,
      }),
      release: async () => mockWifiBridgeRelease(),
    },
  });

  expect(payload).toEqual(
    expect.objectContaining({
      currentTempC: 4.7,
      localIp: "192.168.4.2",
      ssid: "ColdGuard_A100",
    }),
  );
  expect(mockUpdateDeviceConnectionTestStatus).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      status: "success",
    }),
  );
  expect(mockSaveDeviceConnectionSnapshot).toHaveBeenCalled();
  expect(mockRecordDeviceConnectionTest).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      status: "success",
      transport: "ble+wifi",
    }),
  );
  expect(mockWifiBridgeRelease).toHaveBeenCalledTimes(1);
});

test("decommissions a mock device and clears cached grants", async () => {
  await decommissionColdGuardDevice({
    deviceId: "CG-ESP32-A100",
    profile: {
      firebaseUid: "firebase-u1",
      displayName: "Yaw Boateng",
      email: "yaw@example.com",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      staffId: "KB1002",
      role: "Supervisor",
      lastUpdatedAt: 1,
    },
    bleClient: new MockColdGuardBleClient(),
  });

  expect(mockDecommissionManagedDevice).toHaveBeenCalledWith("CG-ESP32-A100");
  expect(mockDeleteConnectionGrant).toHaveBeenCalledWith("admin", "CG-ESP32-A100");
  expect(mockDeleteConnectionGrant).toHaveBeenCalledWith("device", "CG-ESP32-A100");
});
