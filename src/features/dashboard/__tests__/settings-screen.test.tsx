import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SettingsScreen from "../../../../app/(tabs)/settings";

const mockGetProfileSnapshot = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve());
const mockReplace = jest.fn();
const mockUseNotificationPreferences = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: (path: string) => mockReplace(path) },
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

jest.mock("../../../../src/lib/storage/sqlite/device-repository", () => ({
  getDevicesForInstitution: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../../../src/features/dashboard/services/profile-hydration", () => ({
  ensureLocalProfileForUser: (args: unknown) => mockEnsureLocalProfileForUser(args),
}));

jest.mock("../../../../src/features/dashboard/services/dashboard-seed", () => ({
  seedDashboardDataForInstitution: jest.fn(() => Promise.resolve([])),
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
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  });
  mockEnsureLocalProfileForUser.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  });
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

test("renders friendly notification settings, saves routine preferences, and signs out", async () => {
  const ui = render(<SettingsScreen />);

  await waitFor(() => expect(ui.getByText("Alert settings")).toBeTruthy());
  expect(ui.getByText("Critical alerts are always on.")).toBeTruthy();
  expect(ui.getByText("What should interrupt you")).toBeTruthy();
  expect(ui.getByText("Temperature")).toBeTruthy();
  expect(ui.getByText("Low battery")).toBeTruthy();
  expect(ui.queryAllByText("Critical alerts always on")).toHaveLength(0);

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
