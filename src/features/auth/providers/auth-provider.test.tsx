import { renderHook } from "@testing-library/react-native";
import { AuthProvider, useAuthSession } from "./auth-provider";

const mockClearAuth = jest.fn();
const mockSetAuth = jest.fn();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(() => () => {}),
}));

jest.mock("../../../lib/firebase/client", () => ({
  getFirebaseAuth: jest.fn(() => ({})),
}));

jest.mock("../../../lib/convex/client", () => ({
  getConvexClient: jest.fn(() => ({
    clearAuth: mockClearAuth,
    setAuth: mockSetAuth,
  })),
}));

test("provider exposes loading state initially", () => {
  const { result } = renderHook(() => useAuthSession(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  });

  expect(result.current.isLoading).toBe(true);
});
