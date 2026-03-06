jest.mock("firebase/auth", () => ({
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
  signInWithCredential: jest.fn(),
}));

jest.mock("../../../lib/firebase/client", () => ({
  getFirebaseAuth: jest.fn(() => ({})),
}));

const { hasGoogleClientConfig, isGoogleProvider } = require("./google-auth");

test("identifies google provider", () => {
  expect(isGoogleProvider("google.com")).toBe(true);
});

test("google config is valid when one client id is present", () => {
  expect(hasGoogleClientConfig({ webClientId: "abc" })).toBe(true);
});
