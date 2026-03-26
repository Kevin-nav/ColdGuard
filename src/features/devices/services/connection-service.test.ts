import {
  bootstrapDefaultDeviceMonitoring,
  MockColdGuardBleClient,
  connectOrRecoverDevice,
  decommissionColdGuardDevice,
  enrollColdGuardDevice,
  getDeviceRuntimeSession,
  parseDeviceQrPayload,
  retryPendingDeviceConnectionAuditSync,
  runColdGuardConnectionTest,
  startDeviceMonitoring,
  stopDeviceMonitoring,
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
const mockGetOrCreateMonitoringClientId = jest.fn();
const mockGetProfileSnapshot = jest.fn();
const mockGetNativeMonitoringServiceStatuses = jest.fn();
const mockEnsureDeviceActionTicket = jest.fn();
const mockEnsureSupervisorActionTicket = jest.fn();
const mockDeleteDeviceRuntimeConfig = jest.fn();
const mockGetDeviceRuntimeConfig = jest.fn();
const mockRegisterEnrolledDevice = jest.fn();
const mockDecommissionManagedDevice = jest.fn();
const mockRecordDeviceConnectionTest = jest.fn();
const mockStartNativeEnrollment = jest.fn();
const mockStartNativeMonitoringDevice = jest.fn();
const mockStopNativeMonitoringDevice = jest.fn();
const mockSubscribeToNativeEnrollmentStages = jest.fn();
const mockFetch = jest.fn();
const mockGetLocalNotificationPermissionStatus = jest.fn();
const mockRequestLocalNotificationPermission = jest.fn();
const mockUpsertDeviceRuntimeConfig = jest.fn();
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

jest.mock("../../../lib/storage/sqlite/device-runtime-repository", () => ({
  deleteDeviceRuntimeConfig: (...args: unknown[]) => mockDeleteDeviceRuntimeConfig(...args),
  getDeviceRuntimeConfig: (...args: unknown[]) => mockGetDeviceRuntimeConfig(...args),
  upsertDeviceRuntimeConfig: (...args: unknown[]) => mockUpsertDeviceRuntimeConfig(...args),
}));

jest.mock("../../../lib/storage/sqlite/sync-job-repository", () => ({
  deleteSyncJob: (...args: unknown[]) => mockDeleteSyncJob(...args),
  enqueueSyncJob: (...args: unknown[]) => mockEnqueueSyncJob(...args),
  listPendingSyncJobs: (...args: unknown[]) => mockListPendingSyncJobs(...args),
  setSyncJobStatus: (...args: unknown[]) => mockSetSyncJobStatus(...args),
}));

jest.mock("../../../lib/storage/secure-store", () => ({
  getClinicHandshakeToken: () => mockGetClinicHandshakeToken(),
  getOrCreateMonitoringClientId: () => mockGetOrCreateMonitoringClientId(),
}));

jest.mock("../../../lib/storage/sqlite/profile-repository", () => ({
  getProfileSnapshot: () => mockGetProfileSnapshot(),
}));

jest.mock("../../notifications/services/local-notifications", () => ({
  getLocalNotificationPermissionStatus: () => mockGetLocalNotificationPermissionStatus(),
  requestLocalNotificationPermission: () => mockRequestLocalNotificationPermission(),
}));

jest.mock("./device-directory", () => ({
  ensureDeviceActionTicket: (...args: unknown[]) => mockEnsureDeviceActionTicket(...args),
  ensureSupervisorActionTicket: (...args: unknown[]) => mockEnsureSupervisorActionTicket(...args),
  registerEnrolledDevice: (...args: unknown[]) => mockRegisterEnrolledDevice(...args),
  decommissionManagedDevice: (...args: unknown[]) => mockDecommissionManagedDevice(...args),
  recordDeviceConnectionTest: (...args: unknown[]) => mockRecordDeviceConnectionTest(...args),
}));

jest.mock("./wifi-bridge", () => ({
  createColdGuardWifiBridge: () => ({
    connect: jest.fn(),
    release: (...args: unknown[]) => mockWifiBridgeRelease(...args),
  }),
  getNativeMonitoringServiceStatuses: (...args: unknown[]) => mockGetNativeMonitoringServiceStatuses(...args),
  startNativeEnrollment: (...args: unknown[]) => mockStartNativeEnrollment(...args),
  startNativeMonitoringDevice: (...args: unknown[]) => mockStartNativeMonitoringDevice(...args),
  stopNativeMonitoringDevice: (...args: unknown[]) => mockStopNativeMonitoringDevice(...args),
  subscribeToNativeEnrollmentStages: (...args: unknown[]) => mockSubscribeToNativeEnrollmentStages(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  resetMockHardwareRegistry();
  mockGetClinicHandshakeToken.mockResolvedValue("handshake-token");
  mockGetOrCreateMonitoringClientId.mockResolvedValue("client-device-1");
  mockGetProfileSnapshot.mockResolvedValue({
    displayName: "Yaw Boateng",
    email: "yaw@example.com",
    firebaseUid: "firebase-u1",
    institutionId: "institution-1",
    institutionName: "Korle-Bu",
    lastUpdatedAt: 1,
    role: "Supervisor",
    staffId: "KB1001",
  });
  mockGetLocalNotificationPermissionStatus.mockResolvedValue("granted");
  mockRequestLocalNotificationPermission.mockResolvedValue("granted");
  mockEnsureSupervisorActionTicket.mockImplementation(async (_profile: unknown, deviceId: string, action: string) => ({
    action,
    counter: 1,
    deviceId,
    expiresAt: Date.now() + 60_000,
    institutionId: "institution-1",
    issuedAt: Date.now(),
    mac: "admin-ticket-mac",
    operatorId: "firebase-u1",
    ticketId: `admin-ticket-${action}-${deviceId}`,
    v: 1,
  }));
  mockEnsureDeviceActionTicket.mockImplementation(async (deviceId: string, action: string) => ({
    action,
    counter: 1,
    deviceId,
    expiresAt: Date.now() + 60_000,
    institutionId: "institution-1",
    issuedAt: Date.now(),
    mac: "device-ticket-mac",
    operatorId: "firebase-u2",
    ticketId: `device-ticket-${deviceId}`,
    v: 1,
  }));
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
  mockDeleteDeviceRuntimeConfig.mockResolvedValue(undefined);
  mockGetDeviceRuntimeConfig.mockResolvedValue(null);
  mockGetNativeMonitoringServiceStatuses.mockResolvedValue({});
  mockStartNativeEnrollment.mockResolvedValue({
    bleName: "ColdGuard_A100",
    deviceId: "CG-ESP32-A100",
    diagnostics: {
      attemptsByStageJson: "{}",
      detail: "Enrollment completed successfully.",
      deviceId: "CG-ESP32-A100",
      failureStage: null,
      rawErrorMessage: null,
      runtimeBaseUrl: "http://192.168.4.1",
      ssid: "ColdGuard_A100",
      timelineJson: "[]",
    },
    firmwareVersion: "fw-1.0.0",
    macAddress: "AA:BB:CC:DD:EE:01",
    protocolVersion: 1,
    runtimeBaseUrl: "http://192.168.4.1",
    smokeTestPassed: true,
    softApPassword: "pass-1",
    softApSsid: "ColdGuard_A100",
  });
  mockStartNativeMonitoringDevice.mockResolvedValue({
    "CG-ESP32-A100": {
      controlRole: "primary",
      deviceId: "CG-ESP32-A100",
      error: null,
      isRunning: true,
      primaryControllerUserId: "firebase-u1",
      primaryLeaseExpiresAt: Date.now() + 35_000,
      primaryLeaseSessionId: "lease-CG-ESP32-A100",
      transport: "softap",
    },
  });
  mockStopNativeMonitoringDevice.mockResolvedValue({});
  mockSubscribeToNativeEnrollmentStages.mockReturnValue({ remove: jest.fn() });
  mockUpsertDeviceRuntimeConfig.mockImplementation(async (deviceId: string, patch: Record<string, unknown>) => ({
    activeRuntimeBaseUrl: patch.activeRuntimeBaseUrl ?? null,
    activeTransport: patch.activeTransport ?? null,
    controlRole: patch.controlRole ?? "none",
    deviceId,
    facilityWifiPassword: patch.facilityWifiPassword ?? null,
    facilityWifiRuntimeBaseUrl: patch.facilityWifiRuntimeBaseUrl ?? null,
    facilityWifiSsid: patch.facilityWifiSsid ?? null,
    lastMonitorAt: patch.lastMonitorAt ?? null,
    lastMonitorError: patch.lastMonitorError ?? null,
    lastPingAt: patch.lastPingAt ?? null,
    lastRecoverAt: patch.lastRecoverAt ?? null,
    lastRuntimeError: patch.lastRuntimeError ?? null,
    monitoringMode: patch.monitoringMode ?? "off",
    primaryControllerUserId: patch.primaryControllerUserId ?? null,
    primaryLeaseExpiresAt: patch.primaryLeaseExpiresAt ?? null,
    primaryLeaseSessionId: patch.primaryLeaseSessionId ?? null,
    sessionStatus: patch.sessionStatus ?? "idle",
    softApPassword: patch.softApPassword ?? null,
    softApRuntimeBaseUrl: patch.softApRuntimeBaseUrl ?? null,
    softApSsid: patch.softApSsid ?? null,
    updatedAt: Date.now(),
  }));
  mockFetch.mockResolvedValue({
    json: async () => ({
      alerts: [],
      batteryLevel: 89,
      currentTempC: 4.7,
      doorOpen: false,
      firmwareVersion: "fw-1.0.0",
      lastSeenAgeMs: 2_500,
      macAddress: "MOCK-A100",
      mktStatus: "safe",
      runtimeBaseUrl: "http://192.168.4.1",
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
  expect(mockStartNativeMonitoringDevice).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      transport: "ble_fallback",
    }),
  );
});

test("enrollment uses a single BLE session instead of scanning twice", async () => {
  const discoverDevice = jest.fn(async () => {
    throw new Error("discoverDevice should not be called during enrollment");
  });
  const enrollDevice = jest.fn(async () => ({
    bleName: "ColdGuard_7BCC",
    bootstrapClaim: "claim-1",
    deviceId: "CG-ESP32-5C7BCC",
    firmwareVersion: "cg-transport-0.1.0",
    macAddress: "74:24:A8:5C:7B:CC",
    protocolVersion: 1,
    state: "enrolled" as const,
  }));

  await enrollColdGuardDevice({
    nickname: "Test device",
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
    qrPayload: "coldguard://device/CG-ESP32-5C7BCC?claim=claim-1&v=1",
    bleClient: {
      decommissionDevice: jest.fn(),
      discoverDevice,
      enrollDevice,
      provisionWifi: jest.fn(),
      requestWifiTicket: jest.fn(),
    },
  });

  expect(discoverDevice).not.toHaveBeenCalled();
  expect(enrollDevice).toHaveBeenCalledWith(
    expect.objectContaining({
      bootstrapToken: "claim-1",
      deviceId: "CG-ESP32-5C7BCC",
      nickname: "Test device",
    }),
  );
});

test("uses the native android enrollment bridge and persists temporary softap metadata", async () => {
  const reactNative = jest.requireActual("react-native");
  const previousOs = reactNative.Platform.OS;
  const previousRequestMultiple = reactNative.PermissionsAndroid.requestMultiple;
  const remove = jest.fn();
  const onProgress = jest.fn();
  mockSubscribeToNativeEnrollmentStages.mockImplementation((listener: (event: unknown) => void) => {
    listener({
      attempt: 1,
      detail: "Opening Bluetooth link to the device.",
      deviceId: "CG-ESP32-A100",
      elapsedMs: 125,
      stage: "connecting_ble",
      stageLabel: "Connecting over Bluetooth",
    });
    return { remove };
  });

  Object.defineProperty(reactNative.Platform, "OS", {
    configurable: true,
    value: "android",
  });
  reactNative.PermissionsAndroid.requestMultiple = jest.fn(async () => ({
    "android.permission.BLUETOOTH_CONNECT": "granted",
    "android.permission.BLUETOOTH_SCAN": "granted",
    "android.permission.NEARBY_WIFI_DEVICES": "granted",
  }));

  try {
    await enrollColdGuardDevice({
      nickname: "Cold Room Alpha",
      onProgress,
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
    });
  } finally {
    Object.defineProperty(reactNative.Platform, "OS", {
      configurable: true,
      value: previousOs,
    });
    reactNative.PermissionsAndroid.requestMultiple = previousRequestMultiple;
  }

  expect(mockStartNativeEnrollment).toHaveBeenCalledWith(
    expect.objectContaining({
      actionTicketJson: expect.stringContaining("\"action\":\"enroll\""),
      bootstrapToken: "claim-alpha-100",
      connectActionTicketJson: expect.stringContaining("\"action\":\"connect\""),
      deviceId: "CG-ESP32-A100",
      nickname: "Cold Room Alpha",
    }),
  );
  expect(mockUpsertDeviceRuntimeConfig).toHaveBeenCalledWith(
    "CG-ESP32-A100",
    expect.objectContaining({
      lastRuntimeError: null,
      softApPassword: "pass-1",
      softApRuntimeBaseUrl: "http://192.168.4.1",
      softApSsid: "ColdGuard_A100",
    }),
  );
  expect(onProgress).toHaveBeenCalledWith(
    expect.objectContaining({
      stage: "connecting_ble",
      stageLabel: "Connecting over Bluetooth",
    }),
  );
  expect(remove).toHaveBeenCalledTimes(1);
});

test("requests bluetooth permission before native android enrollment", async () => {
  const reactNative = jest.requireActual("react-native");
  const previousOs = reactNative.Platform.OS;
  const previousVersion = reactNative.Platform.Version;
  const previousRequestMultiple = reactNative.PermissionsAndroid.requestMultiple;

  Object.defineProperty(reactNative.Platform, "OS", {
    configurable: true,
    value: "android",
  });
  Object.defineProperty(reactNative.Platform, "Version", {
    configurable: true,
    value: 33,
  });
  reactNative.PermissionsAndroid.requestMultiple = jest
    .fn()
    .mockResolvedValueOnce({
      "android.permission.BLUETOOTH_CONNECT": "denied",
      "android.permission.BLUETOOTH_SCAN": "granted",
    })
    .mockResolvedValueOnce({
      "android.permission.NEARBY_WIFI_DEVICES": "granted",
    });

  try {
    await expect(
      enrollColdGuardDevice({
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
      }),
    ).rejects.toThrow("BLE_PERMISSION_REQUIRED");
  } finally {
    Object.defineProperty(reactNative.Platform, "OS", {
      configurable: true,
      value: previousOs,
    });
    Object.defineProperty(reactNative.Platform, "Version", {
      configurable: true,
      value: previousVersion,
    });
    reactNative.PermissionsAndroid.requestMultiple = previousRequestMultiple;
  }

  expect(mockStartNativeEnrollment).not.toHaveBeenCalled();
});

test("starts native monitoring with facility and softap recovery context", async () => {
  mockUpsertDeviceRuntimeConfig.mockResolvedValueOnce({
    activeRuntimeBaseUrl: "http://192.168.4.1",
    activeTransport: "softap",
    deviceId: "CG-ESP32-A100",
    facilityWifiPassword: "facility-pass",
    facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
    facilityWifiSsid: "HospitalNet",
    softApPassword: "A100-wifi",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    lastMonitorAt: Date.now(),
    lastMonitorError: null,
    lastPingAt: null,
    lastRecoverAt: null,
    lastRuntimeError: null,
    monitoringMode: "foreground_service",
    sessionStatus: "connected",
    updatedAt: Date.now(),
  });

  await startDeviceMonitoring("CG-ESP32-A100");

  expect(mockGetLocalNotificationPermissionStatus).toHaveBeenCalled();
  expect(mockRequestLocalNotificationPermission).not.toHaveBeenCalled();
  expect(mockEnsureDeviceActionTicket).toHaveBeenCalledWith("CG-ESP32-A100", "connect");
  expect(mockStartNativeMonitoringDevice).toHaveBeenCalledWith(
    expect.objectContaining({
      connectActionTicketJson: expect.stringContaining("\"ticketId\":\"device-ticket-CG-ESP32-A100\""),
      controllerClientId: "client-device-1",
      controllerUserId: "firebase-u1",
      deviceId: "CG-ESP32-A100",
      facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
      handshakeToken: "handshake-token",
      heartbeatIntervalMs: 10_000,
      leaseDurationMs: 35_000,
      softApPassword: "A100-wifi",
      softApRuntimeBaseUrl: "http://192.168.4.1",
      softApSsid: "ColdGuard_A100",
      transport: "softap",
    }),
  );
});

test("bootstrapDefaultDeviceMonitoring marks the session active before starting native monitoring", async () => {
  await bootstrapDefaultDeviceMonitoring("CG-ESP32-A100");

  expect(mockUpsertDeviceRuntimeConfig).toHaveBeenCalledWith(
    "CG-ESP32-A100",
    expect.objectContaining({
      monitoringMode: "foreground_service",
      sessionStatus: "connecting",
    }),
  );
  expect(mockStartNativeMonitoringDevice).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceId: "CG-ESP32-A100",
      transport: "ble_fallback",
    }),
  );
});

test("starts monitoring in ble-primary mode when facility wifi is configured but not yet proven", async () => {
  mockUpsertDeviceRuntimeConfig.mockResolvedValueOnce({
    activeRuntimeBaseUrl: null,
    activeTransport: null,
    deviceId: "CG-ESP32-A100",
    facilityWifiPassword: "facility-pass",
    facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
    facilityWifiSsid: "HospitalNet",
    softApPassword: "A100-wifi",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    lastMonitorAt: Date.now(),
    lastMonitorError: null,
    lastPingAt: null,
    lastRecoverAt: null,
    lastRuntimeError: null,
    monitoringMode: "foreground_service",
    sessionStatus: "idle",
    updatedAt: Date.now(),
  });

  await startDeviceMonitoring("CG-ESP32-A100");

  expect(mockStartNativeMonitoringDevice).toHaveBeenCalledWith(
    expect.objectContaining({
      controllerClientId: "client-device-1",
      controllerUserId: "firebase-u1",
      facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
      softApRuntimeBaseUrl: "http://192.168.4.1",
      transport: "ble_fallback",
    }),
  );
});

test("requests notification permission before starting background monitoring", async () => {
  mockGetLocalNotificationPermissionStatus.mockResolvedValueOnce("undetermined");

  await startDeviceMonitoring("CG-ESP32-A100");

  expect(mockRequestLocalNotificationPermission).toHaveBeenCalled();
});

test("surfaces a clear error when notification permission is denied", async () => {
  mockGetLocalNotificationPermissionStatus.mockResolvedValueOnce("denied");

  await expect(startDeviceMonitoring("CG-ESP32-A100")).rejects.toThrow(
    "Allow notifications to start ColdGuard background monitoring on this device.",
  );

  expect(mockStartNativeMonitoringDevice).not.toHaveBeenCalled();
});

test("fails startup when the native monitoring service reports a permission block", async () => {
  mockStartNativeMonitoringDevice.mockResolvedValueOnce({
    "CG-ESP32-A100": {
      deviceId: "CG-ESP32-A100",
      error: "POST_NOTIFICATIONS_PERMISSION_REQUIRED",
      isRunning: false,
      transport: "softap",
    },
  });

  await expect(startDeviceMonitoring("CG-ESP32-A100")).rejects.toThrow(
    "Allow notifications to start ColdGuard background monitoring on this device.",
  );
});

test("keeps multi-device monitoring state isolated per device", async () => {
  mockUpsertDeviceRuntimeConfig
    .mockResolvedValueOnce({
      activeRuntimeBaseUrl: "http://10.0.0.22",
      activeTransport: "facility_wifi",
      deviceId: "CG-ESP32-A100",
      facilityWifiPassword: "facility-pass",
      facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
      facilityWifiSsid: "HospitalNet",
      softApPassword: "A100-wifi",
      softApRuntimeBaseUrl: "http://192.168.4.1",
      softApSsid: "ColdGuard_A100",
      lastMonitorAt: Date.now(),
      lastMonitorError: null,
      lastPingAt: null,
      lastRecoverAt: null,
      lastRuntimeError: null,
      monitoringMode: "foreground_service",
      sessionStatus: "connected",
      updatedAt: Date.now(),
    })
    .mockResolvedValueOnce({
      activeRuntimeBaseUrl: null,
      activeTransport: null,
      deviceId: "CG-ESP32-B200",
      facilityWifiPassword: null,
      facilityWifiRuntimeBaseUrl: null,
      facilityWifiSsid: null,
      softApPassword: null,
      softApRuntimeBaseUrl: null,
      softApSsid: null,
      lastMonitorAt: Date.now(),
      lastMonitorError: null,
      lastPingAt: null,
      lastRecoverAt: null,
      lastRuntimeError: null,
      monitoringMode: "foreground_service",
      sessionStatus: "idle",
      updatedAt: Date.now(),
    });
  mockStartNativeMonitoringDevice
    .mockResolvedValueOnce({
      "CG-ESP32-A100": {
        deviceId: "CG-ESP32-A100",
        error: null,
        isRunning: true,
        transport: "facility_wifi",
      },
    })
    .mockResolvedValueOnce({
      "CG-ESP32-A100": {
        deviceId: "CG-ESP32-A100",
        error: null,
        isRunning: true,
        transport: "facility_wifi",
      },
      "CG-ESP32-B200": {
        deviceId: "CG-ESP32-B200",
        error: null,
        isRunning: true,
        transport: "ble_fallback",
      },
    });

  await startDeviceMonitoring("CG-ESP32-A100");
  await startDeviceMonitoring("CG-ESP32-B200");

  expect(mockStartNativeMonitoringDevice).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      deviceId: "CG-ESP32-B200",
      facilityWifiRuntimeBaseUrl: null,
      softApRuntimeBaseUrl: null,
      transport: "ble_fallback",
    }),
  );
});

