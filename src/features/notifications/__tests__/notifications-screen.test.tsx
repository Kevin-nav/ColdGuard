import { render, waitFor } from "@testing-library/react-native";
import NotificationsScreen from "../../../../app/notifications";

const mockPush = jest.fn();
const mockUseNotificationInbox = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (path: string) => mockPush(path) },
}));

jest.mock("../../../../src/features/dashboard/hooks/use-dashboard-context", () => ({
  useDashboardContext: () => ({
    devices: [],
    error: null,
    isLoading: false,
    profile: {
      institutionName: "Korle-Bu Teaching Hospital",
    },
  }),
}));

jest.mock("../../../../src/features/notifications/hooks/use-notification-inbox", () => ({
  useNotificationInbox: () => mockUseNotificationInbox(),
}));

beforeEach(() => {
  jest.clearAllMocks();
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
    resolvedIncidents: [],
    isLoading: false,
  });
});

test("renders active notification incidents", async () => {
  const ui = render(<NotificationsScreen />);

  await waitFor(() => expect(ui.getByText("Notifications")).toBeTruthy());
  expect(ui.getByText("Temperature excursion critical")).toBeTruthy();
  expect(ui.getByTestId("notifications-scroll-view")).toBeTruthy();
});
