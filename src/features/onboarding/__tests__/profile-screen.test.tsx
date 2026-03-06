import { fireEvent, render } from "@testing-library/react-native";
import OnboardingProfileScreen from "../../../../app/(onboarding)/profile";

const mockReplace = jest.fn();
const mockGetProfileSnapshot = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: (value: unknown) => mockReplace(value) },
  useLocalSearchParams: jest.fn(() => ({
    displayName: "Akosua Mensah",
    institutionName: "Korle-Bu Teaching Hospital",
    role: "Supervisor",
    staffId: "KB1001",
  })),
}));

jest.mock("../../../../src/features/auth/providers/auth-provider", () => ({
  useAuthSession: jest.fn(() => ({
    user: {
      uid: "firebase-user-1",
      email: "nurse@example.com",
      displayName: "Akosua Mensah",
    },
  })),
}));

jest.mock("../../../../src/lib/storage/sqlite/profile-repository", () => ({
  getProfileSnapshot: () => mockGetProfileSnapshot(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProfileSnapshot.mockResolvedValue(null);
});

test("shows only the current user's profile details", () => {
  const ui = render(<OnboardingProfileScreen />);

  expect(ui.getByText("Profile confirmed")).toBeTruthy();
  expect(ui.getAllByText("Akosua Mensah").length).toBeGreaterThan(0);
  expect(ui.getAllByText("Supervisor").length).toBeGreaterThan(0);
  expect(ui.getByText("nurse@example.com")).toBeTruthy();
  expect(ui.getByText("firebase-user-1")).toBeTruthy();
  expect(ui.getAllByText("Korle-Bu Teaching Hospital").length).toBeGreaterThan(0);
  expect(ui.getByText("KB1001")).toBeTruthy();
  expect(ui.getByText(/Supervisor access will include nurse management/)).toBeTruthy();
});

test("continues to the dashboard from the profile screen", () => {
  const ui = render(<OnboardingProfileScreen />);

  fireEvent.press(ui.getByText("Continue to Dashboard"));

  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/home");
});
