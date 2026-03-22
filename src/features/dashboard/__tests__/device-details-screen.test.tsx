import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DeviceDetailsScreen from "../../../../app/device/[id]";

const mockCopyToClipboard = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRefreshDevices = jest.fn();
const mockListAssignableNurses = jest.fn();
const mockAssignColdGuardDevice = jest.fn();
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
        doorOpen: false,
        lastSeenAt: Date.now() - 60_000,
        lastConnectionTestAt: null,
        lastConnectionTestStatus: "idle",
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
  connectOrRecoverDevice: (args: unknown) => mockConnectOrRecoverDevice(args),
  decommissionColdGuardDevice: (args: unknown) => mockDecommissionColdGuardDevice(args),
  getDeviceRuntimeSession: (deviceId: string) => mockGetDeviceRuntimeSession(deviceId),
  provisionFacilityWifi: (args: unknown) => mockProvisionFacilityWifi(args),
  runColdGuardConnectionTest: (args: unknown) => mockRunColdGuardConnectionTest(args),
  startDeviceMonitoring: (deviceId: string) => mockStartDeviceMonitoring(deviceId),
  stopDeviceMonitoring: (deviceId: string) => mockStopDeviceMonitoring(deviceId),
}));

beforeEach(() => {
  jest.clearAllMocks();
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
  mockConnectOrRecoverDevice.mockResolvedValue({
    transport: "softap",
  });
  mockGetDeviceRuntimeSession.mockResolvedValue({
    activeRuntimeBaseUrl: "http://192.168.4.1",
    activeTransport: "softap",
    deviceId: "device-1",
    facilityWifiPassword: null,
    facilityWifiRuntimeBaseUrl: null,
    facilityWifiSsid: null,
    softApPassword: "softap-secret",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    lastMonitorAt: null,
    lastMonitorError: null,
    lastPingAt: null,
    lastRecoverAt: null,
    lastRuntimeError: null,
    monitoringMode: "off",
    sessionStatus: "connected",
    updatedAt: 1,
  });
  mockProvisionFacilityWifi.mockResolvedValue({
    password: "secret",
    runtimeBaseUrl: "http://10.0.0.22",
    ssid: "ClinicNet",
  });
  mockRunColdGuardConnectionTest.mockResolvedValue({
    statusText: "Connection confirmed",
  });
  mockStartDeviceMonitoring.mockResolvedValue({
    monitoringMode: "foreground_service",
  });
  mockStopDeviceMonitoring.mockResolvedValue({
    monitoringMode: "off",
  });
  mockDecommissionColdGuardDevice.mockResolvedValue(undefined);
});

test("shows supervisor assignment controls", async () => {
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  expect(ui.getByText("Choose primary nurse")).toBeTruthy();
  expect(ui.getByText("Save assignments")).toBeTruthy();
  expect(mockConnectOrRecoverDevice).not.toHaveBeenCalled();
});

test("runs the connection test from device detail", async () => {
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  expect(ui.getByText("Run connection test")).toBeTruthy();
  fireEvent.press(ui.getByText("Run connection test"));

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
  expect(ui.getByText("Reconnect")).toBeTruthy();
  expect(ui.getByText("Diagnostics")).toBeTruthy();
  expect(ui.getByText("Enable monitoring")).toBeTruthy();
  expect(ui.getByText("Save facility Wi-Fi")).toBeTruthy();
});

test("shows a monitoring permission error instead of pretending monitoring was enabled", async () => {
  mockStartDeviceMonitoring.mockRejectedValueOnce(
    new Error("Allow notifications to start ColdGuard background monitoring on this device."),
  );
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  fireEvent.press(ui.getByText("Enable monitoring"));

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
  fireEvent.press(ui.getByText("Reconnect"));

  await waitFor(() =>
    expect(ui.getByText("Allow Wi-Fi and location access to connect to the device.")).toBeTruthy(),
  );
  expect(ui.getByText("Developer code: WIFI_PERMISSION_REQUIRED")).toBeTruthy();

  fireEvent.press(ui.getByText("Copy developer code"));

  await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith("WIFI_PERMISSION_REQUIRED"));
  expect(ui.getByText("Developer code copied.")).toBeTruthy();
});
