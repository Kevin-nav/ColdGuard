import {
  getNextCredentialAttemptState,
  isCredentialAttemptLocked,
  type CredentialAttemptState,
} from "./credential-throttle";

test("does not lock before the threshold", () => {
  const first = getNextCredentialAttemptState(null, 1_000);
  const second = getNextCredentialAttemptState(first, 2_000);

  expect(first).toEqual({
    failedAttempts: 1,
    lastFailedAt: 1_000,
    lockoutUntil: 1_000,
  });
  expect(second).toEqual({
    failedAttempts: 2,
    lastFailedAt: 2_000,
    lockoutUntil: 2_000,
  });
});

test("applies escalating lockouts after repeated failures", () => {
  const third = getNextCredentialAttemptState(
    { failedAttempts: 2, lastFailedAt: 2_000, lockoutUntil: 2_000 },
    3_000,
  );
  const fourth = getNextCredentialAttemptState(third, 40_000);

  expect(third.lockoutUntil).toBe(33_000);
  expect(fourth.lockoutUntil).toBe(100_000);
});

test("reports active lockouts correctly", () => {
  const attempt: CredentialAttemptState = {
    failedAttempts: 4,
    lastFailedAt: 40_000,
    lockoutUntil: 100_000,
  };

  expect(isCredentialAttemptLocked(attempt, 50_000)).toBe(true);
  expect(isCredentialAttemptLocked(attempt, 100_000)).toBe(false);
  expect(isCredentialAttemptLocked(null, 50_000)).toBe(false);
});
