import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normalizeUserRole, type UserRole } from "./roles";

const CONNECT_GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEVICE_GRANT_ISSUER = "coldguard-api";
const DEVICE_GRANT_KEY_ID = "coldguard-esp32-transport-v1";
const CONNECT_ACTION_TICKET_TTL_MS = 5 * 60 * 1000;
const SUPERVISOR_ACTION_TICKET_TTL_MS = 5 * 60 * 1000;
const DEVICE_SIGNING_KEY_ENV = "CG_DEVICE_SIGNING_KEY_PKCS8_B64";
const DEVICE_ACTION_TICKET_MASTER_KEY_ENV = "CG_DEVICE_ACTION_TICKET_MASTER_KEY";

type DeviceActionTicketAction =
  | "connect"
  | "decommission"
  | "enroll"
  | "reassign"
  | "wifi_provision";

type AuthenticatedUser = {
  _id: string;
  firebaseUid: string;
  institutionId: string;
  role: UserRole;
  staffId: string | null;
  displayName: string | null;
};

async function getAuthenticatedFirebaseUid(ctx: { auth: { getUserIdentity(): Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("UNAUTHENTICATED");
  }
  return identity.subject;
}

async function getCurrentUser(ctx: any): Promise<AuthenticatedUser> {
  const firebaseUid = await getAuthenticatedFirebaseUid(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", firebaseUid))
    .unique();

  if (!user?.institutionId) {
    throw new Error("INSTITUTION_LINK_REQUIRED");
  }

  return {
    _id: user._id,
    firebaseUid,
    institutionId: user.institutionId,
    role: normalizeUserRole(user.role),
    staffId: user.staffId ?? null,
    displayName: user.displayName ?? null,
  };
}

async function requireSupervisor(ctx: any) {
  const user = await getCurrentUser(ctx);
  if (user.role !== "Supervisor") {
    throw new Error("SUPERVISOR_REQUIRED");
  }
  return user;
}

async function getActiveDeviceOrThrow(ctx: any, institutionId: string, deviceId: string) {
  const device = await ctx.db
    .query("devices")
    .withIndex("by_device_id", (q: any) => q.eq("deviceId", deviceId))
    .unique();

  if (!device || device.institutionId !== institutionId || device.status !== "active") {
    throw new Error("DEVICE_NOT_FOUND");
  }

  return device;
}

async function listActiveAssignments(ctx: any, deviceId: string) {
  return await ctx.db
    .query("deviceAssignments")
    .withIndex("by_device_active", (q: any) => q.eq("deviceId", deviceId).eq("isActive", true))
    .collect();
}

async function listManageableDevicesForUser(ctx: any, user: AuthenticatedUser) {
  const devices = await ctx.db
    .query("devices")
    .withIndex("by_institution_status", (q: any) => q.eq("institutionId", user.institutionId).eq("status", "active"))
    .collect();

  const summaries = await Promise.all(devices.map((device: any) => mapDeviceSummary(ctx, device)));
  return summaries.sort((left, right) => left.nickname.localeCompare(right.nickname));
}

function toBase64Url(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizeBase64(value: string) {
  return value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
}

function base64ToBytes(value: string) {
  const binary = atob(normalizeBase64(value));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(atob(normalizeBase64(value))) as T;
}

async function getGrantSigningKey() {
  const productionKey = process.env[DEVICE_SIGNING_KEY_ENV];
  if (productionKey) {
    return await crypto.subtle.importKey(
      "pkcs8",
      base64ToBytes(productionKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  }

  if (process.env.TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64 && process.env.NODE_ENV !== "test") {
    throw new Error("DEVICE_SIGNING_KEY_TEST_ENV_ONLY");
  }

  const testKey = process.env.NODE_ENV === "test" ? process.env.TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64 : null;
  if (!testKey) {
    throw new Error(
      `DEVICE_SIGNING_KEY_MISSING: set ${DEVICE_SIGNING_KEY_ENV} or TEST_DEVICE_GRANT_PRIVATE_KEY_PKCS8_B64`,
    );
  }

  return await crypto.subtle.importKey(
    "pkcs8",
    base64ToBytes(testKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function getActionTicketMasterKey() {
  const productionKey = process.env[DEVICE_ACTION_TICKET_MASTER_KEY_ENV];
  if (productionKey) {
    return productionKey;
  }

  if (process.env.TEST_DEVICE_ACTION_TICKET_MASTER_KEY && process.env.NODE_ENV !== "test") {
    throw new Error("DEVICE_ACTION_TICKET_MASTER_KEY_TEST_ENV_ONLY");
  }

  const testKey = process.env.NODE_ENV === "test" ? process.env.TEST_DEVICE_ACTION_TICKET_MASTER_KEY : null;
  if (!testKey) {
    throw new Error(
      `DEVICE_ACTION_TICKET_MASTER_KEY_MISSING: set ${DEVICE_ACTION_TICKET_MASTER_KEY_ENV} or TEST_DEVICE_ACTION_TICKET_MASTER_KEY`,
    );
  }

  return testKey;
}

async function importHmacKey(secret: Uint8Array | string, usages: KeyUsage[]) {
  const bytes = typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
  return await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, usages);
}

async function deriveDeviceActionKey(deviceId: string) {
  const masterKey = await importHmacKey(await getActionTicketMasterKey(), ["sign"]);
  const derived = await crypto.subtle.sign("HMAC", masterKey, new TextEncoder().encode(deviceId));
  return new Uint8Array(derived);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createActionTicketId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ticket-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function buildActionTicketCanonicalString(args: {
  action: DeviceActionTicketAction;
  counter: number;
  deviceId: string;
  expiresAt: number;
  institutionId: string;
  issuedAt: number;
  operatorId?: string;
  ticketId: string;
}) {
  return [
    "1",
    args.ticketId,
    args.deviceId,
    args.institutionId,
    args.action,
    String(args.issuedAt),
    String(args.expiresAt),
    String(args.counter),
    args.operatorId ?? "",
  ].join("|");
}

async function buildActionTicket(args: {
  action: DeviceActionTicketAction;
  counter: number;
  deviceId: string;
  expiresAt: number;
  institutionId: string;
  issuedAt: number;
  operatorId?: string;
  ticketId?: string;
}) {
  const ticketId = args.ticketId ?? createActionTicketId();
  const canonical = buildActionTicketCanonicalString({
    ...args,
    ticketId,
  });
  const deviceKey = await importHmacKey(await deriveDeviceActionKey(args.deviceId), ["sign"]);
  const mac = bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", deviceKey, new TextEncoder().encode(canonical))));

  return {
    v: 1 as const,
    ticketId,
    deviceId: args.deviceId,
    institutionId: args.institutionId,
    action: args.action,
    issuedAt: args.issuedAt,
    expiresAt: args.expiresAt,
    counter: args.counter,
    operatorId: args.operatorId,
    mac,
  };
}

async function signGrant(claims: Record<string, unknown>) {
  const header = toBase64Url(
    JSON.stringify({ alg: "ES256", kid: DEVICE_GRANT_KEY_ID, typ: "JWT" }),
  );
  const payload = toBase64Url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    await getGrantSigningKey(),
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function buildGrant(args: {
  deviceId: string;
  expiresAt: number;
  grantVersion: number;
  institutionId: string;
  issuedToFirebaseUid: string;
  permission: "connect" | "manage";
  role: UserRole;
}) {
  const claims = {
    alg: "ES256" as const,
    deviceId: args.deviceId,
    exp: args.expiresAt,
    grantVersion: args.grantVersion,
    institutionId: args.institutionId,
    iss: DEVICE_GRANT_ISSUER,
    issuedToFirebaseUid: args.issuedToFirebaseUid,
    kid: DEVICE_GRANT_KEY_ID,
    permission: args.permission,
    role: args.role,
    scope: args.permission,
    sub: args.deviceId,
    v: 1,
  };

  return {
    ...claims,
    token: await signGrant(claims),
  };
}

async function createAuditEvent(
  ctx: any,
  args: {
    action: string;
    actor: AuthenticatedUser;
    deviceId: string;
    institutionId: string;
    metadata?: Record<string, unknown>;
    summary: string;
    targetStaffId?: string;
  },
) {
  await ctx.db.insert("deviceAuditEvents", {
    action: args.action,
    actorFirebaseUid: args.actor.firebaseUid,
    actorRole: normalizeUserRole(args.actor.role),
    actorStaffId: args.actor.staffId ?? undefined,
    createdAt: Date.now(),
    deviceId: args.deviceId,
    institutionId: args.institutionId,
    metadataJson: args.metadata ? JSON.stringify(args.metadata) : undefined,
    summary: args.summary,
    targetStaffId: args.targetStaffId,
  });
}

function ensureSupervisorAdminGrantTargetOwnership(
  device: { institutionId: string } | null,
  userInstitutionId: string,
) {
  if (device && device.institutionId !== userInstitutionId) {
    throw new Error("DEVICE_ACCESS_DENIED");
  }
}

function ensureExistingEnrollmentOwnership(
  device: { institutionId: string },
  userInstitutionId: string,
) {
  if (device.institutionId !== userInstitutionId) {
    throw new Error("DEVICE_ACCESS_DENIED");
  }
}

async function ensureUserCanAccessDevice(ctx: any, user: AuthenticatedUser, deviceId: string) {
  if (user.role === "Supervisor") {
    return;
  }

  if (!user.staffId) {
    throw new Error("DEVICE_ACCESS_DENIED");
  }

  const assignments = await ctx.db
    .query("deviceAssignments")
    .withIndex("by_institution_staff_active", (q: any) =>
      q.eq("institutionId", user.institutionId).eq("staffId", user.staffId).eq("isActive", true),
    )
    .collect();

  if (!assignments.some((item: any) => item.deviceId === deviceId)) {
    throw new Error("DEVICE_ACCESS_DENIED");
  }
}

async function mapDeviceSummary(ctx: any, device: any) {
  const assignments = await listActiveAssignments(ctx, device.deviceId);
  const primaryAssignment = assignments.find((assignment: any) => assignment.assignmentRole === "primary") ?? null;
  const viewerAssignments = assignments.filter((assignment: any) => assignment.assignmentRole === "viewer");

  return {
    bleName: device.bleName ?? `ColdGuard_${device.deviceId.slice(-4)}`,
    deviceId: device.deviceId,
    deviceStatus: device.status === "active" ? "enrolled" : "decommissioned",
    firmwareVersion: device.firmwareVersion,
    grantVersion: device.grantVersion,
    institutionId: device.institutionId,
    lastConnectionTestAt: device.lastConnectionTestAt ?? null,
    lastConnectionTestStatus: device.lastConnectionTestStatus ?? null,
    lastSeenAt: device.lastSeenAt ?? device.updatedAt,
    macAddress: device.macAddress,
    nickname: device.nickname,
    primaryAssigneeName: primaryAssignment?.displayName ?? null,
    primaryStaffId: primaryAssignment?.staffId ?? null,
    protocolVersion: device.protocolVersion,
    status: device.status,
    viewerAssignments: viewerAssignments.map((assignment: any) => ({
      displayName: assignment.displayName,
      staffId: assignment.staffId,
    })),
  };
}

export const listAssignableNurses = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireSupervisor(ctx);
    const credentials = await ctx.db
      .query("institutionCredentials")
      .withIndex("by_institution_staff_id", (q: any) => q.eq("institutionId", user.institutionId))
      .collect();

    return credentials
      .filter((credential: any) => credential.isActive && normalizeUserRole(credential.role) === "Nurse")
      .map((credential: any) => ({
        displayName: credential.displayName ?? credential.staffId,
        role: normalizeUserRole(credential.role),
        staffId: credential.staffId,
      }))
      .sort((left: any, right: any) => left.displayName.localeCompare(right.displayName));
  },
});

export const listManageableDevices = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireSupervisor(ctx);
    return await listManageableDevicesForUser(ctx, user);
  },
});

export const listMyAssignedDevices = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user.role === "Supervisor") {
      return await listManageableDevicesForUser(ctx, user);
    }

    if (!user.staffId) {
      return [];
    }

    const assignments = await ctx.db
      .query("deviceAssignments")
      .withIndex("by_institution_staff_active", (q: any) =>
        q.eq("institutionId", user.institutionId).eq("staffId", user.staffId).eq("isActive", true),
      )
      .collect();

    const devices = await Promise.all(
      assignments.map(async (assignment: any) => {
        const device = await getActiveDeviceOrThrow(ctx, user.institutionId, assignment.deviceId);
        const summary = await mapDeviceSummary(ctx, device);
        return {
          ...summary,
          assignmentRole: assignment.assignmentRole,
        };
      }),
    );

    return devices.sort((left, right) => left.nickname.localeCompare(right.nickname));
  },
});

