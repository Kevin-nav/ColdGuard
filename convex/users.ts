import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function invalidInstitutionCodeError() {
  return new Error("INSTITUTION_CODE_NOT_RECOGNIZED");
}

function invalidInstitutionCredentialError() {
  return new Error("INVALID_INSTITUTION_CREDENTIALS");
}

function inactiveInstitutionCredentialError() {
  return new Error("INACTIVE_INSTITUTION_CREDENTIAL");
}

export const upsertByFirebaseUid = mutation({
  args: {
    firebaseUid: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        displayName: args.displayName,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      firebaseUid: args.firebaseUid,
      email: args.email,
      displayName: args.displayName,
    });
  },
});

export const getByFirebaseUid = query({
  args: {
    firebaseUid: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .unique();
  },
});

export const getLinkedProfileByFirebaseUid = query({
  args: {
    firebaseUid: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .unique();

    if (!user || !user.institutionId) {
      return null;
    }

    const institution = await ctx.db.get(user.institutionId);
    if (!institution) {
      return null;
    }

    return {
      firebaseUid: user.firebaseUid,
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      institutionName: institution.name,
      role: user.role ?? "Nurse",
      staffId: user.staffId ?? null,
    };
  },
});

export const listInstitutions = query({
  args: {},
  handler: async (ctx) => {
    const institutions = await ctx.db.query("institutions").collect();
    return institutions
      .map((institution) => ({
        id: institution._id,
        code: institution.code,
        name: institution.name,
        district: institution.district ?? null,
        region: institution.region ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const linkInstitutionByQr = mutation({
  args: {
    firebaseUid: v.string(),
    institutionCode: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .unique();

    if (!user) {
      throw new Error("User profile not found. Complete auth bootstrap first.");
    }

    const institution = await ctx.db
      .query("institutions")
      .withIndex("by_code", (q) => q.eq("code", args.institutionCode))
      .unique();

    if (!institution) {
      throw invalidInstitutionCodeError();
    }

    await ctx.db.patch(user._id, {
      institutionId: institution._id,
      role: "Nurse",
      staffId: undefined,
    });

    return {
      institutionId: institution._id,
      institutionName: institution.name,
      handshakeToken: institution.handshakeToken,
      role: "Nurse",
      staffId: null,
      displayName: user.displayName ?? null,
    };
  },
});

export const linkInstitutionByCredentials = mutation({
  args: {
    firebaseUid: v.string(),
    institutionId: v.id("institutions"),
    staffId: v.string(),
    passcode: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .unique();

    if (!user) {
      throw new Error("User profile not found. Complete auth bootstrap first.");
    }

    const institution = await ctx.db.get(args.institutionId);
    if (!institution) {
      throw invalidInstitutionCodeError();
    }

    const credential = await ctx.db
      .query("institutionCredentials")
      .withIndex("by_institution_staff_id", (q) =>
        q.eq("institutionId", args.institutionId).eq("staffId", args.staffId),
      )
      .unique();

    if (!credential || credential.passcode !== args.passcode) {
      throw invalidInstitutionCredentialError();
    }

    if (!credential.isActive) {
      throw inactiveInstitutionCredentialError();
    }

    await ctx.db.patch(user._id, {
      institutionId: institution._id,
      role: credential.role ?? "Nurse",
      staffId: credential.staffId,
      displayName: user.displayName ?? credential.displayName ?? undefined,
    });

    return {
      institutionId: institution._id,
      institutionName: institution.name,
      handshakeToken: institution.handshakeToken,
      role: credential.role ?? "Nurse",
      staffId: credential.staffId,
      displayName: credential.displayName ?? user.displayName ?? null,
    };
  },
});
