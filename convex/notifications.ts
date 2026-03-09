import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

const DOOR_OPEN_WARNING_MS = 2 * 60_000;
const DOOR_OPEN_CRITICAL_MS = 5 * 60_000;
const OFFLINE_WARNING_MS = 10 * 60_000;
const OFFLINE_CRITICAL_MS = 30 * 60_000;
const RECENT_REOPEN_WINDOW_MS = 30 * 60_000;
const WARNING_PUSH_DELAY_MS = 15 * 60_000;
const ESCALATION_WINDOWS_MS = [5 * 60_000, 15 * 60_000] as const;

const DEFAULT_NOTIFICATION_PREFERENCES = {
  warningPushEnabled: true,
  warningLocalEnabled: true,
  recoveryPushEnabled: true,
  nonCriticalByType: {
    temperature: true,
    door_open: true,
    device_offline: true,
    battery_low: true,
  },
  quietHoursStart: undefined as string | undefined,
  quietHoursEnd: undefined as string | undefined,
};

type NotificationIncident = Doc<"notificationIncidents">;
type NotificationEvent = Doc<"notificationEvents">;
type NotificationUserState = Doc<"notificationUserState">;
type UserDoc = Doc<"users">;
type PushDevice = Doc<"userPushDevices">;
type NotificationPreferenceDoc = Doc<"userNotificationPreferences">;
type NotificationSeverity = "warning" | "critical";
type NotificationIncidentType = "temperature" | "door_open" | "device_offline" | "battery_low";
type Snapshot = {
  institutionId: Id<"institutions">;
  deviceId: string;
  deviceNickname: string;
  mktStatus: "safe" | "warning" | "alert";
  batteryLevel: number;
  doorOpen: boolean;
  lastSeenAt: number;
  observedAt: number;
};
type SignalDefinition = {
  incidentType: NotificationIncidentType;
  severity: NotificationSeverity;
  title: string;
  body: string;
};
type DeliveryPlan = {
  eventType: string;
  incidentId: Id<"notificationIncidents">;
  summary: string;
  targetCount: number;
  tokens: string[];
  userIds: Id<"users">[];
};

function unauthenticatedError() {
  return new Error("UNAUTHENTICATED");
}

function forbiddenError() {
  return new Error("FORBIDDEN");
}

function pushTokenConflictError() {
  return new Error("PUSH_TOKEN_CONFLICT");
}

async function getAuthenticatedUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw unauthenticatedError();
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_firebase_uid", (q: any) => q.eq("firebaseUid", identity.subject))
    .unique();

  if (!user) {
    throw unauthenticatedError();
  }

  return user as UserDoc;
}

async function getAuthenticatedLinkedUser(ctx: any) {
  const user = await getAuthenticatedUser(ctx);
  if (!user.institutionId) {
    throw forbiddenError();
  }
  return user;
}

function buildSignals(snapshot: Snapshot, now = snapshot.observedAt): SignalDefinition[] {
  const signals: SignalDefinition[] = [];
  const elapsedSinceSeen = Math.max(0, now - snapshot.lastSeenAt);

  if (snapshot.mktStatus === "alert") {
    signals.push({
      incidentType: "temperature",
      severity: "critical",
      title: `${snapshot.deviceNickname} is above the safe temperature range`,
      body: "Immediate intervention is required to protect vaccine stock.",
    });
  } else if (snapshot.mktStatus === "warning") {
    signals.push({
      incidentType: "temperature",
      severity: "warning",
      title: `${snapshot.deviceNickname} has a temperature excursion in progress`,
      body: "Monitor the unit closely and verify whether the excursion clears.",
    });
  }

  if (snapshot.doorOpen) {
    if (elapsedSinceSeen >= DOOR_OPEN_CRITICAL_MS) {
      signals.push({
        incidentType: "door_open",
        severity: "critical",
        title: `${snapshot.deviceNickname} has remained open too long`,
        body: "Door-open duration has crossed the critical threshold.",
      });
    } else if (elapsedSinceSeen >= DOOR_OPEN_WARNING_MS) {
      signals.push({
        incidentType: "door_open",
        severity: "warning",
        title: `${snapshot.deviceNickname} door is still open`,
        body: "Door-open duration has crossed the warning threshold.",
      });
    }
  }

  if (elapsedSinceSeen >= OFFLINE_CRITICAL_MS) {
    signals.push({
      incidentType: "device_offline",
      severity: "critical",
      title: `${snapshot.deviceNickname} has been offline for more than 30 minutes`,
      body: "ColdGuard has not received a fresh heartbeat. Check connectivity and power immediately.",
    });
  } else if (elapsedSinceSeen >= OFFLINE_WARNING_MS) {
    signals.push({
      incidentType: "device_offline",
      severity: "warning",
      title: `${snapshot.deviceNickname} has not checked in recently`,
      body: "The device appears offline. Confirm the mobile bridge or sensor connection.",
    });
  }

  if (snapshot.batteryLevel < 10) {
    signals.push({
      incidentType: "battery_low",
      severity: "critical",
      title: `${snapshot.deviceNickname} battery is critically low`,
      body: "Restore power or recharge the device immediately.",
    });
  } else if (snapshot.batteryLevel < 20) {
    signals.push({
      incidentType: "battery_low",
      severity: "warning",
      title: `${snapshot.deviceNickname} battery is running low`,
      body: "Plan to recharge the device soon.",
    });
  }

  return dedupeSignals(signals);
}