test("stops one monitored device without clearing the others", async () => {
  mockStopNativeMonitoringDevice.mockResolvedValue({
    "CG-ESP32-B200": {
      deviceId: "CG-ESP32-B200",
      error: null,
      isRunning: true,
      transport: "facility_wifi",
    },
  });

  await stopDeviceMonitoring("CG-ESP32-A100");

  expect(mockStopNativeMonitoringDevice).toHaveBeenCalledWith("CG-ESP32-A100");
  expect(mockUpsertDeviceRuntimeConfig).toHaveBeenCalledWith(
    "CG-ESP32-A100",
    expect.objectContaining({
      lastMonitorError: null,
      monitoringMode: "off",
    }),
  );
});

test("merges per-device native monitoring status into the runtime session", async () => {
  mockGetDeviceRuntimeConfig.mockResolvedValue({
    activeRuntimeBaseUrl: "http://10.0.0.22",
    activeTransport: "facility_wifi",
    deviceId: "CG-ESP32-A100",
    facilityWifiPassword: "facility-pass",
    facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
    facilityWifiSsid: "HospitalNet",
    softApPassword: "A100-wifi",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    lastMonitorAt: 1,
    lastMonitorError: null,
    lastPingAt: 1,
    lastRecoverAt: 1,
    lastRuntimeError: null,
    monitoringMode: "foreground_service",
    sessionStatus: "connected",
    updatedAt: 1,
  });
  mockGetNativeMonitoringServiceStatuses.mockResolvedValue({
    "CG-ESP32-A100": {
      deviceId: "CG-ESP32-A100",
      error: "RECOVERING_SOFTAP",
      isRunning: true,
      transport: "softap",
    },
    "CG-ESP32-B200": {
      deviceId: "CG-ESP32-B200",
      error: null,
      isRunning: true,
      transport: "facility_wifi",
    },
  });

  await expect(getDeviceRuntimeSession("CG-ESP32-A100")).resolves.toEqual(
    expect.objectContaining({
      activeTransport: "softap",
      lastMonitorError: "RECOVERING_SOFTAP",
      monitoringMode: "foreground_service",
    }),
  );
});

