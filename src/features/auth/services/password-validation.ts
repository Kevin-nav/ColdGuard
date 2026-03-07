export function getPasswordValidationScore(password: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;

  return score as 0 | 1 | 2 | 3 | 4;
}

export function isPasswordFullyValid(password: string): boolean {
  return getPasswordValidationScore(password) === 4;
}