function dedupeSignals(signals: SignalDefinition[]) {
  const map = new Map<NotificationIncidentType, SignalDefinition>();
  for (const signal of signals) {
    const existing = map.get(signal.incidentType);
    if (!existing || signal.severity === "critical") {
      map.set(signal.incidentType, signal);
    }
  }
  return Array.from(map.values());
}

function getRecoveryState(incident: NotificationIncident, snapshot: Snapshot, now = snapshot.observedAt) {
  switch (incident.incidentType as NotificationIncidentType) {
    case "temperature": {
      if (snapshot.mktStatus !== "safe") {
        return { healthyEvaluationStreak: 0, shouldResolve: false };
      }
      const healthyEvaluationStreak = incident.healthyEvaluationStreak + 1;
      return { healthyEvaluationStreak, shouldResolve: healthyEvaluationStreak >= 3 };
    }
    case "door_open":
      return { healthyEvaluationStreak: snapshot.doorOpen ? 0 : 1, shouldResolve: !snapshot.doorOpen };
    case "device_offline":
      return {
        healthyEvaluationStreak: now - snapshot.lastSeenAt < OFFLINE_WARNING_MS ? 1 : 0,
        shouldResolve: now - snapshot.lastSeenAt < OFFLINE_WARNING_MS,
      };
    case "battery_low":
      return {
        healthyEvaluationStreak: snapshot.batteryLevel >= 25 ? 1 : 0,
        shouldResolve: snapshot.batteryLevel >= 25,
      };
  }
}

function shouldReopenResolvedIncident(incident: NotificationIncident, observedAt: number) {
  return Boolean(incident.resolvedAt && observedAt - incident.resolvedAt <= RECENT_REOPEN_WINDOW_MS);
}

function parseClockMinutes(value: string) {
  const parts = value.split(":");
  if (parts.length !== 2) {
    return null;
  }

  const [rawHoursString, rawMinutesString] = parts;
  const hoursString = rawHoursString.trim();
  const minutesString = rawMinutesString.trim();
  if (!hoursString || !minutesString) {
    return null;
  }

  if (!/^\d+$/.test(hoursString) || !/^\d+$/.test(minutesString)) {
    return null;
  }

  const hours = Number(hoursString);
  const minutes = Number(minutesString);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function isWithinQuietHours(now: number, quietHoursStart?: string, quietHoursEnd?: string) {
  if (!quietHoursStart || !quietHoursEnd) return false;

  const start = parseClockMinutes(quietHoursStart);
  const end = parseClockMinutes(quietHoursEnd);
  if (start === null || end === null) return false;

  const currentDate = new Date(now);
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

  if (start === end) return false;
  if (start < end) {
    return currentMinutes >= start && currentMinutes < end;
  }
  return currentMinutes >= start || currentMinutes < end;
}

function normalizeNonCriticalByTypePreferences(
  preferences?: Partial<typeof DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType> | null,
) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType,
    ...preferences,
  };
}

function normalizeStoredNotificationPreferences(
  preferences?:
    | Pick<
        NotificationPreferenceDoc,
        | "warningPushEnabled"
        | "warningLocalEnabled"
        | "recoveryPushEnabled"
        | "nonCriticalByType"
        | "quietHoursStart"
        | "quietHoursEnd"
      >
    | null,
) {
  return {
    warningPushEnabled: preferences?.warningPushEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.warningPushEnabled,
    warningLocalEnabled: preferences?.warningLocalEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.warningLocalEnabled,
    recoveryPushEnabled: preferences?.recoveryPushEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.recoveryPushEnabled,
    nonCriticalByType: normalizeNonCriticalByTypePreferences(preferences?.nonCriticalByType),
    quietHoursStart: preferences?.quietHoursStart ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursStart,
    quietHoursEnd: preferences?.quietHoursEnd ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnd,
  };
}

