import { render, waitFor } from "@testing-library/react-native";
import DevicesScreen from "../../../../app/(tabs)/devices";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));


const mockGetProfileSnapshot = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
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
      doorOpen: false,
      lastSeenAt: Date.now() - 60_000,
      lastConnectionTestAt: null,
      lastConnectionTestStatus: "idle",
    },
  ]);
  mockEnsureLocalProfileForUser.mockResolvedValue(profile);
  mockEnsureSupervisorAdminGrant.mockResolvedValue(null);
});

test("renders the dedicated devices workspace", async () => {
  const ui = render(<DevicesScreen />);

  await waitFor(() => expect(ui.getByText("Devices")).toBeTruthy());
  expect(ui.getByTestId("devices-scroll-view")).toBeTruthy();
  expect(ui.getByText("Cold Room Alpha")).toBeTruthy();
  expect(ui.getByText(/Nurse access/)).toBeTruthy();
});