test("prefers proven facility wifi over softap during reconnect", async () => {
  jest.spyOn(Date, "now").mockReturnValue(2_000_000);
  mockGetDeviceRuntimeConfig.mockResolvedValue({
    activeRuntimeBaseUrl: "http://10.0.0.22",
    activeTransport: "facility_wifi",
    deviceId: "CG-ESP32-A100",
    facilityWifiPassword: "facility-pass",
    facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
    facilityWifiSsid: "HospitalNet",
    softApPassword: "A100-wifi",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    lastMonitorAt: null,
    lastMonitorError: null,
    lastPingAt: 2_000_000,
    lastRecoverAt: null,
    lastRuntimeError: null,
    monitoringMode: "off",
    sessionStatus: "connected",
    updatedAt: 2_000_000,
  });

  const wifiBridgeConnect = jest.fn();
  const payload = await connectOrRecoverDevice({
    deviceId: "CG-ESP32-A100",
    wifiBridge: {
      connect: wifiBridgeConnect,
      release: async () => undefined,
    },
  });

  expect(payload.transport).toBe("facility_wifi");
  expect(wifiBridgeConnect).not.toHaveBeenCalled();
});

test("uses stored softap before facility wifi when facility path is not yet proven", async () => {
  mockGetDeviceRuntimeConfig.mockResolvedValue({
    activeRuntimeBaseUrl: null,
    activeTransport: null,
    deviceId: "CG-ESP32-A100",
    facilityWifiPassword: "facility-pass",
    facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
    facilityWifiSsid: "HospitalNet",
    softApPassword: "A100-wifi",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    lastMonitorAt: null,
    lastMonitorError: null,
    lastPingAt: null,
    lastRecoverAt: null,
    lastRuntimeError: null,
    monitoringMode: "off",
    sessionStatus: "idle",
    updatedAt: 1,
  });

  const payload = await connectOrRecoverDevice({
    deviceId: "CG-ESP32-A100",
    wifiBridge: {
      connect: async () => ({
        localIp: "192.168.4.2",
        ssid: "ColdGuard_A100",
      }),
      fetchRuntimeSnapshot: async () => ({
        alertsJson: "{\"alerts\":[]}",
        runtimeBaseUrl: "http://192.168.4.1",
        statusJson:
          "{\"batteryLevel\":89,\"currentTempC\":4.7,\"doorOpen\":false,\"firmwareVersion\":\"fw-1.0.0\",\"lastSeenAgeMs\":2500,\"macAddress\":\"MOCK-A100\",\"mktStatus\":\"safe\",\"runtimeBaseUrl\":\"http://192.168.4.1\",\"statusText\":\"Mock BLE-to-WiFi handover completed.\"}",
      }),
      release: async () => mockWifiBridgeRelease(),
    },
  });

  expect(payload.transport).toBe("softap");
  expect(mockWifiBridgeRelease).toHaveBeenCalledTimes(1);
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
      transport: "softap",
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

test("uses the native runtime snapshot bridge when available for softap recovery", async () => {
  mockFetch.mockClear();

  const payload = await runColdGuardConnectionTest({
    deviceId: "CG-ESP32-A100",
    bleClient: new MockColdGuardBleClient(),
    wifiBridge: {
      connect: async (ticket) => ({
        localIp: "192.168.4.2",
        ssid: ticket.ssid,
      }),
      fetchRuntimeSnapshot: async () => ({
        alertsJson: "{\"alerts\":[]}",
        runtimeBaseUrl: "http://192.168.4.1",
        statusJson:
          "{\"batteryLevel\":89,\"currentTempC\":4.7,\"doorOpen\":false,\"firmwareVersion\":\"fw-1.0.0\",\"lastSeenAgeMs\":2500,\"macAddress\":\"MOCK-A100\",\"mktStatus\":\"safe\",\"runtimeBaseUrl\":\"http://192.168.4.1\",\"statusText\":\"Mock BLE-to-WiFi handover completed.\"}",
      }),
      release: async () => mockWifiBridgeRelease(),
    },
  });

  expect(payload).toEqual(
    expect.objectContaining({
      localIp: "192.168.4.2",
      runtimeBaseUrl: "http://192.168.4.1",
      transport: "softap",
    }),
  );
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockWifiBridgeRelease).toHaveBeenCalledTimes(1);
});

test("falls back to HTTP runtime fetch when the native snapshot payload is malformed", async () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

  const payload = await runColdGuardConnectionTest({
    deviceId: "CG-ESP32-A100",
    bleClient: new MockColdGuardBleClient(),
    wifiBridge: {
      connect: async (ticket) => ({
        localIp: "192.168.4.2",
        ssid: ticket.ssid,
      }),
      fetchRuntimeSnapshot: async () => ({
        alertsJson: "{\"alerts\":[]}",
        runtimeBaseUrl: "http://192.168.4.1",
        statusJson: "{not-json",
      }),
      release: async () => mockWifiBridgeRelease(),
    },
  });

  expect(payload).toEqual(
    expect.objectContaining({
      runtimeBaseUrl: "http://192.168.4.1",
      transport: "softap",
    }),
  );
  expect(mockFetch).toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledWith(
    "Failed to parse native runtime snapshot payload; falling back to HTTP runtime fetch.",
    expect.objectContaining({
      runtimeBaseUrl: "http://192.168.4.1",
      statusJson: "{not-json",
    }),
  );
});

