import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { registerWithEmailPassword, signInWithEmailPassword } from "./email-auth";

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
}));

jest.mock("../../../lib/firebase/client", () => ({
  getFirebaseAuth: jest.fn(() => ({})),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("registers with email and password and returns the firebase user", async () => {
  const user = { uid: "u1" };
  jest.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user } as any);

  await expect(registerWithEmailPassword("a@example.com", "Abcdefg1")).resolves.toBe(user);
});

test("signs in with email and password and returns the firebase user", async () => {
  const user = { uid: "u2" };
  jest.mocked(signInWithEmailAndPassword).mockResolvedValue({ user } as any);

  await expect(signInWithEmailPassword("a@example.com", "Abcdefg1")).resolves.toBe(user);
});
