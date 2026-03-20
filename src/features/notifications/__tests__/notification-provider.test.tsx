import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { NotificationProvider, useNotificationContext } from "../providers/notification-provider";

const mockEnsureLocalProfileForUser = jest.fn();
const mockListMonitoredDeviceRuntimeConfigs = jest.fn();
const mockPollMonitoredDeviceRuntime = jest.fn();
const mockGetNativeMonitoringServiceStatuses = jest.fn();
const mockSyncNotificationInbox = jest.fn();
const mockSyncNotificationPreferences = jest.fn();
const mockConfigureLocalNotificationHandler = jest.fn();
const mockGetLocalNotificationPermissionStatus = jest.fn();
const mockMirrorNotificationsLocally = jest.fn();
const mockSyncPushRegistration = jest.fn();
const mockFlushPendingNotificationSyncJobs = jest.fn();

jest.mock("../../auth/providers/auth-provider", () => ({
  useAuthSession: () => ({
    user: {
      uid: "firebase-u1",
      displayName: "Yaw Boateng",
      email: "yaw@example.com",
    },
  }),
}));

jest.mock("../../dashboard/providers/dashboard-bootstrap", () => ({
  useDashboardBootstrap: () => ({
    isReady: true,
  }),
}));

jest.mock("../../network/network-status", () => ({
  useNetworkStatus: () => ({
    isOnline: true,
  }),
}));

jest.mock("../../dashboard/services/profile-hydration", () => ({
  ensureLocalProfileForUser: (...args: unknown[]) => mockEnsureLocalProfileForUser(...args),
}));

jest.mock("../../../lib/storage/sqlite/device-runtime-repository", () => ({
  listMonitoredDeviceRuntimeConfigs: (...args: unknown[]) => mockListMonitoredDeviceRuntimeConfigs(...args),
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

function NotificationProbe() {
  const notificationContext = useNotificationContext();
  return <Text testID="incident-count">{String(notificationContext.incidents.length)}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsureLocalProfileForUser.mockResolvedValue({
    firebaseUid: "firebase-u1",
    displayName: "Yaw Boateng",
    email: "yaw@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
    lastUpdatedAt: 1,
    role: "Supervisor",
    staffId: "KB1002",
  });
  mockListMonitoredDeviceRuntimeConfigs.mockImplementation(
    async (options?: { excludeDeviceIds?: string[] }) => {
      const excludeDeviceIds = new Set(options?.excludeDeviceIds ?? []);
      return [
        { deviceId: "device-1" },
        { deviceId: "device-2" },
      ].filter((runtime) => !excludeDeviceIds.has(runtime.deviceId));
    },
  );
  mockPollMonitoredDeviceRuntime.mockResolvedValue(undefined);
  mockGetNativeMonitoringServiceStatuses.mockResolvedValue({});
  mockSyncNotificationInbox.mockResolvedValue({
    incidents: [],
    syncError: null,
  });
  mockSyncNotificationPreferences.mockResolvedValue(null);
  mockConfigureLocalNotificationHandler.mockReturnValue(undefined);
  mockGetLocalNotificationPermissionStatus.mockResolvedValue("granted");
  mockMirrorNotificationsLocally.mockResolvedValue(undefined);
  mockSyncPushRegistration.mockResolvedValue({
    permissionStatus: "granted",
  });
  mockFlushPendingNotificationSyncJobs.mockResolvedValue(undefined);
});

test("continues inbox refresh even when every monitored device is owned natively", async () => {
  mockGetNativeMonitoringServiceStatuses.mockResolvedValue({
    "device-1": {
      deviceId: "device-1",
      error: null,
      isRunning: true,
      transport: "facility_wifi",
    },
    "device-2": {
      deviceId: "device-2",
      error: null,
      isRunning: true,
      transport: "softap",
    },
  });

  render(
    <NotificationProvider>
      <NotificationProbe />
    </NotificationProvider>,
  );

  await waitFor(() => expect(mockSyncNotificationInbox).toHaveBeenCalled());
  expect(mockPollMonitoredDeviceRuntime).not.toHaveBeenCalled();
});
