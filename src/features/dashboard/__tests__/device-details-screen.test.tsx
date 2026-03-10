import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DeviceDetailsScreen from "../../../../app/device/[id]";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockRefreshDevices = jest.fn();
const mockListAssignableNurses = jest.fn();
const mockAssignColdGuardDevice = jest.fn();
const mockRunColdGuardConnectionTest = jest.fn();
const mockDecommissionColdGuardDevice = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: () => mockBack(),
    replace: (path: string) => mockReplace(path),
  },
  useLocalSearchParams: () => ({ id: "device-1" }),
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
  decommissionColdGuardDevice: (args: unknown) => mockDecommissionColdGuardDevice(args),
  runColdGuardConnectionTest: (args: unknown) => mockRunColdGuardConnectionTest(args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshDevices.mockResolvedValue(undefined);
  mockListAssignableNurses.mockResolvedValue([
    {
      displayName: "Akosua Mensah",
      role: "Nurse",
      staffId: "KB1001",
    },
  ]);
  mockAssignColdGuardDevice.mockResolvedValue(undefined);
  mockRunColdGuardConnectionTest.mockResolvedValue({
    statusText: "Connection confirmed",
  });
  mockDecommissionColdGuardDevice.mockResolvedValue(undefined);
});

test("shows supervisor assignment controls", async () => {
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  expect(ui.getByText("Choose primary nurse")).toBeTruthy();
  expect(ui.getByText("Save assignments")).toBeTruthy();
});

test("runs the connection test from device detail", async () => {
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  expect(ui.getByText("Run connection test")).toBeTruthy();
  fireEvent.press(ui.getByText("Run connection test"));

  await waitFor(() => expect(mockRunColdGuardConnectionTest).toHaveBeenCalledWith({ deviceId: "device-1" }));
});

test("shows pending for an idle connection status", async () => {
  const ui = render(<DeviceDetailsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  expect(ui.getByText("Pending")).toBeTruthy();
  expect(ui.queryByText("Running")).toBeNull();
});
