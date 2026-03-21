import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { normalizeUserRole } from "./roles";

/**
 * purgeDevice — hard-deletes a device and all related rows.
 *
 * Internal mutation: only callable from the CLI (npx convex run) or
 * other server-side Convex functions. NOT callable from the app client.
 *
 * Usage (from repo root):
 *   npx convex run maintenance:purgeDevice '{"deviceId":"CG-ESP32-5C7BCC"}'
 */
export const purgeDevice = internalMutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {

    // ── Find the device (allow any status — this is a purge) ──────────────
    const device = await ctx.db
      .query("devices")
      .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
      .unique();

    if (!device) {
      return { deleted: false, message: `Device ${args.deviceId} not found in Convex.` };
    }

    // ── Delete all assignments (active + historical) ───────────────────────
    const assignments = await ctx.db
      .query("deviceAssignments")
      .withIndex("by_device_active", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    // Also collect inactive assignments via full scan for this device
    const allAssignments = await ctx.db
      .query("deviceAssignments")
      .collect()
      .then((rows) => rows.filter((row) => row.deviceId === args.deviceId));

    let assignmentsDeleted = 0;
    for (const assignment of allAssignments) {
      await ctx.db.delete(assignment._id);
      assignmentsDeleted++;
    }

    // ── Delete all audit events ────────────────────────────────────────────
    const auditEvents = await ctx.db
      .query("deviceAuditEvents")
      .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    let auditEventsDeleted = 0;
    for (const event of auditEvents) {
      await ctx.db.delete(event._id);
      auditEventsDeleted++;
    }

    // ── Delete all notification incidents ─────────────────────────────────
    const incidents = await ctx.db
      .query("notificationIncidents")
      .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    let incidentsDeleted = 0;
    for (const incident of incidents) {
      // Also delete child notificationEvents and notificationUserState rows
      const events = await ctx.db
        .query("notificationEvents")
        .withIndex("by_incident_id", (q) => q.eq("incidentId", incident._id))
        .collect();
      for (const event of events) await ctx.db.delete(event._id);

      const userStates = await ctx.db
        .query("notificationUserState")
        .withIndex("by_incident_user", (q) => q.eq("incidentId", incident._id))
        .collect();
      for (const state of userStates) await ctx.db.delete(state._id);

      await ctx.db.delete(incident._id);
      incidentsDeleted++;
    }

    // ── Delete the device itself ───────────────────────────────────────────
    await ctx.db.delete(device._id);

    return {
      deleted: true,
      deviceId: args.deviceId,
      assignmentsDeleted,
      auditEventsDeleted,
      incidentsDeleted,
      message: `Purged device ${args.deviceId} and all related records.`,
    };
  },
});



export const normalizeStoredRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    let institutionCredentialUpdates = 0;
    let userUpdates = 0;

    const institutionCredentials = await ctx.db.query("institutionCredentials").collect();
    for (const credential of institutionCredentials) {
      const normalizedRole = normalizeUserRole(credential.role);
      if (credential.role !== normalizedRole) {
        await ctx.db.patch(credential._id, {
          role: normalizedRole,
        });
        institutionCredentialUpdates += 1;
      }
    }

    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      const normalizedRole = normalizeUserRole(user.role);
      if (user.role !== normalizedRole) {
        await ctx.db.patch(user._id, {
          role: normalizedRole,
        });
        userUpdates += 1;
      }
    }

    return {
      institutionCredentialUpdates,
      userUpdates,
    };
  },
});
