import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuthSession } from "./auth-provider";

const mockClearAuth = jest.fn();
const mockSetAuth = jest.fn();
const mockBootstrapUserInConvex = jest.fn();
let authStateChangeListener: ((user: any) => void) | null = null;

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn((_auth, callback) => {
    authStateChangeListener = callback;
    return () => {};
  }),
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

jest.mock("../services/user-bootstrap", () => ({
  bootstrapUserInConvex: (...args: unknown[]) => mockBootstrapUserInConvex(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  authStateChangeListener = null;
});

test("provider exposes loading state initially", () => {
  const { result } = renderHook(() => useAuthSession(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  });

  expect(result.current.isLoading).toBe(true);
});

test("bootstraps the user only after Convex auth reports authenticated", async () => {
  renderHook(() => useAuthSession(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  });

  await act(async () => {
    authStateChangeListener?.({
      uid: "firebase-user-1",
      email: "user@example.com",
      displayName: "User One",
      getIdToken: jest.fn(async () => "firebase-token"),
    });
  });

  expect(mockSetAuth).toHaveBeenCalledTimes(1);
  expect(mockBootstrapUserInConvex).not.toHaveBeenCalled();

  const [, onAuthChange] = mockSetAuth.mock.calls[0];

  await act(async () => {
    onAuthChange(true);
  });

  await waitFor(() => {
    expect(mockBootstrapUserInConvex).toHaveBeenCalledWith({
      email: "user@example.com",
      displayName: "User One",
    });
  });
});
