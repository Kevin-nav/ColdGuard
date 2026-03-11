import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SettingsScreen from "../../../../app/(tabs)/settings";

const mockGetProfileSnapshot = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve());
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockUseNotificationPreferences = jest.fn();
const mockSyncVisibleDevices = jest.fn();

jest.mock("expo-router", () => ({
  router: { 
    replace: (path: string) => mockReplace(path),
    push: (path: string) => mockPush(path),
  },
}));

jest.mock("firebase/auth", () => ({
  signOut: () => mockSignOut(),
}));

jest.mock("../../../../src/lib/firebase/client", () => ({
  getFirebaseAuth: jest.fn(() => ({})),
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
  syncVisibleDevices: (profile: unknown) => mockSyncVisibleDevices(profile),
}));

jest.mock("../../../../src/features/notifications/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => mockUseNotificationPreferences(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  const savePreferences = jest.fn(() => Promise.resolve());
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
  mockSyncVisibleDevices.mockResolvedValue([]);
  mockUseNotificationPreferences.mockReturnValue({
    permissionStatus: "granted",
    preferences: {
      warningPushEnabled: true,
      warningLocalEnabled: true,
      recoveryPushEnabled: true,
      nonCriticalByType: {
        temperature: true,
        door_open: true,
        device_offline: true,
        battery_low: true,
      },
      quietHoursStart: null,
      quietHoursEnd: null,
      lastUpdatedAt: 1,
    },
    requestPermissions: jest.fn(),
    savePreferences,
  });
});

test("renders profile section, routine preferences, and signs out", async () => {
  const ui = render(<SettingsScreen />);

  await waitFor(() => expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0));
  
  // Profile assertions
  expect(ui.getByText("Nurse")).toBeTruthy();
  expect(ui.getByText("akosua@example.com")).toBeTruthy();
  expect(ui.getByText("Korle-Bu Teaching Hospital")).toBeTruthy();
  expect(ui.getByText("KB1001")).toBeTruthy();
  
  // Settings assertions
  expect(ui.getByText("ROUTINE ALERTS")).toBeTruthy();
  expect(ui.getByText("Temperature")).toBeTruthy();
  expect(ui.getByText("Warnings when a unit drifts outside safe range.")).toBeTruthy();
  
  expect(ui.queryAllByText("Alert settings")).toHaveLength(0);

  fireEvent(ui.getByLabelText("Temperature routine alerts"), "valueChange", false);

  await waitFor(() =>
    expect(mockUseNotificationPreferences.mock.results[0]?.value.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        nonCriticalByType: expect.objectContaining({
          temperature: false,
        }),
      }),
    ),
  );

  fireEvent.press(ui.getByText("Sign out"));

  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
});

test("renders supervisor-only management actions in settings", async () => {
  mockGetProfileSnapshot.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Yaw Boateng",
    email: "yaw@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1002",
    role: "Supervisor",
    lastUpdatedAt: 1,
  });
  mockEnsureLocalProfileForUser.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Yaw Boateng",
    email: "yaw@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1002",
    role: "Supervisor",
    lastUpdatedAt: 1,
  });

  const ui = render(<SettingsScreen />);

  await waitFor(() => expect(ui.getAllByText("FACILITY MANAGEMENT").length).toBeGreaterThan(0));
  expect(ui.getByText("Staff Management")).toBeTruthy();
  
  fireEvent.press(ui.getByText("Staff Management"));
  expect(mockPush).toHaveBeenCalledWith("/staff-management");
});