function shouldDeliverPushToUser(
  incident: Pick<NotificationIncident, "incidentType" | "severity">,
  preferences:
    | Pick<
        NotificationPreferenceDoc,
        | "warningPushEnabled"
        | "warningLocalEnabled"
        | "recoveryPushEnabled"
        | "nonCriticalByType"
        | "quietHoursStart"
        | "quietHoursEnd"
      >
    | null,
  options: {
    recoveryOnly?: boolean;
  },
  now: number,
) {
  const resolvedPreferences = normalizeStoredNotificationPreferences(preferences);
  const quietHoursActive = isWithinQuietHours(
    now,
    resolvedPreferences.quietHoursStart,
    resolvedPreferences.quietHoursEnd,
  );

  if (options.recoveryOnly) {
    return resolvedPreferences.recoveryPushEnabled && !quietHoursActive;
  }

  if (incident.severity === "warning") {
    return (
      resolvedPreferences.warningPushEnabled &&
      resolvedPreferences.nonCriticalByType[incident.incidentType] &&
      !quietHoursActive
    );
  }

  return true;
}

function serializeSnapshot(snapshot: Snapshot) {
  return JSON.stringify(snapshot);
}

async function insertNotificationEvent(
  ctx: any,
  args: {
    incidentId: Id<"notificationIncidents">;
    eventType: string;
    actorUserId?: Id<"users">;
    channel?: string;
    summary?: string;
    metadata?: unknown;
    createdAt: number;
  },
) {
  await ctx.db.insert("notificationEvents", {
    incidentId: args.incidentId,
    eventType: args.eventType,
    actorUserId: args.actorUserId,
    channel: args.channel,
    summary: args.summary,
    metadataJson: args.metadata ? JSON.stringify(args.metadata) : undefined,
    createdAt: args.createdAt,
  });
}

async function getNotificationUserState(ctx: any, userId: Id<"users">, incidentId: Id<"notificationIncidents">) {
  return (await ctx.db
    .query("notificationUserState")
    .withIndex("by_user_incident", (q: any) => q.eq("userId", userId).eq("incidentId", incidentId))
    .unique()) as NotificationUserState | null;
}

async function upsertNotificationUserState(
  ctx: any,
  userId: Id<"users">,
  incident: NotificationIncident,
  patch: Partial<Pick<NotificationUserState, "readAt" | "archivedAt" | "lastViewedVersion">>,
) {
  const existing = await getNotificationUserState(ctx, userId, incident._id);
  if (existing) {
    await ctx.db.patch(existing._id, {
      readAt: patch.readAt ?? existing.readAt,
      archivedAt: patch.archivedAt ?? existing.archivedAt,
      lastViewedVersion: patch.lastViewedVersion ?? existing.lastViewedVersion,
    });
    return;
  }

  await ctx.db.insert("notificationUserState", {
    incidentId: incident._id,
    userId,
    readAt: patch.readAt,
    archivedAt: patch.archivedAt,
    lastViewedVersion: patch.lastViewedVersion ?? incident.version,
  });
}

async function createIncident(ctx: any, snapshot: Snapshot, signal: SignalDefinition) {
  const now = snapshot.observedAt;
  const incidentId = await ctx.db.insert("notificationIncidents", {
    institutionId: snapshot.institutionId,
    deviceId: snapshot.deviceId,
    deviceNickname: snapshot.deviceNickname,
    incidentType: signal.incidentType,
    severity: signal.severity,
    status: "open",
    title: signal.title,
    body: signal.body,
    firstTriggeredAt: now,
    lastTriggeredAt: now,
    reopenCount: 0,
    healthyEvaluationStreak: 0,
    version: 1,
    lastSnapshotJson: serializeSnapshot(snapshot),
    createdAt: now,
    updatedAt: now,
  });

  await insertNotificationEvent(ctx, {
    incidentId,
    eventType: "opened",
    summary: signal.title,
    createdAt: now,
  });

  return await ctx.db.get(incidentId);
}

async function reopenIncident(ctx: any, incident: NotificationIncident, snapshot: Snapshot, signal: SignalDefinition) {
  const now = snapshot.observedAt;
  await ctx.db.patch(incident._id, {
    status: "open",
    severity: signal.severity,
    title: signal.title,
    body: signal.body,
    lastTriggeredAt: now,
    acknowledgedAt: undefined,
    acknowledgedByUserId: undefined,
    resolvedAt: undefined,
    resolvedByUserId: undefined,
    healthyEvaluationStreak: 0,
    reopenCount: incident.reopenCount + 1,
    version: incident.version + 1,
    lastSnapshotJson: serializeSnapshot(snapshot),
    updatedAt: now,
  });

  await insertNotificationEvent(ctx, {
    incidentId: incident._id,
    eventType: "reopened",
    summary: signal.title,
    createdAt: now,
  });
}

