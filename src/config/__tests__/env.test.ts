import { getEnv } from "../env";

test("throws when required env key is missing", () => {
  expect(() => getEnv({ EXPO_PUBLIC_FIREBASE_API_KEY: "" } as any)).toThrow(
    "Missing required env key: EXPO_PUBLIC_FIREBASE_API_KEY",
  );
});
