export const USER_ROLE_NURSE = "Nurse";
export const USER_ROLE_SUPERVISOR = "Supervisor";
export const LEGACY_SUPERVISOR_ROLE_COLD_CHAIN_OFFICER = "Cold Chain Officer";
export const LEGACY_SUPERVISOR_ROLE_NURSE_SUPERVISOR = "Nurse Supervisor";
export const LEGACY_ROLE_COMMUNITY_HEALTH_NURSE = "Community Health Nurse";

export type UserRole = typeof USER_ROLE_NURSE | typeof USER_ROLE_SUPERVISOR;

export function normalizeUserRole(role: string | null | undefined): UserRole {
  return role === USER_ROLE_SUPERVISOR ||
    role === LEGACY_SUPERVISOR_ROLE_COLD_CHAIN_OFFICER ||
    role === LEGACY_SUPERVISOR_ROLE_NURSE_SUPERVISOR
    ? USER_ROLE_SUPERVISOR
    : USER_ROLE_NURSE;
}
