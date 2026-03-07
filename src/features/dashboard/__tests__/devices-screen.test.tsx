import { render, waitFor } from "@testing-library/react-native";
import DevicesScreen from "../../../../app/(tabs)/devices";

const mockGetProfileSnapshot = jest.fn();
const mockGetDevicesForInstitution = jest.fn();
const mockEnsureLocalProfileForUser = jest.fn();
const mockSeedDashboardDataForInstitution = jest.fn();

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

test("renders the dedicated devices workspace", async () => {
  const ui = render(<DevicesScreen />);

  await waitFor(() => expect(ui.getByText("Devices")).toBeTruthy());
  expect(ui.getByTestId("devices-scroll-view")).toBeTruthy();
  expect(ui.getByText("Cold Room Alpha")).toBeTruthy();
  expect(ui.getByText(/Nurse scope/)).toBeTruthy();
});
