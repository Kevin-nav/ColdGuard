import {
  hashInstitutionPasscode,
  isHashedPasscode,
  verifyInstitutionPasscode,
} from "./passcodes";

test("hashes passcodes and verifies the correct input", async () => {
  const hash = await hashInstitutionPasscode("482913");

  expect(isHashedPasscode(hash)).toBe(true);
  await expect(verifyInstitutionPasscode(hash, "482913")).resolves.toBe(true);
  await expect(verifyInstitutionPasscode(hash, "111111")).resolves.toBe(false);
});

test("accepts trimmed input and supports legacy plaintext verification", async () => {
  await expect(verifyInstitutionPasscode("203844", " 203844 ")).resolves.toBe(true);
  await expect(verifyInstitutionPasscode("203844", "999999")).resolves.toBe(false);
});