async function updateIncident(ctx: any, incident: NotificationIncident, snapshot: Snapshot, signal: SignalDefinition) {
  const now = snapshot.observedAt;
  const hasMaterialUpdate =
    incident.severity !== signal.severity || incident.title !== signal.title || incident.body !== signal.body;

  await ctx.db.patch(incident._id, {
    severity: signal.severity,
    title: signal.title,
    body: signal.body,
    lastTriggeredAt: now,
    healthyEvaluationStreak: 0,
    version: hasMaterialUpdate ? incident.version + 1 : incident.version,
    lastSnapshotJson: serializeSnapshot(snapshot),
    updatedAt: now,
  });

  if (hasMaterialUpdate) {
    await insertNotificationEvent(ctx, {
      incidentId: incident._id,
      eventType: "updated",
      summary: signal.title,
      createdAt: now,
    });
  }
}

async function resolveIncidentRecord(
  ctx: any,
  incident: NotificationIncident,
  args: {
    actorUserId?: Id<"users">;
    observedAt: number;
    reason: string;
    resolvedByUserId?: Id<"users">;
  },
) {
  await ctx.db.patch(incident._id, {
    status: "resolved",
    resolvedAt: args.observedAt,
    resolvedByUserId: args.resolvedByUserId,
    healthyEvaluationStreak: 0,
    version: incident.version + 1,
    updatedAt: args.observedAt,
  });

  await insertNotificationEvent(ctx, {
    incidentId: incident._id,
    eventType: "resolved",
    actorUserId: args.actorUserId,
    summary: args.reason,
    createdAt: args.observedAt,
  });
}

async function collectDeviceIncidents(ctx: any, institutionId: Id<"institutions">, deviceId: string) {
  const incidents = (await ctx.db
    .query("notificationIncidents")
    .withIndex("by_institution_status", (q: any) => q.eq("institutionId", institutionId))
    .collect()) as NotificationIncident[];

  return incidents.filter((incident) => incident.deviceId === deviceId);
}

async function runSnapshotEvaluation(ctx: any, snapshot: Snapshot) {
  const signals = buildSignals(snapshot);
  const deviceIncidents = await collectDeviceIncidents(ctx, snapshot.institutionId, snapshot.deviceId);
  const activeIncidents = deviceIncidents.filter((incident) => incident.status !== "resolved");
  const resolvedIncidents = deviceIncidents.filter((incident) => incident.status === "resolved");

  for (const incident of activeIncidents) {
    const signal = signals.find((entry) => entry.incidentType === incident.incidentType);
    if (signal) {
      await updateIncident(ctx, incident, snapshot, signal);
      continue;
    }

    const recovery = getRecoveryState(incident, snapshot);
    if (recovery.shouldResolve) {
      await resolveIncidentRecord(ctx, incident, {
        observedAt: snapshot.observedAt,
        reason: `${snapshot.deviceNickname} returned to a healthy state.`,
      });
    } else if (recovery.healthyEvaluationStreak !== incident.healthyEvaluationStreak) {
      await ctx.db.patch(incident._id, {
        healthyEvaluationStreak: recovery.healthyEvaluationStreak,
        lastSnapshotJson: serializeSnapshot(snapshot),
        updatedAt: snapshot.observedAt,
      });
    }
  }

  for (const signal of signals) {
    const existingActive = activeIncidents.find((incident) => incident.incidentType === signal.incidentType);
    if (existingActive) {
      continue;
    }

    const existingResolved = resolvedIncidents
      .filter((incident) => incident.incidentType === signal.incidentType)
      .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))[0];

    if (existingResolved && shouldReopenResolvedIncident(existingResolved, snapshot.observedAt)) {
      await reopenIncident(ctx, existingResolved, snapshot, signal);
    } else {
      await createIncident(ctx, snapshot, signal);
    }
  }

  return await collectDeviceIncidents(ctx, snapshot.institutionId, snapshot.deviceId);
}

export const evaluateOperationalSnapshot = mutation({
  args: {
    institutionId: v.id("institutions"),
    deviceId: v.string(),
    deviceNickname: v.string(),
    mktStatus: v.union(v.literal("safe"), v.literal("warning"), v.literal("alert")),
    batteryLevel: v.number(),
    doorOpen: v.boolean(),
    lastSeenAt: v.number(),
    observedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const snapshot: Snapshot = {
      institutionId: args.institutionId,
      deviceId: args.deviceId,
      deviceNickname: args.deviceNickname,
      mktStatus: args.mktStatus,
      batteryLevel: args.batteryLevel,
      doorOpen: args.doorOpen,
      lastSeenAt: args.lastSeenAt,
      observedAt: args.observedAt,
    };
    return await runSnapshotEvaluation(ctx, snapshot);
  },
});

