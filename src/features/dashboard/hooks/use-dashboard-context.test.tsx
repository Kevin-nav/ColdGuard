import { renderHook, waitFor } from "@testing-library/react-native";
import { useDashboardContext } from "./use-dashboard-context";

const mockEnsureLocalProfileForUser = jest.fn();
const mockSyncVisibleDevices = jest.fn();

jest.mock("../providers/dashboard-bootstrap", () => ({
  useDashboardBootstrap: jest.fn(() => ({
    error: null,
    isReady: true,
  })),
}));

jest.mock("../../auth/providers/auth-provider", () => ({
  useAuthSession: jest.fn(() => ({
    user: {
      uid: "u1",
      email: "akosua@example.com",
      displayName: "Akosua Mensah",
    },
  })),
}));

jest.mock("../services/profile-hydration", () => ({
  ensureLocalProfileForUser: (args: unknown) => mockEnsureLocalProfileForUser(args),
}));

jest.mock("../../devices/services/device-directory", () => ({
  syncVisibleDevices: (profile: unknown) => mockSyncVisibleDevices(profile),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsureLocalProfileForUser.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  });
  mockSyncVisibleDevices.mockResolvedValue([
    {
      id: "d1",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      nickname: "Cold Room Alpha",
      macAddress: "AA",
      firmwareVersion: "fw-1.0.0",
      protocolVersion: 1,
      deviceStatus: "enrolled",
      status: "enrolled",
      grantVersion: 1,
      accessRole: "primary",
      primaryAssigneeName: "Akosua Mensah",
      primaryAssigneeStaffId: "KB1001",
      viewerNames: [],
      currentTempC: 4.6,
      mktStatus: "safe",
      batteryLevel: 93,
      batteryPercentEstimate: 94,
      batteryVoltageV: 4.01,
      currentMa: 120,
      latestSequence: 12,
      lastSeenAt: Date.now() - 60_000,
      lastConnectionTestAt: null,
      lastConnectionTestStatus: "idle",
      powerMw: 482,
      recordedAt: Date.now() - 60_000,
      rtcIso: new Date(Date.now() - 60_000).toISOString(),
      sdCardMounted: true,
      shuntVoltageMv: 9.8,
      timeSource: "rtc",
      lastConnectionSyncStatus: "idle",
      lastConnectionSyncUpdatedAt: null,
      lastConnectionSyncFailureStage: null,
      lastConnectionSyncError: null,
    },
  ]);
});

test("keeps refreshDevices stable across rerenders", async () => {
  const { result, rerender } = renderHook(() => useDashboardContext());

  await waitFor(() => expect(result.current.profile?.institutionId).toBe("institution-1"));

  const firstRefreshDevices = result.current.refreshDevices;

  rerender({});

  expect(result.current.refreshDevices).toBe(firstRefreshDevices);
});
