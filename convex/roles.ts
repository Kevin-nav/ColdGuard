export const USER_ROLE_NURSE = "Nurse";
export const USER_ROLE_SUPERVISOR = "Supervisor";

export type UserRole = typeof USER_ROLE_NURSE | typeof USER_ROLE_SUPERVISOR;

export function normalizeUserRole(role: string | null | undefined): UserRole {
  return role === USER_ROLE_SUPERVISOR ? USER_ROLE_SUPERVISOR : USER_ROLE_NURSE;
}