export const issueSupervisorAdminGrant = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSupervisor(ctx);
    const device = await ctx.db
      .query("devices")
      .withIndex("by_device_id", (q: any) => q.eq("deviceId", args.deviceId))
      .unique();
    ensureSupervisorAdminGrantTargetOwnership(device, user.institutionId);
    const grantVersion = device?.grantVersion ?? 1;

    return await buildGrant({
      deviceId: args.deviceId,
      expiresAt: Date.now() + ADMIN_GRANT_TTL_MS,
      grantVersion,
      institutionId: user.institutionId,
      issuedToFirebaseUid: user.firebaseUid,
      permission: "manage",
      role: user.role,
    });
  },
});

export const issueConnectionGrant = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const device = await getActiveDeviceOrThrow(ctx, user.institutionId, args.deviceId);
    await ensureUserCanAccessDevice(ctx, user, args.deviceId);

    return await buildGrant({
      deviceId: args.deviceId,
      expiresAt: Date.now() + CONNECT_GRANT_TTL_MS,
      grantVersion: device.grantVersion,
      institutionId: user.institutionId,
      issuedToFirebaseUid: user.firebaseUid,
      permission: "connect",
      role: user.role,
    });
  },
});

export const issueSupervisorActionTicket = mutation({
  args: {
    action: v.union(v.literal("connect"), v.literal("decommission"), v.literal("enroll"), v.literal("reassign"), v.literal("wifi_provision")),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSupervisor(ctx);
    const now = Date.now();
    const device = await ctx.db
      .query("devices")
      .withIndex("by_device_id", (q: any) => q.eq("deviceId", args.deviceId))
      .unique();

    if (args.action === "enroll" || args.action === "connect") {
      ensureSupervisorAdminGrantTargetOwnership(device, user.institutionId);
    } else {
      if (!device || device.institutionId !== user.institutionId || device.status !== "active") {
        throw new Error("DEVICE_NOT_FOUND");
      }
    }

    return await buildActionTicket({
      action: args.action,
      counter: device?.grantVersion ?? 1,
      deviceId: args.deviceId,
      expiresAt: now + SUPERVISOR_ACTION_TICKET_TTL_MS,
      institutionId: user.institutionId,
      issuedAt: now,
      operatorId: user.firebaseUid,
    });
  },
});

