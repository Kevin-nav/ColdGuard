import { fireEvent, render, waitFor } from "@testing-library/react-native";
import HomeScreen from "../../../../app/(tabs)/home";

const mockPush = jest.fn();
const mockGetProfileSnapshot = jest.fn();
const mockGetDevicesForInstitution = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockSeedDashboardDataForInstitution = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (path: string) => mockPush(path) },
}));

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

jest.mock("../../../../src/lib/storage/sqlite/device-repository", () => ({
  getDevicesForInstitution: (institutionName: string) => mockGetDevicesForInstitution(institutionName),
}));

jest.mock("../../../../src/features/dashboard/services/profile-hydration", () => ({
  ensureLocalProfileForUser: (args: unknown) => mockEnsureLocalProfileForUser(args),
}));

jest.mock("../../../../src/features/dashboard/services/dashboard-seed", () => ({
  seedDashboardDataForInstitution: (institutionName: string) =>
    mockSeedDashboardDataForInstitution(institutionName),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProfileSnapshot.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  });
  mockGetDevicesForInstitution.mockResolvedValue([
    {
      id: "d1",
      institutionName: "Korle-Bu Teaching Hospital",
      nickname: "Cold Room Alpha",
      macAddress: "AA",
      currentTempC: 4.6,
      mktStatus: "safe",
      batteryLevel: 93,
      doorOpen: false,
      lastSeenAt: Date.now() - 60_000,
    },
  ]);
  mockEnsureLocalProfileForUser.mockResolvedValue(null);
  mockSeedDashboardDataForInstitution.mockResolvedValue([]);
});

test("renders the nurse dashboard with profile and devices", async () => {
  const ui = render(<HomeScreen />);

  await waitFor(() => expect(ui.getByText("ColdGuard Dashboard")).toBeTruthy());
  expect(ui.getByTestId("dashboard-scroll-view")).toBeTruthy();
  expect(ui.getByText("Akosua Mensah")).toBeTruthy();
  expect(ui.getByText("Cold Room Alpha")).toBeTruthy();
  expect(ui.getByText("Quick actions")).toBeTruthy();
  expect(ui.queryByText("Staff Management")).toBeNull();
});

test("renders supervisor-only management actions", async () => {
  mockGetProfileSnapshot.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Yaw Boateng",
    email: "yaw@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1002",
    role: "Supervisor",
    lastUpdatedAt: 1,
  });

  const ui = render(<HomeScreen />);

  await waitFor(() => expect(ui.getAllByText("Staff Management").length).toBeGreaterThan(0));
  expect(ui.getByText("Review devices")).toBeTruthy();
});

test("opens the dedicated devices screen from quick actions", async () => {
  const ui = render(<HomeScreen />);

  await waitFor(() => expect(ui.getByText("ColdGuard Dashboard")).toBeTruthy());
  fireEvent.press(ui.getByText("Open devices"));

  expect(mockPush).toHaveBeenCalledWith("/(tabs)/devices");
});
