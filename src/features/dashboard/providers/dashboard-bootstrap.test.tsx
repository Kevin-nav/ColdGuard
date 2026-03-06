import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { DashboardBootstrapProvider, useDashboardBootstrap } from "./dashboard-bootstrap";

const mockInitializeSQLite = jest.fn(async () => undefined);

jest.mock("../../../lib/storage/sqlite/client", () => ({
  initializeSQLite: () => mockInitializeSQLite(),
}));

function Probe() {
  const state = useDashboardBootstrap();
  return <Text>{state.isReady ? "ready" : state.error ? state.error : "loading"}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("initializes sqlite once at boot", async () => {
  const ui = render(
    <DashboardBootstrapProvider>
      <Probe />
    </DashboardBootstrapProvider>,
  );

  await waitFor(() => expect(ui.getByText("ready")).toBeTruthy());
  expect(mockInitializeSQLite).toHaveBeenCalledTimes(1);
});
