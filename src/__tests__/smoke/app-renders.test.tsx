import { render, waitFor } from "@testing-library/react-native";
import Index from "../../../app/index";
import TabsLayout from "../../../app/(tabs)/_layout";
import { useAuthSession } from "../../../src/features/auth/providers/auth-provider";
import { ensureLocalProfileForUser } from "../../../src/features/dashboard/services/profile-hydration";
import { getProfileSnapshot } from "../../../src/lib/storage/sqlite/profile-repository";

const mockRedirect = jest.fn<null, [unknown]>(() => null);
function MockTabs(props: { children: React.ReactNode }) {
  return <>{props.children}</>;
}
function MockTabsScreen() {
  return null;
}
MockTabs.Screen = MockTabsScreen;

jest.mock("expo-router", () => ({
  Redirect: (props: unknown) => mockRedirect(props),
  Tabs: MockTabs,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../../src/features/auth/providers/auth-provider", () => ({
  useAuthSession: jest.fn(() => ({
    isLoading: false,
    providerId: null,
    user: null,
  })),
}));

jest.mock("../../../src/lib/storage/sqlite/profile-repository", () => ({
  getProfileSnapshot: jest.fn(),
}));

jest.mock("../../../src/features/dashboard/services/profile-hydration", () => ({
  ensureLocalProfileForUser: jest.fn(),
}));

jest.mock("../../../src/theme/theme-provider", () => ({
  useTheme: jest.fn(() => ({
    colors: {
      background: "#fff",
      border: "#ddd",
      primary: "#000",
      surface: "#f7f7f7",
      textSecondary: "#666",
    },
  })),
}));

jest.mock("../../../src/features/dashboard/components/top-nav", () => ({
  TopNav: () => null,
}));

test("root index screen renders", () => {
  const { toJSON } = render(<Index />);
  expect(toJSON()).toBeNull();
});

test("falls back to login when startup profile resolution throws", async () => {
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  jest.mocked(useAuthSession).mockReturnValue({
    isLoading: false,
    providerId: null,
    user: {
      uid: "u1",
      email: "user@example.com",
      displayName: "User One",
    } as any,
  });
  jest.mocked(getProfileSnapshot).mockRejectedValue(new Error("sqlite unavailable"));

  render(<Index />);

  await waitFor(() => {
    expect(mockRedirect).toHaveBeenCalledWith({ href: "/(auth)/login" });
  });

  expect(jest.mocked(ensureLocalProfileForUser)).not.toHaveBeenCalled();
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    "Failed to resolve start route.",
    expect.any(Error),
  );

  consoleErrorSpy.mockRestore();
});

test("tabs layout redirects declaratively when there is no authenticated user", () => {
  jest.mocked(useAuthSession).mockReturnValue({
    isLoading: false,
    providerId: null,
    user: null,
  });

  render(<TabsLayout />);

  expect(mockRedirect).toHaveBeenCalledWith({ href: "/(auth)/login" });
});
