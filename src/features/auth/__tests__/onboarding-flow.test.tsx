import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthGate } from "../components/auth-gate";

test("moves from signed-in unlinked to ready", async () => {
  const ui = render(
    <AuthGate stage="signed_in_unlinked">
      <Text>Ready screen</Text>
    </AuthGate>,
  );

  expect(ui.getByText("Link your institution")).toBeTruthy();

  ui.rerender(
    <AuthGate stage="ready">
      <Text>Ready screen</Text>
    </AuthGate>,
  );
  expect(ui.getByText("Ready screen")).toBeTruthy();
});
