import { fireEvent, render, waitFor } from "@testing-library/react-native";
import HomeScreen from "../../../../app/(tabs)/home";

const mockPush = jest.fn();
const mockGetProfileSnapshot = jest.fn();
const mockGetDevicesForInstitution = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockSeedDashboardDataForInstitution = jest.fn();
const mockUseNotificationInbox = jest.fn();

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

jest.mock("../../../../src/features/notifications/hooks/use-notification-inbox", () => ({
  useNotificationInbox: () => mockUseNotificationInbox(),
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
  mockEnsureLocalProfileForUser.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  });
  mockSeedDashboardDataForInstitution.mockResolvedValue([]);
  mockUseNotificationInbox.mockReturnValue({
    activeIncidents: [
      {
        id: "incident-1",
        deviceNickname: "Cold Room Alpha",
        incidentType: "temperature",
        severity: "critical",
        title: "Temperature excursion critical",
        body: "Cold Room Alpha remains outside the safe range and needs intervention.",
        status: "open",
        readAt: null,
        lastTriggeredAt: Date.now(),
      },
    ],
    markRead: jest.fn(),
  });
});

test("renders the dashboard with system overview, incidents, and devices", async () => {
  const ui = render(<HomeScreen />);

  await waitFor(() => expect(ui.getByText("Welcome back, Akosua")).toBeTruthy());
  expect(ui.getByText("All systems normal")).toBeTruthy();
  expect(ui.getByTestId("dashboard-scroll-view")).toBeTruthy();
  expect(ui.getByText("Cold Room Alpha")).toBeTruthy();
  expect(ui.getByText("Recent incidents")).toBeTruthy();
  expect(ui.getByText("Temperature excursion critical")).toBeTruthy();
});

test("opens device card when a device is tapped", async () => {
  const ui = render(<HomeScreen />);

  await waitFor(() => expect(ui.getByText("Cold Room Alpha")).toBeTruthy());
  fireEvent.press(ui.getByText("Cold Room Alpha"));

  expect(mockPush).toHaveBeenCalledWith("/device/d1");
});
