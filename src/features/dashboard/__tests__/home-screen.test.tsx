import { render, waitFor } from "@testing-library/react-native";
import HomeScreen from "../../../../app/(tabs)/home";

const mockPush = jest.fn();
const mockGetProfileSnapshot = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockSyncVisibleDevices = jest.fn();
const mockEnsureSupervisorAdminGrant = jest.fn();
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

jest.mock("../../../../src/features/dashboard/services/profile-hydration", () => ({
  ensureLocalProfileForUser: (args: unknown) => mockEnsureLocalProfileForUser(args),
}));

jest.mock("../../../../src/features/devices/services/device-directory", () => ({
  ensureSupervisorAdminGrant: (profile: unknown) => mockEnsureSupervisorAdminGrant(profile),
  syncVisibleDevices: (profile: unknown) => mockSyncVisibleDevices(profile),
}));

jest.mock("../../../../src/features/notifications/hooks/use-notification-inbox", () => ({
  useNotificationInbox: () => mockUseNotificationInbox(),
}));

jest.mock("../../../../src/components/animated-entry", () => ({
  AnimatedEntry: ({ children }: { children: unknown }) => children,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProfileSnapshot.mockResolvedValue({
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
  mockEnsureSupervisorAdminGrant.mockResolvedValue(null);
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

  await waitFor(() => {
    expect(ui.queryByText("Welcome back, Akosua")).toBeTruthy();
    expect(ui.queryByText("All systems normal")).toBeTruthy();
    expect(ui.queryByTestId("dashboard-scroll-view")).toBeTruthy();
    expect(ui.queryByText("Cold Room Alpha")).toBeTruthy();
    expect(ui.queryByText("Recent incidents")).toBeTruthy();
    expect(ui.queryByText("Temperature excursion critical")).toBeTruthy();
  });
});

