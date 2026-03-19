import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const persistedRoleValidator = v.optional(
  v.union(
    v.literal("Supervisor"),
    v.literal("Nurse"),
    v.literal("Cold Chain Officer"),
    v.literal("Nurse Supervisor"),
    v.literal("Community Health Nurse"),
  ),
);

export default defineSchema({
  institutions: defineTable({
    code: v.string(),
    name: v.string(),
    secretKey: v.string(),
    handshakeToken: v.string(),
    district: v.optional(v.string()),
    region: v.optional(v.string()),
  }).index("by_code", ["code"]),
  institutionCredentials: defineTable({
    institutionId: v.id("institutions"),
    staffId: v.string(),
    passcode: v.string(),
    displayName: v.optional(v.string()),
    role: persistedRoleValidator,
    isActive: v.boolean(),
  }).index("by_institution_staff_id", ["institutionId", "staffId"]),
  institutionCredentialAttempts: defineTable({
    institutionId: v.id("institutions"),
    staffId: v.string(),
    failedAttempts: v.number(),
    lastFailedAt: v.number(),
    lockoutUntil: v.number(),
  }).index("by_institution_staff_id", ["institutionId", "staffId"]),
  users: defineTable({
    firebaseUid: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    institutionId: v.optional(v.id("institutions")),
    role: persistedRoleValidator,
    staffId: v.optional(v.string()),
  }).index("by_firebase_uid", ["firebaseUid"]).index("by_institution_id", ["institutionId"]),
  devices: defineTable({
    deviceId: v.string(),
    institutionId: v.id("institutions"),
    nickname: v.string(),
    firmwareVersion: v.string(),
    macAddress: v.string(),
    protocolVersion: v.number(),
    status: v.union(v.literal("active"), v.literal("decommissioned")),
    grantVersion: v.number(),
    bleName: v.optional(v.string()),
    createdAt: v.number(),
    createdByFirebaseUid: v.string(),
    updatedAt: v.number(),
    decommissionedAt: v.optional(v.number()),
    lastConnectionTestAt: v.optional(v.number()),
    lastConnectionTestStatus: v.optional(
      v.union(v.literal("idle"), v.literal("failed"), v.literal("success")),
    ),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_device_id", ["deviceId"])
    .index("by_institution_status", ["institutionId", "status"]),
  deviceAssignments: defineTable({
    deviceId: v.string(),
    institutionId: v.id("institutions"),
    staffId: v.string(),
    displayName: v.string(),
    assignmentRole: v.union(v.literal("primary"), v.literal("viewer")),
    isActive: v.boolean(),
    assignedAt: v.number(),
    assignedByFirebaseUid: v.string(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_device_active", ["deviceId", "isActive"])
    .index("by_institution_staff_active", ["institutionId", "staffId", "isActive"]),
  deviceAuditEvents: defineTable({
    deviceId: v.string(),
    institutionId: v.id("institutions"),
    action: v.union(
      v.literal("enrolled"),
      v.literal("assigned"),
      v.literal("decommissioned"),
      v.literal("connection_test"),
    ),
    actorFirebaseUid: v.string(),
    actorRole: v.union(v.literal("Supervisor"), v.literal("Nurse")),
    actorStaffId: v.optional(v.string()),
    targetStaffId: v.optional(v.string()),
    summary: v.string(),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_device_id", ["deviceId"]),
  notificationIncidents: defineTable({
    institutionId: v.id("institutions"),
    deviceId: v.string(),
    deviceNickname: v.string(),
    incidentType: v.string(),
    severity: v.string(),
    status: v.string(),
    title: v.string(),
    body: v.string(),
    firstTriggeredAt: v.number(),
    lastTriggeredAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedByUserId: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    resolvedByUserId: v.optional(v.id("users")),
    lastEscalatedAt: v.optional(v.number()),
    reopenCount: v.number(),
    healthyEvaluationStreak: v.number(),
    version: v.number(),
    lastSnapshotJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_institution_status", ["institutionId", "status"])
    .index("by_institution_device_type", ["institutionId", "deviceId", "incidentType"])
    .index("by_device_id", ["deviceId"]),
  notificationEvents: defineTable({
    incidentId: v.id("notificationIncidents"),
    eventType: v.string(),
    actorUserId: v.optional(v.id("users")),
    channel: v.optional(v.string()),
    summary: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_incident_id", ["incidentId"]),
  notificationUserState: defineTable({
    incidentId: v.id("notificationIncidents"),
    userId: v.id("users"),
    readAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    lastViewedVersion: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_incident", ["userId", "incidentId"])
    .index("by_incident_user", ["incidentId", "userId"]),
  userPushDevices: defineTable({
    userId: v.id("users"),
    expoPushToken: v.string(),
    platform: v.string(),
    appVersion: v.string(),
    deviceLabel: v.optional(v.string()),
    permissionStatus: v.string(),
    isActive: v.boolean(),
    lastRegisteredAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_token", ["expoPushToken"]),
  userNotificationPreferences: defineTable({
    userId: v.id("users"),
    warningPushEnabled: v.boolean(),
    warningLocalEnabled: v.boolean(),
    recoveryPushEnabled: v.boolean(),
    nonCriticalByType: v.optional(
      v.object({
        temperature: v.boolean(),
        door_open: v.boolean(),
        device_offline: v.boolean(),
        battery_low: v.boolean(),
      }),
    ),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),
});