export const evaluateOperationalSnapshotInternal = internalMutation({
  args: {
    institutionId: v.id("institutions"),
    deviceId: v.string(),
    deviceNickname: v.string(),
    mktStatus: v.union(v.literal("safe"), v.literal("warning"), v.literal("alert")),
    batteryLevel: v.number(),
    doorOpen: v.boolean(),
    lastSeenAt: v.number(),
    observedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await runSnapshotEvaluation(ctx, {
      institutionId: args.institutionId,
      deviceId: args.deviceId,
      deviceNickname: args.deviceNickname,
      mktStatus: args.mktStatus,
      batteryLevel: args.batteryLevel,
      doorOpen: args.doorOpen,
      lastSeenAt: args.lastSeenAt,
      observedAt: args.observedAt,
    });
  },
});

function sortIncidents(a: NotificationIncident, b: NotificationIncident) {
  const aOrder = a.status === "resolved" ? 1 : 0;
  const bOrder = b.status === "resolved" ? 1 : 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  const aTime = a.status === "resolved" ? a.resolvedAt ?? a.lastTriggeredAt : a.lastTriggeredAt;
  const bTime = b.status === "resolved" ? b.resolvedAt ?? b.lastTriggeredAt : b.lastTriggeredAt;
  return bTime - aTime;
}

async function getInstitutionIncidents(ctx: any, institutionId: Id<"institutions">) {
  return ((await ctx.db
    .query("notificationIncidents")
    .withIndex("by_institution_status", (q: any) => q.eq("institutionId", institutionId))
    .collect()) as NotificationIncident[]).sort(sortIncidents);
}

function mapIncidentWithUserState(
  incident: NotificationIncident,
  institutionName: string,
  userState: NotificationUserState | null,
) {
  return {
    incidentId: incident._id,
    institutionName,
    deviceId: incident.deviceId,
    deviceNickname: incident.deviceNickname,
    incidentType: incident.incidentType,
    severity: incident.severity,
    status: incident.status,
    title: incident.title,
    body: incident.body,
    firstTriggeredAt: incident.firstTriggeredAt,
    lastTriggeredAt: incident.lastTriggeredAt,
    acknowledgedAt: incident.acknowledgedAt ?? null,
    resolvedAt: incident.resolvedAt ?? null,
    userState: userState
      ? {
          readAt: userState.readAt ?? null,
          archivedAt: userState.archivedAt ?? null,
          lastViewedVersion: userState.lastViewedVersion,
        }
      : null,
  };
}

async function getNotificationUserStateMap(ctx: any, userId: Id<"users">) {
  const userStates = (await ctx.db
    .query("notificationUserState")
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .collect()) as NotificationUserState[];
  return new Map(userStates.map((state) => [state.incidentId, state] as const));
}

async function mapIncidentForUser(ctx: any, incident: NotificationIncident, institutionName: string, userId: Id<"users">) {
  const userState = await ctx.db
    .query("notificationUserState")
    .withIndex("by_user_incident", (q: any) => q.eq("userId", userId).eq("incidentId", incident._id))
    .unique();

  return mapIncidentWithUserState(incident, institutionName, userState);
}

export const listInbox = query({
  args: {
    statusFilter: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedLinkedUser(ctx);
    const institution = await ctx.db.get(user.institutionId!);
    if (!institution) return [];

    const incidents = await getInstitutionIncidents(ctx, user.institutionId!);
    const userStateByIncidentId = await getNotificationUserStateMap(ctx, user._id);
    const filtered = incidents.filter((incident) => {
      if (args.statusFilter && args.statusFilter !== "all" && incident.status !== args.statusFilter) {
        return false;
      }
      return !userStateByIncidentId.get(incident._id)?.archivedAt;
    });

    return filtered
      .slice(0, args.limit ?? 50)
      .map((incident) =>
        mapIncidentWithUserState(incident, institution.name, userStateByIncidentId.get(incident._id) ?? null),
      );
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedLinkedUser(ctx);
    const incidents = await getInstitutionIncidents(ctx, user.institutionId!);
    const stateByIncidentId = await getNotificationUserStateMap(ctx, user._id);
    let unreadCount = 0;

    for (const incident of incidents) {
      if (incident.status === "resolved") continue;
      const state = stateByIncidentId.get(incident._id);

      if (!state?.readAt && !state?.archivedAt) {
        unreadCount += 1;
      }
    }

    return unreadCount;
  },
});