export const issueDeviceActionTicket = mutation({
  args: {
    action: v.union(v.literal("connect"), v.literal("wifi_provision")),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const device = await getActiveDeviceOrThrow(ctx, user.institutionId, args.deviceId);
    await ensureUserCanAccessDevice(ctx, user, args.deviceId);
    const now = Date.now();

    return await buildActionTicket({
      action: args.action,
      counter: device.grantVersion,
      deviceId: args.deviceId,
      expiresAt: now + CONNECT_ACTION_TICKET_TTL_MS,
      institutionId: user.institutionId,
      issuedAt: now,
      operatorId: user.firebaseUid,
    });
  },
});

export const registerEnrollment = mutation({
  args: {
    bleName: v.optional(v.string()),
    deviceId: v.string(),
    firmwareVersion: v.string(),
    macAddress: v.string(),
    nickname: v.string(),
    protocolVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireSupervisor(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_device_id", (q: any) => q.eq("deviceId", args.deviceId))
      .unique();

    if (existing) {
      ensureExistingEnrollmentOwnership(existing, user.institutionId);

      await ctx.db.patch(existing._id, {
        bleName: args.bleName,
        decommissionedAt: undefined,
        firmwareVersion: args.firmwareVersion,
        grantVersion: existing.grantVersion + 1,
        macAddress: args.macAddress,
        nickname: args.nickname.trim(),
        protocolVersion: args.protocolVersion,
        status: "active",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("devices", {
        bleName: args.bleName,
        createdAt: now,
        createdByFirebaseUid: user.firebaseUid,
        deviceId: args.deviceId,
        firmwareVersion: args.firmwareVersion,
        grantVersion: 1,
        institutionId: user.institutionId as any,
        macAddress: args.macAddress,
        nickname: args.nickname.trim(),
        protocolVersion: args.protocolVersion,
        status: "active",
        updatedAt: now,
      });
    }

    await createAuditEvent(ctx, {
      action: "enrolled",
      actor: user,
      deviceId: args.deviceId,
      institutionId: user.institutionId as any,
      metadata: {
        bleName: args.bleName ?? null,
        firmwareVersion: args.firmwareVersion,
        nickname: args.nickname.trim(),
      },
      summary: `Enrolled device ${args.nickname.trim()}.`,
    });

    return {
      deviceId: args.deviceId,
      nickname: args.nickname.trim(),
      status: "active",
    };
  },
});

export const assignDevice = mutation({
  args: {
    deviceId: v.string(),
    primaryStaffId: v.string(),
    viewerStaffIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSupervisor(ctx);
    const device = await getActiveDeviceOrThrow(ctx, user.institutionId, args.deviceId);

    const staffIds = Array.from(new Set([args.primaryStaffId, ...args.viewerStaffIds])).filter(Boolean);
    const availableNurses = await ctx.db
      .query("institutionCredentials")
      .withIndex("by_institution_staff_id", (q: any) => q.eq("institutionId", user.institutionId))
      .collect();

    const nursesByStaffId = new Map(
      availableNurses
        .filter((credential: any) => credential.isActive && normalizeUserRole(credential.role) === "Nurse")
        .map((credential: any) => [credential.staffId, credential]),
    );

    for (const staffId of staffIds) {
      if (!nursesByStaffId.has(staffId)) {
        throw new Error("DEVICE_ASSIGNMENT_TARGET_INVALID");
      }
    }

    const currentAssignments = await listActiveAssignments(ctx, args.deviceId);
    const now = Date.now();
    for (const assignment of currentAssignments) {
      await ctx.db.patch(assignment._id, {
        isActive: false,
        revokedAt: now,
      });
    }

    await ctx.db.patch(device._id, {
      grantVersion: device.grantVersion + 1,
      updatedAt: now,
    });

    for (const staffId of staffIds) {
      const nurse = nursesByStaffId.get(staffId)!;
      await ctx.db.insert("deviceAssignments", {
        assignedAt: now,
        assignedByFirebaseUid: user.firebaseUid,
        assignmentRole: staffId === args.primaryStaffId ? "primary" : "viewer",
        deviceId: args.deviceId,
        displayName: nurse.displayName ?? nurse.staffId,
        institutionId: user.institutionId as any,
        isActive: true,
        revokedAt: undefined,
        staffId,
      });
    }

    await createAuditEvent(ctx, {
      action: "assigned",
      actor: user,
      deviceId: args.deviceId,
      institutionId: user.institutionId,
      metadata: {
        primaryStaffId: args.primaryStaffId,
        viewerStaffIds: staffIds.filter((staffId) => staffId !== args.primaryStaffId),
      },
      summary: `Updated assignments for device ${args.deviceId}.`,
      targetStaffId: args.primaryStaffId,
    });

    return {
      deviceId: args.deviceId,
      primaryStaffId: args.primaryStaffId,
      viewerStaffIds: staffIds.filter((staffId) => staffId !== args.primaryStaffId),
    };
  },
});

export const decommissionDevice = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSupervisor(ctx);
    const device = await getActiveDeviceOrThrow(ctx, user.institutionId, args.deviceId);
    const now = Date.now();

    await ctx.db.patch(device._id, {
      decommissionedAt: now,
      grantVersion: device.grantVersion + 1,
      status: "decommissioned",
      updatedAt: now,
    });

    const assignments = await listActiveAssignments(ctx, args.deviceId);
    for (const assignment of assignments) {
      await ctx.db.patch(assignment._id, {
        isActive: false,
        revokedAt: now,
      });
    }

    await createAuditEvent(ctx, {
      action: "decommissioned",
      actor: user,
      deviceId: args.deviceId,
      institutionId: user.institutionId,
      summary: `Decommissioned device ${device.nickname}.`,
    });

    return {
      deviceId: args.deviceId,
      status: "decommissioned",
    };
  },
});

