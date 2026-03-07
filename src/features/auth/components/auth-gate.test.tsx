import { render } from "@testing-library/react-native";
import { AuthGate } from "./auth-gate";

test("renders onboarding gate for signed-in unlinked users", () => {
  const ui = render(
    <AuthGate stage="signed_in_unlinked">
      <></>
    </AuthGate>,
  );

  expect(ui.getByText("Link your institution")).toBeTruthy();
});
