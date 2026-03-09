const LOCKOUT_THRESHOLD = 3;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

export type CredentialAttemptState = {
  failedAttempts: number;
  lastFailedAt: number;
  lockoutUntil: number;
};

export function isCredentialAttemptLocked(attempt: CredentialAttemptState | null, now: number) {
  return Boolean(attempt && attempt.lockoutUntil > now);
}

export function getNextCredentialAttemptState(
  previous: CredentialAttemptState | null,
  now: number,
): CredentialAttemptState {
  const failedAttempts = (previous?.failedAttempts ?? 0) + 1;
  const failuresBeyondThreshold = Math.max(0, failedAttempts - LOCKOUT_THRESHOLD);
  const backoffMultiplier = 2 ** failuresBeyondThreshold;
  const lockoutDuration =
    failedAttempts >= LOCKOUT_THRESHOLD
      ? Math.min(MAX_LOCKOUT_MS, BASE_LOCKOUT_MS * backoffMultiplier)
      : 0;

  return {
    failedAttempts,
    lastFailedAt: now,
    lockoutUntil: now + lockoutDuration,
  };
}