export const getIncidentDetail = query({
  args: {
    incidentId: v.id("notificationIncidents"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedLinkedUser(ctx);
    const incident = (await ctx.db.get(args.incidentId)) as NotificationIncident | null;
    if (!incident || incident.institutionId !== user.institutionId) {
      return null;
    }

    const institution = await ctx.db.get(user.institutionId!);
    const mapped = await mapIncidentForUser(ctx, incident, institution?.name ?? "Unknown Institution", user._id);
    const events = (await ctx.db
      .query("notificationEvents")
      .withIndex("by_incident_id", (q: any) => q.eq("incidentId", args.incidentId))
      .collect()) as NotificationEvent[];

    return {
      ...mapped,
      events: events
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((event) => ({
          _id: event._id,
          eventType: event.eventType,
          createdAt: event.createdAt,
          actorLabel: event.actorUserId ? "ColdGuard operator" : null,
          summary: event.summary ?? incident.title,
        })),
    };
  },
});

export const markIncidentRead = mutation({
  args: {
    incidentId: v.id("notificationIncidents"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedLinkedUser(ctx);
    const incident = (await ctx.db.get(args.incidentId)) as NotificationIncident | null;
    if (!incident || incident.institutionId !== user.institutionId) {
      throw forbiddenError();
    }

    await upsertNotificationUserState(ctx, user._id, incident, {
      readAt: Date.now(),
      lastViewedVersion: incident.version,
    });
  },
});

export const archiveIncident = mutation({
  args: {
    incidentId: v.id("notificationIncidents"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedLinkedUser(ctx);
    const incident = (await ctx.db.get(args.incidentId)) as NotificationIncident | null;
    if (!incident || incident.institutionId !== user.institutionId) {
      throw forbiddenError();
    }

    await upsertNotificationUserState(ctx, user._id, incident, {
      archivedAt: Date.now(),
      lastViewedVersion: incident.version,
    });
  },
});

export const acknowledgeIncident = mutation({
  args: {
    incidentId: v.id("notificationIncidents"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedLinkedUser(ctx);
    const incident = (await ctx.db.get(args.incidentId)) as NotificationIncident | null;
    if (!incident || incident.institutionId !== user.institutionId) {
      throw forbiddenError();
    }
    if (incident.status === "resolved") {
      return incident;
    }

    const now = Date.now();
    await ctx.db.patch(incident._id, {
      status: "acknowledged",
      acknowledgedAt: now,
      acknowledgedByUserId: user._id,
      updatedAt: now,
    });
    await insertNotificationEvent(ctx, {
      incidentId: incident._id,
      eventType: "acknowledged",
      actorUserId: user._id,
      summary: `${user.displayName ?? "ColdGuard operator"} acknowledged the incident.`,
      createdAt: now,
    });
    return await ctx.db.get(incident._id);
  },
});

export const resolveIncident = mutation({
  args: {
    incidentId: v.id("notificationIncidents"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedLinkedUser(ctx);
    const incident = (await ctx.db.get(args.incidentId)) as NotificationIncident | null;
    if (!incident || incident.institutionId !== user.institutionId) {
      throw forbiddenError();
    }
    if (incident.status === "resolved") {
      return incident;
    }

    await resolveIncidentRecord(ctx, incident, {
      actorUserId: user._id,
      observedAt: Date.now(),
      resolvedByUserId: user._id,
      reason: args.note?.trim() || `${user.displayName ?? "ColdGuard operator"} resolved the incident.`,
    });

    return await ctx.db.get(incident._id);
  },
});

export const getNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const existing = await ctx.db
      .query("userNotificationPreferences")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .unique();

    if (!existing) {
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        lastUpdatedAt: 0,
      };
    }

    return {
      ...normalizeStoredNotificationPreferences(existing),
      quietHoursStart: existing.quietHoursStart ?? null,
      quietHoursEnd: existing.quietHoursEnd ?? null,
      lastUpdatedAt: existing.updatedAt,
    };
  },
});

export const updateNotificationPreferences = mutation({
  args: {
    warningPushEnabled: v.boolean(),
    warningLocalEnabled: v.boolean(),
    recoveryPushEnabled: v.boolean(),
    nonCriticalByType: v.object({
      temperature: v.boolean(),
      door_open: v.boolean(),
      device_offline: v.boolean(),
      battery_low: v.boolean(),
    }),
    quietHoursStart: v.optional(v.union(v.string(), v.null())),
    quietHoursEnd: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("userNotificationPreferences")
      .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
      .unique();

    const quietHoursStart = args.quietHoursStart ?? undefined;
    const quietHoursEnd = args.quietHoursEnd ?? undefined;

    const patch = {
      warningPushEnabled: args.warningPushEnabled,
      warningLocalEnabled: args.warningLocalEnabled,
      recoveryPushEnabled: args.recoveryPushEnabled,
      nonCriticalByType: normalizeNonCriticalByTypePreferences(args.nonCriticalByType),
      quietHoursStart,
      quietHoursEnd,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("userNotificationPreferences", {
        userId: user._id,
        ...patch,
      });
    }

    return {
      ...patch,
      quietHoursStart: patch.quietHoursStart ?? null,
      quietHoursEnd: patch.quietHoursEnd ?? null,
      lastUpdatedAt: now,
    };
  },
});

export const registerPushDevice = mutation({
  args: {
    expoPushToken: v.string(),
    platform: v.string(),
    appVersion: v.string(),
    permissionStatus: v.string(),
    deviceLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("userPushDevices")
      .withIndex("by_token", (q: any) => q.eq("expoPushToken", args.expoPushToken))
      .unique();

    const patch = {
      userId: user._id,
      platform: args.platform,
      appVersion: args.appVersion,
      permissionStatus: args.permissionStatus,
      deviceLabel: args.deviceLabel,
      isActive: true,
      lastRegisteredAt: now,
      lastSeenAt: now,
    };

    if (existing) {
      if (existing.userId !== user._id) {
        console.error("Blocked push token reassignment attempt.", {
          expoPushToken: args.expoPushToken,
          existingDeviceId: existing._id,
          existingUserId: existing.userId,
          attemptedUserId: user._id,
        });
        throw pushTokenConflictError();
      }
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("userPushDevices", {
      expoPushToken: args.expoPushToken,
      ...patch,
    });
  },
});

export const unregisterPushDevice = mutation({
  args: {
    expoPushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const existing = await ctx.db
      .query("userPushDevices")
      .withIndex("by_token", (q: any) => q.eq("expoPushToken", args.expoPushToken))
      .unique();

    if (!existing || existing.userId !== user._id) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      isActive: false,
      lastSeenAt: Date.now(),
    });

    return existing._id;
  },
});

