import { fireEvent, render } from "@testing-library/react-native";
import LoginScreen from "../../../../app/(auth)/login";

const mockPromptAsync = jest.fn();
const mockUseIdTokenAuthRequest = jest.fn((_config?: unknown) => [
  { type: "request" },
  null,
  mockPromptAsync,
]);

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));

jest.mock("expo-auth-session/providers/google", () => ({
  useIdTokenAuthRequest: (config: unknown) => mockUseIdTokenAuthRequest(config),
}));

jest.mock("@expo/vector-icons", () => ({
  AntDesign: () => null,
  Ionicons: () => null,
}));

jest.mock("../../../../src/features/auth/services/email-auth", () => ({
  signInWithEmailPassword: jest.fn(),
  registerWithEmailPassword: jest.fn(),
}));

jest.mock("../../../../src/features/auth/services/user-bootstrap", () => ({
  bootstrapUserInConvex: jest.fn(),
}));

jest.mock("../../../../src/features/auth/services/google-auth", () => ({
  hasGoogleClientConfig: jest.fn(() => true),
  signInWithGoogleIdToken: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseIdTokenAuthRequest.mockReturnValue([{ type: "request" }, null, mockPromptAsync]);
});

test("shows sign-in mode by default", () => {
  const ui = render(<LoginScreen />);

  expect(ui.getByText("Sign in")).toBeTruthy();
  expect(ui.getByText("Don't have an account? Create one")).toBeTruthy();
});

test("toggles to create-account mode and back", () => {
  const ui = render(<LoginScreen />);

  fireEvent.press(ui.getByText("Don't have an account? Create one"));
  expect(ui.getByText("Create account")).toBeTruthy();
  expect(ui.getByText("Already have an account? Sign in")).toBeTruthy();

  fireEvent.press(ui.getByText("Already have an account? Sign in"));
  expect(ui.getByText("Sign in")).toBeTruthy();
  expect(ui.getByText("Don't have an account? Create one")).toBeTruthy();
});

test("hides password guidance in sign-in mode and shows it in create-account mode", () => {
  const ui = render(<LoginScreen />);

  expect(ui.queryByText("Password requirements")).toBeNull();
  fireEvent.press(ui.getByText("Don't have an account? Create one"));
  expect(ui.getByText("Password requirements")).toBeTruthy();
});

test("disables create-account submit until password is fully valid", () => {
  const ui = render(<LoginScreen />);
  fireEvent.press(ui.getByText("Don't have an account? Create one"));

  const submitButton = ui.getByTestId("primary-submit-button");
  const passwordInput = ui.getByPlaceholderText("Password");

  expect(submitButton.props.accessibilityState?.disabled).toBe(true);
  fireEvent.changeText(passwordInput, "short");
  expect(submitButton.props.accessibilityState?.disabled).toBe(true);

  fireEvent.changeText(passwordInput, "Abcdefg1");
  expect(submitButton.props.accessibilityState?.disabled).toBe(false);
});

test("renders social divider and google button label", () => {
  const ui = render(<LoginScreen />);

  expect(ui.getByText("or")).toBeTruthy();
  expect(ui.getByText("Continue with Google")).toBeTruthy();
});
