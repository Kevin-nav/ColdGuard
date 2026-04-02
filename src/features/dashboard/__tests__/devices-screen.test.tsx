import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import DevicesScreen from "../../../../app/(tabs)/devices";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));


const mockGetProfileSnapshot = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockQuickConnectColdGuardDevice = jest.fn();
const mockSyncVisibleDevices = jest.fn();
const mockEnsureSupervisorAdminGrant = jest.fn();

jest.mock("../../../../src/features/dashboard/providers/dashboard-bootstrap", () => ({
  useDashboardBootstrap: jest.fn(() => ({
    error: null,
    isReady: true,
  })),
}));

jest.mock("../../../../src/features/auth/providers/auth-provider", () => ({
  useAuthSession: jest.fn(() => ({
    user: {
      uid: "u1",
      email: "akosua@example.com",
      displayName: "Akosua Mensah",
    },
  })),
}));

jest.mock("../../../../src/lib/storage/sqlite/profile-repository", () => ({
  getProfileSnapshot: () => mockGetProfileSnapshot(),
}));

jest.mock("../../../../src/features/dashboard/services/profile-hydration", () => ({
  ensureLocalProfileForUser: (args: unknown) => mockEnsureLocalProfileForUser(args),
}));

jest.mock("../../../../src/features/devices/services/device-directory", () => ({
  ensureSupervisorAdminGrant: (profile: unknown) => mockEnsureSupervisorAdminGrant(profile),
  syncVisibleDevices: (profile: unknown) => mockSyncVisibleDevices(profile),
}));

jest.mock("../../../../src/features/devices/services/quick-connect", () => ({
  quickConnectColdGuardDevice: (args: unknown) => mockQuickConnectColdGuardDevice(args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  const profile = {
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  };
  mockGetProfileSnapshot.mockResolvedValue(profile);
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
    },
  ]);
  mockEnsureLocalProfileForUser.mockResolvedValue(profile);
  mockEnsureSupervisorAdminGrant.mockResolvedValue(null);
  mockQuickConnectColdGuardDevice.mockResolvedValue({
    deviceId: "d1",
    snapshot: {
      runtimeBaseUrl: "http://192.168.4.1",
      transport: "softap",
    },
  });
});

test("renders the dedicated devices workspace", async () => {
  const ui = render(<DevicesScreen />);

  await waitFor(() => expect(ui.getByText("Devices")).toBeTruthy());
  expect(ui.getByTestId("devices-scroll-view")).toBeTruthy();
  expect(ui.getByTestId("devices-scroll-view").props.refreshControl).toBeTruthy();
  expect(ui.getByText("Cold Room Alpha")).toBeTruthy();
  expect(ui.getByText(/Nurse access/)).toBeTruthy();
  expect(ui.getByText("Open nearby device")).toBeTruthy();
  expect(ui.getByText("Quick connect")).toBeTruthy();
});

test("refreshes on later tab focuses without double-loading on initial mount", async () => {
  const { useFocusEffect } = jest.requireMock("expo-router") as { useFocusEffect: jest.Mock };

  render(<DevicesScreen />);

  await waitFor(() => expect(mockSyncVisibleDevices).toHaveBeenCalledTimes(1));

  const onFocus = useFocusEffect.mock.calls[0][0] as () => void;

  await act(async () => {
    onFocus();
    onFocus();
  });

  await waitFor(() => expect(mockSyncVisibleDevices).toHaveBeenCalledTimes(2));
});

test("starts the default quick connect flow", async () => {
  const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };
  const ui = render(<DevicesScreen />);

  await waitFor(() => expect(ui.getByText("Quick connect")).toBeTruthy());

  fireEvent.changeText(ui.getByPlaceholderText("CG-ESP32-A100"), "CG-ESP32-A100");
  fireEvent.changeText(ui.getByPlaceholderText("Cold Room Alpha (optional)"), "Cold Room Alpha");
  fireEvent.changeText(ui.getByPlaceholderText("ColdGuard_A100"), "ColdGuard_A100");
  fireEvent.changeText(ui.getByPlaceholderText("SoftAP password"), "demo-pass-1");
  fireEvent.press(ui.getByText("Quick connect"));

  await waitFor(() =>
    expect(mockQuickConnectColdGuardDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "CG-ESP32-A100",
        nickname: "Cold Room Alpha",
        password: "demo-pass-1",
        ssid: "ColdGuard_A100",
      }),
    ),
  );
  expect(router.push).toHaveBeenCalledWith("/device/d1");
});