async function collectEligiblePushTargets(
  ctx: any,
  incident: NotificationIncident,
  options: {
    escalationOnly?: boolean;
    recoveryOnly?: boolean;
  },
  now: number,
) {
  const users = (await ctx.db
    .query("users")
    .withIndex("by_institution_id", (q: any) => q.eq("institutionId", incident.institutionId))
    .collect()) as UserDoc[];
  const userIds = users.map((user) => user._id);
  if (userIds.length === 0) {
    return [];
  }

  const matchesUserIds = (q: any) => {
    if (userIds.length === 1) {
      return q.eq(q.field("userId"), userIds[0]);
    }
    return q.or(...userIds.map((userId) => q.eq(q.field("userId"), userId)));
  };
  const [devices, preferences] = await Promise.all([
    ctx.db.query("userPushDevices").filter((q: any) => matchesUserIds(q)).collect() as Promise<PushDevice[]>,
    ctx.db
      .query("userNotificationPreferences")
      .filter((q: any) => matchesUserIds(q))
      .collect() as Promise<NotificationPreferenceDoc[]>,
  ]);
  const devicesByUserId = new Map<Id<"users">, PushDevice[]>();
  for (const device of devices) {
    const existingDevices = devicesByUserId.get(device.userId);
    if (existingDevices) {
      existingDevices.push(device);
    } else {
      devicesByUserId.set(device.userId, [device]);
    }
  }
  const preferencesByUserId = new Map(preferences.map((preference) => [preference.userId, preference] as const));
  const targets: Array<{ userId: Id<"users">; token: string }> = [];

  for (const user of users) {
    if (options.escalationOnly && user.role !== "Supervisor") {
      continue;
    }

    const devices = devicesByUserId.get(user._id) ?? [];
    if (!devices.length) continue;

    const preferences = preferencesByUserId.get(user._id) ?? null;
    if (!shouldDeliverPushToUser(incident, preferences, options, now)) {
      continue;
    }

    for (const device of devices) {
      if (device.isActive && device.permissionStatus === "granted") {
        targets.push({ userId: user._id, token: device.expoPushToken });
      }
    }
  }

  return targets;
}

function hasEvent(events: NotificationEvent[], eventType: string) {
  return events.some((event) => event.eventType === eventType);
}

