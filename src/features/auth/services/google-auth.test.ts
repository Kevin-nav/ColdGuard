import { hasGoogleClientConfig, isGoogleProvider } from "./google-auth";

jest.mock("firebase/auth", () => ({
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
  signInWithCredential: jest.fn(),
}));

jest.mock("../../../lib/firebase/client", () => ({
  getFirebaseAuth: jest.fn(() => ({})),
}));

test("identifies google provider", () => {
  expect(isGoogleProvider("google.com")).toBe(true);
});

test("google config is valid when one client id is present", () => {
  expect(hasGoogleClientConfig({ webClientId: "abc" })).toBe(true);
});
