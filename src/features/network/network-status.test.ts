import { shouldAttemptRetry } from "./network-status";

test("retry disabled when offline", () => {
  expect(shouldAttemptRetry(false, 1)).toBe(false);
});
