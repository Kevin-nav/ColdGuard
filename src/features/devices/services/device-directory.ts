import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "../../../lib/convex/client";
import { getConnectionGrant, saveConnectionGrant } from "../../../lib/storage/sqlite/connection-grant-repository";
import {
  getDevicesForInstitution,
  replaceCachedDevicesForInstitution,
  type DeviceRecord,
} from "../../../lib/storage/sqlite/device-repository";
import type { ProfileSnapshot } from "../../../lib/storage/sqlite/profile-repository";
import type { CachedConnectionGrant, DeviceAssignmentCandidate, RemoteManagedDevice } from "../types";

const GRANT_STALE_BUFFER_MS = 30_000;

function buildCachedDeviceRecord(
  existing: DeviceRecord | undefined,
  remote: RemoteManagedDevice,
  accessRole: DeviceRecord["accessRole"],
) {
  const hasAuthoritativeConnectionStatus =
    remote.lastConnectionTestStatus != null && remote.lastConnectionTestStatus !== "idle";
  const nextConnectionTestStatus = hasAuthoritativeConnectionStatus
    ? remote.lastConnectionTestStatus
    : existing?.lastConnectionTestStatus ?? remote.lastConnectionTestStatus ?? "idle";
  const nextConnectionTestAt = hasAuthoritativeConnectionStatus
    ? remote.lastConnectionTestAt
    : existing?.lastConnectionTestAt ?? remote.lastConnectionTestAt ?? null;

  return {
    id: remote.deviceId,
    nickname: remote.nickname,
    firmwareVersion: remote.firmwareVersion,
    protocolVersion: remote.protocolVersion ?? existing?.protocolVersion ?? 1,
    status: remote.deviceStatus ?? (remote.status === "decommissioned" ? "decommissioned" : "enrolled"),
    deviceStatus: remote.deviceStatus ?? (remote.status === "decommissioned" ? "decommissioned" : "enrolled"),
    grantVersion: remote.grantVersion,
    accessRole,
    primaryAssigneeName: remote.primaryAssigneeName,
    primaryAssigneeStaffId: remote.primaryStaffId,
    viewerNames: remote.viewerNames ?? remote.viewerAssignments.map((assignment) => assignment.displayName),
    macAddress: remote.macAddress ?? existing?.macAddress ?? remote.deviceId,
    currentTempC: existing?.currentTempC ?? 4.5,
    mktStatus: existing?.mktStatus ?? "safe",
    batteryLevel: existing?.batteryLevel ?? 92,
    doorOpen: existing?.doorOpen ?? false,
    lastSeenAt: remote.lastSeenAt ?? existing?.lastSeenAt ?? Date.now(),
    lastConnectionTestAt: nextConnectionTestAt,
    lastConnectionTestStatus: nextConnectionTestStatus,
  } satisfies Omit<DeviceRecord, "institutionId" | "institutionName">;
}

function isGrantFresh(expiresAt: number) {
  return expiresAt > Date.now() + GRANT_STALE_BUFFER_MS;
}

function parseCachedGrant(payloadJson: string): CachedConnectionGrant {
  return JSON.parse(payloadJson) as CachedConnectionGrant;
}

async function cacheGrant(scopeType: "admin" | "device", scopeId: string, grant: CachedConnectionGrant) {
  await saveConnectionGrant({
    expiresAt: grant.exp,
    payloadJson: JSON.stringify(grant),
    scopeId,
    scopeType,
  });

  return grant;
}

export async function syncVisibleDevices(profile: ProfileSnapshot): Promise<DeviceRecord[]> {
  const convex = getConvexClient();
  const cached = await getDevicesForInstitution(profile.institutionId);

  try {
    const remoteDevices: RemoteManagedDevice[] =
      profile.role === "Supervisor"
        ? await convex.query((api as any).devices.listManageableDevices, {})
        : await convex.query((api as any).devices.listMyAssignedDevices, {});

    await replaceCachedDevicesForInstitution({
      institutionId: profile.institutionId,
      institutionName: profile.institutionName,
      devices: remoteDevices.map((remote) =>
        buildCachedDeviceRecord(
          cached.find((device) => device.id === remote.deviceId),
          remote,
          profile.role === "Supervisor" ? "manager" : remote.assignmentRole ?? "viewer",
        ),
      ),
    });

    return await getDevicesForInstitution(profile.institutionId);
  } catch (error) {
    if (cached.length > 0) {
      return cached;
    }
    throw error;
  }
}

export async function listAssignableNurses(): Promise<DeviceAssignmentCandidate[]> {
  const convex = getConvexClient();
  return (await convex.query((api as any).devices.listAssignableNurses, {})) as DeviceAssignmentCandidate[];
}

export async function assignDeviceUsers(args: {
  deviceId: string;
  primaryStaffId: string | null;
  viewerStaffIds: string[];
}) {
  const convex = getConvexClient();
  if (!args.primaryStaffId) {
    throw new Error("PRIMARY_NURSE_REQUIRED");
  }
  return await convex.mutation((api as any).devices.assignDevice, {
    deviceId: args.deviceId,
    primaryStaffId: args.primaryStaffId,
    viewerStaffIds: args.viewerStaffIds,
  });
}

export async function ensureSupervisorAdminGrant(profile: ProfileSnapshot, deviceId?: string) {
  if (profile.role !== "Supervisor") {
    throw new Error("SUPERVISOR_REQUIRED");
  }

  const scopeId = deviceId ?? profile.institutionId;
  const cached = await getConnectionGrant("admin", scopeId);
  if (cached && isGrantFresh(cached.expiresAt)) {
    return parseCachedGrant(cached.payloadJson);
  }

  const convex = getConvexClient();
  const grant = (await convex.mutation((api as any).devices.issueSupervisorAdminGrant, {
    deviceId: deviceId ?? `${profile.institutionId}:admin`,
  })) as CachedConnectionGrant;

  return await cacheGrant("admin", scopeId, grant);
}

export async function ensureDeviceConnectionGrant(deviceId: string) {
  const cached = await getConnectionGrant("device", deviceId);
  if (cached && isGrantFresh(cached.expiresAt)) {
    return parseCachedGrant(cached.payloadJson);
  }

  const convex = getConvexClient();
  const grant = (await convex.mutation((api as any).devices.issueConnectionGrant, {
    deviceId,
  })) as CachedConnectionGrant;

  return await cacheGrant("device", deviceId, grant);
}

export async function registerEnrolledDevice(args: {
  bleName: string;
  deviceId: string;
  firmwareVersion: string;
  macAddress: string;
  nickname: string;
  protocolVersion: number;
}) {
  const convex = getConvexClient();
  return await convex.mutation((api as any).devices.registerEnrollment, args);
}

export async function decommissionManagedDevice(deviceId: string) {
  const convex = getConvexClient();
  return await convex.mutation((api as any).devices.decommissionDevice, { deviceId });
}

export async function recordDeviceConnectionTest(args: {
  deviceId: string;
  lastSeenAt?: number;
  summary: string;
  status: "failed" | "success";
  transport: string;
}) {
  const convex = getConvexClient();
  return await convex.mutation((api as any).devices.recordConnectionTest, args);
}
