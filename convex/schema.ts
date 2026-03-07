import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    role: v.optional(v.string()),
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
    role: v.optional(v.string()),
    staffId: v.optional(v.string()),
  }).index("by_firebase_uid", ["firebaseUid"]),
});
