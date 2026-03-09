import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getNextCredentialAttemptState, isCredentialAttemptLocked } from "./credential_throttle";
import { hashInstitutionPasscode, isHashedPasscode, verifyInstitutionPasscode } from "./passcodes";

function invalidInstitutionCodeError() {
  return new Error("INSTITUTION_CODE_NOT_RECOGNIZED");
}

function invalidInstitutionCredentialError() {
  return new Error("INVALID_INSTITUTION_CREDENTIALS");
}

function inactiveInstitutionCredentialError() {
  return new Error("INACTIVE_INSTITUTION_CREDENTIAL");
}

function institutionCredentialLockedError() {
  return new Error("INSTITUTION_CREDENTIAL_LOCKED");
}

async function getAuthenticatedFirebaseUid(ctx: { auth: { getUserIdentity(): Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("UNAUTHENTICATED");
  }
  return identity.subject;
}

export const upsertByFirebaseUid = mutation({
  args: {
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const firebaseUid = await getAuthenticatedFirebaseUid(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", firebaseUid))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        displayName: args.displayName,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      firebaseUid,
      email: args.email,
      displayName: args.displayName,
    });
  },
});

export const getByFirebaseUid = query({
  args: {},
  handler: async (ctx) => {
    const firebaseUid = await getAuthenticatedFirebaseUid(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", firebaseUid))
      .unique();
  },
});

export const getLinkedProfileByFirebaseUid = query({
  args: {},
  handler: async (ctx) => {
    const firebaseUid = await getAuthenticatedFirebaseUid(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", firebaseUid))
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
        name: institution.name,
        hasQr: true,
        district: institution.district ?? null,
        region: institution.region ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const linkInstitutionByQr = mutation({
  args: {
    institutionCode: v.string(),
  },
  handler: async (ctx, args) => {
    const firebaseUid = await getAuthenticatedFirebaseUid(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", firebaseUid))
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
    institutionId: v.id("institutions"),
    staffId: v.string(),
    passcode: v.string(),
  },
  handler: async (ctx, args) => {
    const firebaseUid = await getAuthenticatedFirebaseUid(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", firebaseUid))
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
    const attemptRecord = await ctx.db
      .query("institutionCredentialAttempts")
      .withIndex("by_institution_staff_id", (q) =>
        q.eq("institutionId", args.institutionId).eq("staffId", args.staffId),
      )
      .unique();
    const now = Date.now();

    if (isCredentialAttemptLocked(attemptRecord, now)) {
      throw institutionCredentialLockedError();
    }

    const normalizedPasscode = args.passcode.trim();
    const isValidCredential =
      credential && (await verifyInstitutionPasscode(credential.passcode, normalizedPasscode));

    if (!credential || !isValidCredential) {
      const nextAttemptState = getNextCredentialAttemptState(attemptRecord, now);
      if (attemptRecord) {
        await ctx.db.patch(attemptRecord._id, nextAttemptState);
      } else {
        await ctx.db.insert("institutionCredentialAttempts", {
          institutionId: args.institutionId,
          staffId: args.staffId,
          ...nextAttemptState,
        });
      }
      throw invalidInstitutionCredentialError();
    }

    if (!credential.isActive) {
      throw inactiveInstitutionCredentialError();
    }

    if (attemptRecord) {
      await ctx.db.delete(attemptRecord._id);
    }

    if (!isHashedPasscode(credential.passcode)) {
      await ctx.db.patch(credential._id, {
        passcode: await hashInstitutionPasscode(normalizedPasscode),
      });
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