test("falls back to HTTP runtime fetch when the native runtime snapshot request fails", async () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

  const payload = await runColdGuardConnectionTest({
    deviceId: "CG-ESP32-A100",
    bleClient: new MockColdGuardBleClient(),
    wifiBridge: {
      connect: async (ticket) => ({
        localIp: "192.168.4.2",
        ssid: ticket.ssid,
      }),
      fetchRuntimeSnapshot: async () => {
        throw new Error("WIFI_BRIDGE_RUNTIME_SNAPSHOT_FAILED /api/v1/runtime/alerts: timeout");
      },
      release: async () => mockWifiBridgeRelease(),
    },
  });

  expect(payload).toEqual(
    expect.objectContaining({
      runtimeBaseUrl: "http://192.168.4.1",
      transport: "softap",
    }),
  );
  expect(mockFetch).toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledWith(
    "Native runtime snapshot fetch failed; falling back to HTTP runtime fetch.",
    expect.objectContaining({
      error: "WIFI_BRIDGE_RUNTIME_SNAPSHOT_FAILED /api/v1/runtime/alerts: timeout",
      runtimeBaseUrl: "http://192.168.4.1",
      transport: "softap",
    }),
  );
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
      transport: "softap",
    }),
  );
  expect(mockWifiBridgeRelease).toHaveBeenCalledTimes(1);
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
        transport: "softap",
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
    transport: "softap",
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
  expect(mockDeleteDeviceRuntimeConfig).toHaveBeenCalledWith("CG-ESP32-A100");
});
