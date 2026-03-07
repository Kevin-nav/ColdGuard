import { fireEvent, render } from "@testing-library/react-native";
import { TopNav } from "../../dashboard/components/top-nav";

const mockPush = jest.fn();

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-router", () => ({
  router: { push: (path: string) => mockPush(path) },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));

jest.mock("../../dashboard/hooks/use-dashboard-context", () => ({
  useDashboardContext: () => ({
    profile: {
      institutionName: "Korle-Bu Teaching Hospital",
    },
  }),
}));

jest.mock("../hooks/use-unread-count", () => ({
  useUnreadCount: () => 3,
}));

test("shows unread badge and opens notifications", () => {
  const ui = render(<TopNav />);

  expect(ui.getByTestId("notifications-unread-badge")).toBeTruthy();
  fireEvent.press(ui.getByTestId("top-nav-notifications-button"));
  expect(mockPush).toHaveBeenCalledWith("/notifications");
});