export const recordConnectionTest = mutation({
  args: {
    deviceId: v.string(),
    lastSeenAt: v.optional(v.number()),
    status: v.union(v.literal("failed"), v.literal("success")),
    transport: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const device = await getActiveDeviceOrThrow(ctx, user.institutionId, args.deviceId);
    await ensureUserCanAccessDevice(ctx, user, args.deviceId);
    const now = Date.now();

    await ctx.db.patch(device._id, {
      lastConnectionTestAt: now,
      lastConnectionTestStatus: args.status,
      lastSeenAt: args.lastSeenAt ?? device.lastSeenAt,
      updatedAt: now,
    });

    await createAuditEvent(ctx, {
      action: "connection_test",
      actor: user,
      deviceId: args.deviceId,
      institutionId: user.institutionId,
      metadata: {
        transport: args.transport,
      },
      summary: args.summary,
    });

    return {
      deviceId: args.deviceId,
      lastConnectionTestAt: now,
    };
  },
});

export const __testing = {
  ensureExistingEnrollmentOwnership,
  ensureSupervisorAdminGrantTargetOwnership,
  ensureUserCanAccessDeviceForTesting: ensureUserCanAccessDevice,
  async buildActionTicketForTesting(args: {
    action: DeviceActionTicketAction;
    counter: number;
    deviceId: string;
    expiresAt: number;
    institutionId: string;
    issuedAt: number;
    operatorId?: string;
    ticketId?: string;
  }) {
    return await buildActionTicket(args);
  },
  buildActionTicketCanonicalString,
  async buildGrantForTesting(args: {
    deviceId: string;
    expiresAt: number;
    grantVersion: number;
    institutionId: string;
    issuedToFirebaseUid: string;
    permission: "connect" | "manage";
    role: UserRole;
  }) {
    return await buildGrant(args);
  },
  decodeToken(token: string) {
    const [header, payload] = token.split(".");
    return {
      header: decodeBase64UrlJson<Record<string, unknown>>(header),
      payload: decodeBase64UrlJson<Record<string, unknown>>(payload),
    };
  },
};
