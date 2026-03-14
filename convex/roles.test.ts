import {
  LEGACY_ROLE_COMMUNITY_HEALTH_NURSE,
  LEGACY_SUPERVISOR_ROLE_COLD_CHAIN_OFFICER,
  LEGACY_SUPERVISOR_ROLE_NURSE_SUPERVISOR,
  normalizeUserRole,
} from "./roles";

test("preserves canonical roles", () => {
  expect(normalizeUserRole("Supervisor")).toBe("Supervisor");
  expect(normalizeUserRole("Nurse")).toBe("Nurse");
});

test("maps known legacy supervisor titles to Supervisor", () => {
  expect(normalizeUserRole(LEGACY_SUPERVISOR_ROLE_COLD_CHAIN_OFFICER)).toBe("Supervisor");
  expect(normalizeUserRole(LEGACY_SUPERVISOR_ROLE_NURSE_SUPERVISOR)).toBe("Supervisor");
});

test("falls back to Nurse for other legacy or unknown role strings", () => {
  expect(normalizeUserRole(LEGACY_ROLE_COMMUNITY_HEALTH_NURSE)).toBe("Nurse");
  expect(normalizeUserRole("Unexpected Title")).toBe("Nurse");
  expect(normalizeUserRole(undefined)).toBe("Nurse");
});
