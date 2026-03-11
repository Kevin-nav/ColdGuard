import {
  MockColdGuardBleClient,
  decommissionColdGuardDevice,
  enrollColdGuardDevice,
  parseDeviceQrPayload,
  retryPendingDeviceConnectionAuditSync,
  runColdGuardConnectionTest,
} from "./connection-service";
import { resetMockHardwareRegistry } from "./mock-hardware-registry";

const mockDeleteConnectionGrant = jest.fn();
const mockDeleteDeviceActionTicket = jest.fn();
const mockDeleteSyncJob = jest.fn();
const mockEnqueueSyncJob = jest.fn();
const mockGetDeviceById = jest.fn();
const mockListPendingSyncJobs = jest.fn();
const mockSaveDeviceConnectionSnapshot = jest.fn();
const mockSetSyncJobStatus = jest.fn();
const mockUpdateDeviceConnectionSyncState = jest.fn();
const mockUpdateDeviceConnectionTestStatus = jest.fn();
const mockGetClinicHandshakeToken = jest.fn();
const mockEnsureDeviceActionTicket = jest.fn();
const mockEnsureSupervisorActionTicket = jest.fn();
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
  deleteDeviceActionTicket: (...args: unknown[]) => mockDeleteDeviceActionTicket(...args),
}));

jest.mock("../../../lib/storage/sqlite/device-repository", () => ({
  getDeviceById: (...args: unknown[]) => mockGetDeviceById(...args),
  saveDeviceConnectionSnapshot: (...args: unknown[]) => mockSaveDeviceConnectionSnapshot(...args),
  updateDeviceConnectionSyncState: (...args: unknown[]) => mockUpdateDeviceConnectionSyncState(...args),
  updateDeviceConnectionTestStatus: (...args: unknown[]) => mockUpdateDeviceConnectionTestStatus(...args),
}));

jest.mock("../../../lib/storage/sqlite/sync-job-repository", () => ({
  deleteSyncJob: (...args: unknown[]) => mockDeleteSyncJob(...args),
  enqueueSyncJob: (...args: unknown[]) => mockEnqueueSyncJob(...args),
  listPendingSyncJobs: (...args: unknown[]) => mockListPendingSyncJobs(...args),
  setSyncJobStatus: (...args: unknown[]) => mockSetSyncJobStatus(...args),
}));

jest.mock("../../../lib/storage/secure-store", () => ({
  getClinicHandshakeToken: () => mockGetClinicHandshakeToken(),
}));

jest.mock("./device-directory", () => ({
  ensureDeviceActionTicket: (...args: unknown[]) => mockEnsureDeviceActionTicket(...args),
  ensureSupervisorActionTicket: (...args: unknown[]) => mockEnsureSupervisorActionTicket(...args),
  registerEnrolledDevice: (...args: unknown[]) => mockRegisterEnrolledDevice(...args),
  decommissionManagedDevice: (...args: unknown[]) => mockDecommissionManagedDevice(...args),
  recordDeviceConnectionTest: (...args: unknown[]) => mockRecordDeviceConnectionTest(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  resetMockHardwareRegistry();
  mockGetClinicHandshakeToken.mockResolvedValue("handshake-token");
  mockEnsureSupervisorActionTicket.mockResolvedValue({
    action: "decommission",
    counter: 1,
    deviceId: "CG-ESP32-A100",
    expiresAt: Date.now() + 60_000,
    institutionId: "institution-1",
    issuedAt: Date.now(),
    mac: "admin-ticket-mac",
    operatorId: "firebase-u1",
    ticketId: "admin-ticket",
    v: 1,
  });
  mockEnsureDeviceActionTicket.mockResolvedValue({
    action: "connect",
    counter: 1,
    deviceId: "CG-ESP32-A100",
    expiresAt: Date.now() + 60_000,
    institutionId: "institution-1",
    issuedAt: Date.now(),
    mac: "device-ticket-mac",
    operatorId: "firebase-u2",
    ticketId: "device-ticket",
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
  mockUpdateDeviceConnectionSyncState.mockResolvedValue(undefined);
  mockWifiBridgeRelease.mockResolvedValue(undefined);
  mockEnqueueSyncJob.mockResolvedValue("sync-job-1");
  mockDeleteSyncJob.mockResolvedValue(undefined);
  mockListPendingSyncJobs.mockResolvedValue([]);
  mockSetSyncJobStatus.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({
    json: async () => ({
      batteryLevel: 89,
      currentTempC: 4.7,
      doorOpen: false,
      firmwareVersion: "fw-1.0.0",
      lastSeenAgeMs: 2_500,
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
  jest.spyOn(Date, "now").mockReturnValue(1_000_000);
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
  expect(mockSaveDeviceConnectionSnapshot).toHaveBeenCalledWith(
    "CG-ESP32-A100",
    expect.objectContaining({
      lastSeenAt: 997_500,
    }),
  );
  expect(mockRecordDeviceConnectionTest).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      lastSeenAt: 997_500,
      status: "success",
      transport: "ble+wifi",
    }),
  );
  expect(mockUpdateDeviceConnectionSyncState).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      failureStage: "record_connection_test",
      status: "pending",
    }),
  );
  expect(mockUpdateDeviceConnectionSyncState).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      failureStage: null,
      status: "synced",
    }),
  );
  expect(mockWifiBridgeRelease).toHaveBeenCalledTimes(1);
});

