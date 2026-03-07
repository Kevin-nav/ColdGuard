import { fireEvent, render, waitFor } from "@testing-library/react-native";
import StaffManagementScreen from "../../../../app/staff-management";

const mockGetProfileSnapshot = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: (path: string) => mockReplace(path) },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsureLocalProfileForUser.mockImplementation(async (args: any) => ({
    firebaseUid: args.firebaseUid,
    displayName: args.displayName ?? "ColdGuard User",
    email: args.email ?? "user@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  }));
});

test("blocks nurse access to staff management", async () => {
  mockEnsureLocalProfileForUser.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Nurse",
    lastUpdatedAt: 1,
  });

  const ui = render(<StaffManagementScreen />);

  await waitFor(() =>
    expect(ui.getByText("Staff management is available to supervisors only.")).toBeTruthy(),
  );
});

test("lets supervisors open the dedicated staff management workspace", async () => {
  mockEnsureLocalProfileForUser.mockResolvedValue({
    firebaseUid: "u1",
    displayName: "Yaw Boateng",
    email: "yaw@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1002",
    role: "Supervisor",
    lastUpdatedAt: 1,
  });

  const ui = render(<StaffManagementScreen />);

  await waitFor(() => expect(ui.getByText("Supervisor tools")).toBeTruthy());
  fireEvent.press(ui.getByText("Back to dashboard"));

  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/home");
});
