import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DeviceDetailsScreen from "../../../../app/device/[id]";

const mockCopyToClipboard = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockGetRecentReadingsForDevice = jest.fn();
const mockReplace = jest.fn();
const mockRefreshDevices = jest.fn();
const mockListAssignableNurses = jest.fn();
const mockAssignColdGuardDevice = jest.fn();
const mockBootstrapDefaultDeviceMonitoring = jest.fn();
const mockConnectOrRecoverDevice = jest.fn();
const mockGetDeviceRuntimeSession = jest.fn();
const mockRunColdGuardConnectionTest = jest.fn();
const mockProvisionFacilityWifi = jest.fn();
const mockStartDeviceMonitoring = jest.fn();
const mockStopDeviceMonitoring = jest.fn();
const mockDecommissionColdGuardDevice = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    replace: (path: string) => mockReplace(path),
  },
  useLocalSearchParams: () => ({ id: "device-1" }),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: (value: string) => mockCopyToClipboard(value),
}));

jest.mock("../../../../src/features/dashboard/hooks/use-dashboard-context", () => ({
  useDashboardContext: jest.fn(() => ({
    devices: [
      {
        id: "device-1",
        institutionId: "institution-1",
        institutionName: "Korle-Bu Teaching Hospital",
        nickname: "Cold Room Alpha",
        macAddress: "AA:BB:CC:DD:EE:01",
        firmwareVersion: "fw-1.0.0",
        protocolVersion: 1,
        deviceStatus: "enrolled",
        status: "enrolled",
        grantVersion: 2,
        accessRole: "manager",
        primaryAssigneeName: "Akosua Mensah",
        primaryAssigneeStaffId: "KB1001",
        viewerNames: ["Mariam Fuseini"],
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
    ],
    error: null,
    isLoading: false,
    profile: {
      firebaseUid: "u1",
      displayName: "Yaw Boateng",
      email: "yaw@example.com",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      staffId: "KB1002",
      role: "Supervisor",
      lastUpdatedAt: 1,
    },
    refreshDevices: () => mockRefreshDevices(),
  })),
}));

jest.mock("../../../../src/features/devices/services/device-directory", () => ({
  listAssignableNurses: () => mockListAssignableNurses(),
}));

jest.mock("../../../../src/features/devices/services/connection-service", () => ({
  assignColdGuardDevice: (args: unknown) => mockAssignColdGuardDevice(args),
  bootstrapDefaultDeviceMonitoring: (deviceId: string) => mockBootstrapDefaultDeviceMonitoring(deviceId),
  connectOrRecoverDevice: (args: unknown) => mockConnectOrRecoverDevice(args),
  decommissionColdGuardDevice: (args: unknown) => mockDecommissionColdGuardDevice(args),
  getDeviceRuntimeSession: (deviceId: string) => mockGetDeviceRuntimeSession(deviceId),
  provisionFacilityWifi: (args: unknown) => mockProvisionFacilityWifi(args),
  runColdGuardConnectionTest: (args: unknown) => mockRunColdGuardConnectionTest(args),
  startDeviceMonitoring: (deviceId: string) => mockStartDeviceMonitoring(deviceId),
  stopDeviceMonitoring: (deviceId: string) => mockStopDeviceMonitoring(deviceId),
}));

jest.mock("../../../../src/lib/storage/sqlite/reading-repository", () => ({
  getRecentReadingsForDevice: (...args: unknown[]) => mockGetRecentReadingsForDevice(...args),
}));

function buildDefaultDashboardContext() {
  return {
    devices: [
      {
        id: "device-1",
        institutionId: "institution-1",
        institutionName: "Korle-Bu Teaching Hospital",
        nickname: "Cold Room Alpha",
        macAddress: "AA:BB:CC:DD:EE:01",
        firmwareVersion: "fw-1.0.0",
        protocolVersion: 1,
        deviceStatus: "enrolled",
        status: "enrolled",
        grantVersion: 2,
        accessRole: "manager",
        primaryAssigneeName: "Akosua Mensah",
        primaryAssigneeStaffId: "KB1001",
        viewerNames: ["Mariam Fuseini"],
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
    ],
    error: null,
    isLoading: false,
    profile: {
      firebaseUid: "u1",
      displayName: "Yaw Boateng",
      email: "yaw@example.com",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      staffId: "KB1002",
      role: "Supervisor",
      lastUpdatedAt: 1,
    },
    refreshDevices: () => mockRefreshDevices(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  const { useDashboardContext } = jest.requireMock(
    "../../../../src/features/dashboard/hooks/use-dashboard-context",
  ) as { useDashboardContext: jest.Mock };
  useDashboardContext.mockImplementation(() => buildDefaultDashboardContext());
  mockCanGoBack.mockReturnValue(true);
  mockRefreshDevices.mockResolvedValue(undefined);
  mockListAssignableNurses.mockResolvedValue([
    {
      displayName: "Akosua Mensah",
      role: "Nurse",
      staffId: "KB1001",
    },
  ]);
  mockAssignColdGuardDevice.mockResolvedValue(undefined);
  mockBootstrapDefaultDeviceMonitoring.mockResolvedValue({
    activeRuntimeBaseUrl: "http://192.168.4.1",
    activeTransport: "softap",
    controlRole: "primary",
    deviceId: "device-1",
    facilityWifiPassword: null,
    facilityWifiRuntimeBaseUrl: null,
    facilityWifiSsid: null,
    lastMonitorAt: Date.now(),
    lastMonitorError: null,
    lastPingAt: null,
    lastRecoverAt: Date.now(),
    lastRuntimeError: null,
    monitoringMode: "foreground_service",
    primaryControllerUserId: "u1",
    primaryLeaseExpiresAt: Date.now() + 35_000,
    primaryLeaseSessionId: "lease-device-1",
    sessionStatus: "connecting",
    softApPassword: "softap-secret",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    updatedAt: 1,
  });
  mockConnectOrRecoverDevice.mockResolvedValue({
    accessMode: "temporary_shared_access",
    primaryTransport: "bluetooth",
    statusText: "Temporary shared SoftAP access is active.",
    transport: "softap",
  });
  mockGetDeviceRuntimeSession.mockResolvedValue({
    activeRuntimeBaseUrl: "http://192.168.4.1",
    activeTransport: "softap",
    controlRole: "secondary",
    deviceId: "device-1",
    facilityWifiPassword: null,
    facilityWifiRuntimeBaseUrl: null,
    facilityWifiSsid: null,
    lastMonitorAt: null,
    lastMonitorError: null,
    lastPingAt: null,
    lastRecoverAt: null,
    lastRuntimeError: null,
    monitoringMode: "off",
    primaryControllerUserId: "u9",
    primaryLeaseExpiresAt: Date.now() + 35_000,
    primaryLeaseSessionId: "lease-device-9",
    sessionStatus: "connected",
    softApPassword: "softap-secret",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    transport: "softap",
    updatedAt: 1,
  });
  mockProvisionFacilityWifi.mockResolvedValue({
    password: "secret",
    runtimeBaseUrl: "http://10.0.0.22",
    ssid: "ClinicNet",
  });
  mockRunColdGuardConnectionTest.mockResolvedValue({
    accessMode: "bluetooth_primary",
    batteryLevel: 93,
    batteryPercentEstimate: 94,
    batteryVoltageV: 4.01,
    currentTempC: 4.6,
    currentMa: 120,
    firmwareVersion: "fw-1.0.0",
    latestSequence: 12,
    lastSeenAt: Date.now(),
    macAddress: "AA:BB:CC:DD:EE:01",
    mktStatus: "safe",
    powerMw: 482,
    primaryTransport: "bluetooth",
    recordedAt: Date.now(),
    rtcIso: new Date().toISOString(),
    statusText: "Connection confirmed",
    sdCardMounted: true,
    shuntVoltageMv: 9.8,
    timeSource: "rtc",
    transport: "softap",
  });
  mockStartDeviceMonitoring.mockResolvedValue({
    monitoringMode: "foreground_service",
  });
  mockStopDeviceMonitoring.mockResolvedValue({
    monitoringMode: "off",
  });
  mockDecommissionColdGuardDevice.mockResolvedValue(undefined);
  mockGetRecentReadingsForDevice.mockResolvedValue([]);
});

test("shows supervisor assignment controls", async () => {
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  expect(ui.getByText("Choose lead nurse")).toBeTruthy();
  expect(ui.getByText("Save authorized staff")).toBeTruthy();
  expect(
    ui.getByText(
      "These assignments control who is authorized to work with this device offline. They do not pin the BLE-primary controller to one phone.",
    ),
  ).toBeTruthy();
  expect(mockConnectOrRecoverDevice).not.toHaveBeenCalled();
});

test("bootstraps monitoring automatically when the device page opens", async () => {
  render(<DeviceDetailsScreen />);

  await waitFor(() => expect(mockBootstrapDefaultDeviceMonitoring).toHaveBeenCalledWith("device-1"));
  expect(mockRefreshDevices).toHaveBeenCalled();
});

test("runs the connection test from device detail", async () => {
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  expect(ui.getByText("Run transport check")).toBeTruthy();
  fireEvent.press(ui.getByText("Run transport check"));

  await waitFor(() => expect(mockRunColdGuardConnectionTest).toHaveBeenCalledWith({ deviceId: "device-1" }));
});

test("falls back to the devices tab when no back stack is available", async () => {
  mockCanGoBack.mockReturnValue(false);
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  fireEvent.press(ui.getByTestId("device-back-button"));

  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/devices");
});

test("shows pending for an idle connection status", async () => {
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  expect(ui.getByText("Pending")).toBeTruthy();
  expect(ui.queryByText("Running")).toBeNull();
  expect(ui.getByText("Open temporary SoftAP access")).toBeTruthy();
  expect(ui.getByText("Live diagnostics")).toBeTruthy();
  expect(ui.getByText("Disable monitoring")).toBeTruthy();
  expect(ui.getByText("Save facility Wi-Fi")).toBeTruthy();
  expect(ui.getByText("Not established")).toBeTruthy();
  expect(ui.getByText("Primary Bluetooth controller")).toBeTruthy();
  expect(
    ui.getByText(
      "This phone currently holds the BLE-primary lease and will keep primary control while it remains nearby.",
    ),
  ).toBeTruthy();
});

test("keeps quick-connect devices on the nurse-facing summary view", async () => {
  const { useDashboardContext } = jest.requireMock(
    "../../../../src/features/dashboard/hooks/use-dashboard-context",
  ) as { useDashboardContext: jest.Mock };
  const now = Date.now();
  const quickConnectContext = {
    devices: [
      {
        id: "device-1",
        institutionId: "institution-1",
        institutionName: "Korle-Bu Teaching Hospital",
        localAccessMode: "quick_connect",
        nickname: "Cold Room Alpha",
        macAddress: "AA:BB:CC:DD:EE:01",
        firmwareVersion: "fw-1.0.0",
        protocolVersion: 1,
        deviceStatus: "enrolled",
        status: "enrolled",
        grantVersion: 2,
        accessRole: "viewer",
        primaryAssigneeName: null,
        primaryAssigneeStaffId: null,
        viewerNames: [],
        currentTempC: 4.6,
        mktStatus: "safe",
        batteryLevel: 93,
        batteryPercentEstimate: 94,
        batteryVoltageV: 4.01,
        currentMa: 120,
        latestSequence: 12,
        lastSeenAt: now - 60_000,
        lastConnectionTestAt: null,
        lastConnectionTestStatus: "idle",
        powerMw: 482,
        recordedAt: now - 60_000,
        rtcIso: new Date(now - 60_000).toISOString(),
        sdCardMounted: true,
        shuntVoltageMv: 9.8,
        timeSource: "rtc",
      },
    ],
    error: null,
    isLoading: false,
    profile: {
      firebaseUid: "u1",
      displayName: "Akosua Mensah",
      email: "akosua@example.com",
      institutionId: "institution-1",
      institutionName: "Korle-Bu Teaching Hospital",
      staffId: "KB1001",
      role: "Nurse",
      lastUpdatedAt: 1,
    },
    refreshDevices: () => mockRefreshDevices(),
  };

  useDashboardContext.mockImplementation(() => quickConnectContext);
  mockGetRecentReadingsForDevice.mockResolvedValueOnce([{ currentTempC: 4.8 }, { currentTempC: 6.2 }]);

  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getByText("Connected")).toBeTruthy());
  expect(ui.getByText("MKT")).toBeTruthy();
  expect(ui.getByText("Raw temperature")).toBeTruthy();
  expect(ui.getByText("Last update")).toBeTruthy();
  expect(ui.getByText("Device status")).toBeTruthy();
  expect(ui.getByText("Refresh readings")).toBeTruthy();
  expect(ui.getByText("Reconnect")).toBeTruthy();
  expect(ui.queryByText("Connection Tools")).toBeNull();
  expect(ui.queryByText("Authorized Access")).toBeNull();
  expect(ui.queryByText("Supervisor Actions")).toBeNull();
  expect(ui.queryByText("Run transport check")).toBeNull();
  expect(ui.queryByText("Open temporary SoftAP access")).toBeNull();
  expect(ui.queryByText("Live diagnostics")).toBeNull();
  expect(ui.queryByText("Save facility Wi-Fi")).toBeNull();
  expect(ui.queryByText("Developer code")).toBeNull();
});

test("shows a monitoring permission error instead of pretending monitoring was enabled", async () => {
  mockStartDeviceMonitoring.mockRejectedValueOnce(
    new Error("Allow notifications to start ColdGuard background monitoring on this device."),
  );
  mockBootstrapDefaultDeviceMonitoring.mockRejectedValueOnce(
    new Error("Allow notifications to start ColdGuard background monitoring on this device."),
  );
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() =>
    expect(
      ui.getByText("Allow notifications to start ColdGuard background monitoring on this device."),
    ).toBeTruthy(),
  );
});

test("shows a user-facing reconnect error and lets developers copy the raw code", async () => {
  mockConnectOrRecoverDevice.mockRejectedValueOnce(new Error("WIFI_PERMISSION_REQUIRED"));
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  fireEvent.press(ui.getByText("Open temporary SoftAP access"));

  await waitFor(() =>
    expect(ui.getByText("Allow Wi-Fi and location access to connect to the device.")).toBeTruthy(),
  );
  expect(ui.getByText("Developer code: WIFI_PERMISSION_REQUIRED")).toBeTruthy();

  fireEvent.press(ui.getByText("Copy developer code"));

  await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith("WIFI_PERMISSION_REQUIRED"));
  expect(ui.getByText("Developer code copied.")).toBeTruthy();
});