test("keeps the local connection success and queues sync when backend audit logging fails", async () => {
  mockRecordDeviceConnectionTest.mockRejectedValueOnce(new Error("convex unavailable"));

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

  expect(payload.statusText).toBe("Mock BLE-to-WiFi handover completed.");
  expect(mockUpdateDeviceConnectionTestStatus).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      status: "success",
    }),
  );
  expect(mockEnqueueSyncJob).toHaveBeenCalledWith(
    "device_connection_test_reconciliation",
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      lastSeenAt: expect.any(Number),
      status: "success",
      transport: "ble+wifi",
    }),
  );
  expect(mockUpdateDeviceConnectionSyncState).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      failureStage: "record_connection_test",
      status: "failed",
    }),
  );
});

test("retries pending device connection audit jobs and clears sync failure state on success", async () => {
  mockListPendingSyncJobs.mockResolvedValue([
    {
      createdAt: 1,
      id: "sync-job-1",
      jobType: "device_connection_test_reconciliation",
      payload: {
        deviceId: "CG-ESP32-A100",
        lastSeenAt: 997_500,
        status: "success",
        summary: "Mock BLE-to-WiFi handover completed.",
        transport: "ble+wifi",
      },
      status: "pending",
      updatedAt: 1,
    },
  ]);

  await retryPendingDeviceConnectionAuditSync({ deviceId: "CG-ESP32-A100" });

  expect(mockSetSyncJobStatus).toHaveBeenCalledWith("sync-job-1", "processing");
  expect(mockRecordDeviceConnectionTest).toHaveBeenCalledWith({
    deviceId: "CG-ESP32-A100",
    lastSeenAt: 997_500,
    status: "success",
    summary: "Mock BLE-to-WiFi handover completed.",
    transport: "ble+wifi",
  });
  expect(mockDeleteSyncJob).toHaveBeenCalledWith("sync-job-1");
  expect(mockUpdateDeviceConnectionSyncState).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      failureStage: null,
      status: "synced",
    }),
  );
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
  expect(mockDeleteDeviceActionTicket).toHaveBeenCalledWith("admin", "CG-ESP32-A100", "decommission");
  expect(mockDeleteDeviceActionTicket).toHaveBeenCalledWith("device", "CG-ESP32-A100", "connect");
  expect(mockDeleteDeviceActionTicket).toHaveBeenCalledWith("device", "CG-ESP32-A100", "wifi_provision");
  expect(mockDeleteConnectionGrant).toHaveBeenCalledWith("admin", "CG-ESP32-A100");
  expect(mockDeleteConnectionGrant).toHaveBeenCalledWith("device", "CG-ESP32-A100");
});
