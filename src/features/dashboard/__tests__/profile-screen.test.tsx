import { render, waitFor } from "@testing-library/react-native";
import ProfileTabScreen from "../../../../app/(tabs)/profile";

const mockGetProfileSnapshot = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();

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
  const profile = {
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Supervisor",
    lastUpdatedAt: 1,
  };
  mockGetProfileSnapshot.mockResolvedValue(profile);
  mockEnsureLocalProfileForUser.mockResolvedValue(profile);
});

test("renders the personal-only profile screen", async () => {
  const ui = render(<ProfileTabScreen />);

  await waitFor(() => expect(ui.getByText("My Profile")).toBeTruthy());
  expect(ui.getByTestId("profile-scroll-view")).toBeTruthy();
  expect(ui.getByText("Akosua Mensah")).toBeTruthy();
  expect(ui.getAllByText("Supervisor").length).toBeGreaterThan(0);
  expect(ui.queryByText("Staff Management")).toBeNull();
});