async function collectIncidentDeliveryPlans(ctx: any, incident: NotificationIncident, now: number, mode: "all" | "escalation") {
  const events = (await ctx.db
    .query("notificationEvents")
    .withIndex("by_incident_id", (q: any) => q.eq("incidentId", incident._id))
    .collect()) as NotificationEvent[];
  const plans: DeliveryPlan[] = [];

  if (mode === "all" && incident.severity === "critical" && incident.status !== "resolved" && !hasEvent(events, "push_initial_sent")) {
    const targets = await collectEligiblePushTargets(ctx, incident, {}, now);
    if (targets.length > 0) {
      plans.push({
        eventType: "push_initial_sent",
        incidentId: incident._id,
        summary: `Queued initial critical push delivery for ${targets.length} recipient(s).`,
        targetCount: targets.length,
        tokens: targets.map((target) => target.token),
        userIds: targets.map((target) => target.userId),
      });
    }
  }

  if (
    mode === "all" &&
    incident.severity === "warning" &&
    incident.status !== "resolved" &&
    now - incident.firstTriggeredAt >= WARNING_PUSH_DELAY_MS &&
    !hasEvent(events, "push_warning_sent")
  ) {
    const targets = await collectEligiblePushTargets(ctx, incident, {}, now);
    if (targets.length > 0) {
      plans.push({
        eventType: "push_warning_sent",
        incidentId: incident._id,
        summary: `Queued delayed warning push delivery for ${targets.length} recipient(s).`,
        targetCount: targets.length,
        tokens: targets.map((target) => target.token),
        userIds: targets.map((target) => target.userId),
      });
    }
  }

  if (
    mode === "all" &&
    incident.severity === "critical" &&
    incident.status === "resolved" &&
    incident.acknowledgedAt &&
    !hasEvent(events, "push_recovery_sent")
  ) {
    const targets = await collectEligiblePushTargets(ctx, incident, { recoveryOnly: true }, now);
    if (targets.length > 0) {
      plans.push({
        eventType: "push_recovery_sent",
        incidentId: incident._id,
        summary: `Queued recovery push delivery for ${targets.length} recipient(s).`,
        targetCount: targets.length,
        tokens: targets.map((target) => target.token),
        userIds: targets.map((target) => target.userId),
      });
    }
  }

  if (incident.severity === "critical" && incident.status === "open" && !incident.acknowledgedAt) {
    for (const windowMs of ESCALATION_WINDOWS_MS) {
      const eventType = `push_escalation_${windowMs}_sent`;
      if (now - incident.firstTriggeredAt < windowMs || hasEvent(events, eventType)) {
        continue;
      }

      const targets = await collectEligiblePushTargets(ctx, incident, { escalationOnly: true }, now);
      if (targets.length > 0) {
        plans.push({
          eventType,
          incidentId: incident._id,
          summary: `Queued supervisor escalation push delivery for ${targets.length} recipient(s).`,
          targetCount: targets.length,
          tokens: targets.map((target) => target.token),
          userIds: targets.map((target) => target.userId),
        });
      }
    }
  }

  return mode === "escalation"
    ? plans.filter((plan) => plan.eventType.startsWith("push_escalation_"))
    : plans;
}

async function persistDeliveryPlans(ctx: any, plans: DeliveryPlan[], now: number) {
  for (const plan of plans) {
    await insertNotificationEvent(ctx, {
      incidentId: plan.incidentId,
      eventType: plan.eventType,
      channel: "push",
      summary: plan.summary,
      metadata: {
        targetCount: plan.targetCount,
        tokens: plan.tokens,
        userIds: plan.userIds,
      },
      createdAt: now,
    });

    if (plan.eventType.startsWith("push_escalation_")) {
      await ctx.db.patch(plan.incidentId, {
        lastEscalatedAt: now,
        updatedAt: now,
      });
    }
  }
}

async function getDueDeliveryIncidents(ctx: any, now: number) {
  const openIncidents = (await ctx.db
    .query("notificationIncidents")
    .withIndex("by_status", (q: any) => q.eq("status", "open"))
    .collect()) as NotificationIncident[];
  const acknowledgedIncidents = (await ctx.db
    .query("notificationIncidents")
    .withIndex("by_status", (q: any) => q.eq("status", "acknowledged"))
    .collect()) as NotificationIncident[];
  const resolvedIncidents = ((await ctx.db
    .query("notificationIncidents")
    .withIndex("by_status", (q: any) => q.eq("status", "resolved"))
    .collect()) as NotificationIncident[]).filter(
    (incident) => (incident.resolvedAt ?? 0) >= now - RECENT_REOPEN_WINDOW_MS,
  );

  return [...openIncidents, ...acknowledgedIncidents, ...resolvedIncidents];
}

export const dispatchDueDeliveries = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const incidents = await getDueDeliveryIncidents(ctx, now);
    const plans: DeliveryPlan[] = [];

    for (const incident of incidents) {
      plans.push(...(await collectIncidentDeliveryPlans(ctx, incident, now, "all")));
    }

    await persistDeliveryPlans(ctx, plans, now);
    return plans;
  },
});

export const escalateDueIncidents = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const incidents = await getDueDeliveryIncidents(ctx, now);
    const plans: DeliveryPlan[] = [];

    for (const incident of incidents) {
      plans.push(...(await collectIncidentDeliveryPlans(ctx, incident, now, "escalation")));
    }

    await persistDeliveryPlans(ctx, plans, now);
    return plans;
  },
});

export const __testing = {
  buildSignals,
  getRecoveryState,
  isWithinQuietHours,
  normalizeNonCriticalByTypePreferences,
  normalizeStoredNotificationPreferences,
  shouldDeliverPushToUser,
  parseClockMinutes,
  normalizeQuietHoursArgs: (args: { quietHoursStart?: string | null; quietHoursEnd?: string | null }) => ({
    quietHoursStart: args.quietHoursStart ?? undefined,
    quietHoursEnd: args.quietHoursEnd ?? undefined,
  }),
};
