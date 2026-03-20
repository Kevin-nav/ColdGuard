import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { NotificationProvider, useNotificationContext } from "./notification-provider";

const mockUseAuthSession = jest.fn();
const mockUseDashboardBootstrap = jest.fn();
const mockUseNetworkStatus = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockListMonitoredDeviceRuntimeConfigs = jest.fn();
const mockPollMonitoredDeviceRuntime = jest.fn();
const mockGetNativeMonitoringServiceStatuses = jest.fn();
const mockSyncNotificationInbox = jest.fn();
const mockSyncNotificationPreferences = jest.fn();
const mockConfigureLocalNotificationHandler = jest.fn();
const mockGetLocalNotificationPermissionStatus = jest.fn();
const mockMirrorNotificationsLocally = jest.fn();
const mockFlushPendingNotificationSyncJobs = jest.fn();
const mockSyncPushRegistration = jest.fn();

jest.mock("../../auth/providers/auth-provider", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

jest.mock("../../dashboard/providers/dashboard-bootstrap", () => ({
  useDashboardBootstrap: () => mockUseDashboardBootstrap(),
}));

jest.mock("../../network/network-status", () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

jest.mock("../../dashboard/services/profile-hydration", () => ({
  ensureLocalProfileForUser: (...args: unknown[]) => mockEnsureLocalProfileForUser(...args),
}));

jest.mock("../../../lib/storage/sqlite/device-runtime-repository", () => ({
  listMonitoredDeviceRuntimeConfigs: (...args: unknown[]) =>
    mockListMonitoredDeviceRuntimeConfigs(...args),
}));

jest.mock("../../devices/services/connection-service", () => ({
  pollMonitoredDeviceRuntime: (...args: unknown[]) => mockPollMonitoredDeviceRuntime(...args),
}));

jest.mock("../../devices/services/wifi-bridge", () => ({
  getNativeMonitoringServiceStatuses: (...args: unknown[]) => mockGetNativeMonitoringServiceStatuses(...args),
}));

jest.mock("../services/inbox-sync", () => ({
  acknowledgeIncidentWithSync: jest.fn(),
  archiveNotificationWithSync: jest.fn(),
  flushPendingNotificationSyncJobs: (...args: unknown[]) => mockFlushPendingNotificationSyncJobs(...args),
  getIncidentDetail: jest.fn(),
  markNotificationReadWithSync: jest.fn(),
  resolveIncidentWithSync: jest.fn(),
  syncNotificationInbox: (...args: unknown[]) => mockSyncNotificationInbox(...args),
  syncNotificationPreferences: (...args: unknown[]) => mockSyncNotificationPreferences(...args),
  updateNotificationPreferencesWithSync: jest.fn(),
}));

jest.mock("../services/local-notifications", () => ({
  configureLocalNotificationHandler: () => mockConfigureLocalNotificationHandler(),
  getLocalNotificationPermissionStatus: () => mockGetLocalNotificationPermissionStatus(),
  mirrorNotificationsLocally: (...args: unknown[]) => mockMirrorNotificationsLocally(...args),
}));

jest.mock("../services/push-registration", () => ({
  syncPushRegistration: (...args: unknown[]) => mockSyncPushRegistration(...args),
}));

function Consumer() {
  const { isLoading } = useNotificationContext();
  return <Text>{isLoading ? "loading" : "ready"}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthSession.mockReturnValue({
    user: {
      uid: "firebase-u1",
      displayName: "Yaw Boateng",
      email: "yaw@example.com",
    },
  });
  mockUseDashboardBootstrap.mockReturnValue({ isReady: true });
  mockUseNetworkStatus.mockReturnValue({ isOnline: true });
  mockEnsureLocalProfileForUser.mockResolvedValue({
    firebaseUid: "firebase-u1",
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
  });
  mockGetLocalNotificationPermissionStatus.mockResolvedValue("granted");
  mockGetNativeMonitoringServiceStatuses.mockResolvedValue({
    "device-1": {
      deviceId: "device-1",
      error: null,
      isRunning: true,
      transport: "facility_wifi",
    },
  });
  mockListMonitoredDeviceRuntimeConfigs.mockResolvedValue([
    {
      activeRuntimeBaseUrl: "http://192.168.4.2",
      activeTransport: "softap",
      deviceId: "device-2",
      facilityWifiPassword: null,
      facilityWifiRuntimeBaseUrl: null,
      facilityWifiSsid: null,
      lastMonitorAt: null,
      lastMonitorError: null,
      lastPingAt: null,
      lastRecoverAt: null,
      lastRuntimeError: null,
      monitoringMode: "foreground_service",
      sessionStatus: "connected",
      softApPassword: "secret",
      softApRuntimeBaseUrl: "http://192.168.4.2",
      softApSsid: "ColdGuard_200",
      updatedAt: 1,
    },
  ]);
  mockPollMonitoredDeviceRuntime.mockResolvedValue(undefined);
  mockSyncNotificationInbox.mockResolvedValue({
    incidents: [],
    syncError: null,
  });
  mockSyncNotificationPreferences.mockResolvedValue({
    lastUpdatedAt: 1,
    nonCriticalByType: {
      battery_low: true,
      device_offline: true,
      door_open: true,
      temperature: true,
    },
    quietHoursEnd: null,
    quietHoursStart: null,
    recoveryPushEnabled: true,
    warningLocalEnabled: true,
    warningPushEnabled: true,
  });
  mockMirrorNotificationsLocally.mockResolvedValue(undefined);
  mockFlushPendingNotificationSyncJobs.mockResolvedValue(undefined);
  mockSyncPushRegistration.mockResolvedValue({ permissionStatus: "granted" });
});

test("skips JS polling for devices already owned by the native monitoring service", async () => {
  const ui = render(
    <NotificationProvider>
      <Consumer />
    </NotificationProvider>,
  );

  await waitFor(() => expect(ui.getByText("ready")).toBeTruthy());

  expect(mockGetNativeMonitoringServiceStatuses).toHaveBeenCalled();
  expect(mockListMonitoredDeviceRuntimeConfigs).toHaveBeenCalledWith({
    excludeDeviceIds: ["device-1"],
  });
  expect(mockPollMonitoredDeviceRuntime).toHaveBeenCalledTimes(1);
  expect(mockPollMonitoredDeviceRuntime).toHaveBeenCalledWith({ deviceId: "device-2" });
  expect(mockSyncNotificationInbox).toHaveBeenCalledWith(
    {
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
    },
    { isOnline: true },
  );
});
