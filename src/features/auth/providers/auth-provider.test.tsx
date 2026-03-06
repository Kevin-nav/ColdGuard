import { renderHook } from "@testing-library/react-native";
import { AuthProvider, useAuthSession } from "./auth-provider";

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(() => () => {}),
}));

jest.mock("../../../lib/firebase/client", () => ({
  getFirebaseAuth: jest.fn(() => ({})),
}));

test("provider exposes loading state initially", () => {
  const { result } = renderHook(() => useAuthSession(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  });

  expect(result.current.isLoading).toBe(true);
});
