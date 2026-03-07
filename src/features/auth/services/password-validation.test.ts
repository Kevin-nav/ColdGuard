import {
  getPasswordValidationScore,
  isPasswordFullyValid,
} from "./password-validation";

test("returns score 0 when no rule is satisfied", () => {
  expect(getPasswordValidationScore("")).toBe(0);
});

test("scores rules independently and deterministically", () => {
  expect(getPasswordValidationScore("abcdefg")).toBe(1);
  expect(getPasswordValidationScore("abcdefgh")).toBe(2);
  expect(getPasswordValidationScore("ABCDEFGH")).toBe(2);
  expect(getPasswordValidationScore("Abcdefgh")).toBe(3);
  expect(getPasswordValidationScore("A1bc")).toBe(3);
  expect(getPasswordValidationScore("Abcdefg1")).toBe(4);
  expect(getPasswordValidationScore("Abcdefg1")).toBe(4);
});

test("is fully valid only when all rules are satisfied", () => {
  expect(isPasswordFullyValid("Abcdefg1")).toBe(true);
  expect(isPasswordFullyValid("Abcdefgh")).toBe(false);
  expect(isPasswordFullyValid("A1bc")).toBe(false);
});
