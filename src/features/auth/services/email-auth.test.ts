jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
}));

jest.mock("../../../lib/firebase/client", () => ({
  getFirebaseAuth: jest.fn(() => ({})),
}));

const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth");
const { registerWithEmailPassword, signInWithEmailPassword } = require("./email-auth");

beforeEach(() => {
  jest.clearAllMocks();
});

test("registers with email and password and returns the firebase user", async () => {
  const user = { uid: "u1" };
  createUserWithEmailAndPassword.mockResolvedValue({ user });

  await expect(registerWithEmailPassword("a@example.com", "Abcdefg1")).resolves.toBe(user);
});

test("signs in with email and password and returns the firebase user", async () => {
  const user = { uid: "u2" };
  signInWithEmailAndPassword.mockResolvedValue({ user });

  await expect(signInWithEmailPassword("a@example.com", "Abcdefg1")).resolves.toBe(user);
});
