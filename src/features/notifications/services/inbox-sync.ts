import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "../../../lib/convex/client";
import { getDevicesForInstitution } from "../../../lib/storage/sqlite/device-repository";
import {
  archiveNotification,
  getNotificationById,
  getNotificationPreferences,
  listNotificationStateForIncidentIds,
  listNotificationsForInstitution,
  markNotificationRead,
  replaceNotificationCacheForInstitution,
  saveNotificationCache,
  saveNotificationPreferences,
} from "../../../lib/storage/sqlite/notification-repository";
import {
  deleteSyncJob,
  enqueueSyncJob,
  listPendingSyncJobs,
  setSyncJobStatus,
  type SyncJobRecord,
} from "../../../lib/storage/sqlite/sync-job-repository";
import { buildNotificationIncidentsFromDevices } from "./policy";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationSortTime,
  type NotificationIncidentRecord,
  type NotificationPreferences,
  type NotificationTimelineEvent,
} from "../types";

/**
 * Convex document IDs are URL-safe base64-ish strings without colons or spaces.
 * Local-only IDs (from policy.ts) contain colons, e.g. "device-1:device_offline".
 */
function isConvexId(id: string): boolean {
  return !id.includes(":") && !id.includes(" ") && id.length > 0;
}

type RemoteInboxItem = {
  _id?: string;
  acknowledgedAt?: number | null;
  body: string;
  deviceId: string;
  deviceNickname: string;
  firstTriggeredAt: number;
  incidentId?: string;
  incidentType: NotificationIncidentRecord["incidentType"];
  institutionName?: string;
  lastTriggeredAt: number;
  readAt?: number | null;
  resolvedAt?: number | null;
  severity: NotificationIncidentRecord["severity"];
  status: NotificationIncidentRecord["status"];
  title: string;
  userState?: {
    archivedAt?: number | null;
    lastViewedVersion?: number | null;
    readAt?: number | null;
  } | null;
};

type RemoteIncidentDetail = RemoteInboxItem & {
  events?: {
    _id?: string;
    actorLabel?: string | null;
    createdAt: number;
    eventType: NotificationTimelineEvent["type"];
    summary?: string;
  }[];
};

type SyncJobType =
  | "acknowledge_incident"
  | "archive_notification"
  | "mark_notification_read"
  | "register_push_device"
  | "resolve_incident"
  | "update_notification_preferences";

function isPushTokenConflictError(error: unknown) {
  return error instanceof Error && error.message.includes("PUSH_TOKEN_CONFLICT");
}

function isLegacyNotificationPreferenceValidatorError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("ArgumentValidationError") &&
    error.message.includes("field `nonCriticalByType`") &&
    error.message.includes("not in the validator")
  );
}

function normalizeQuietHoursPreference(value: string | null | undefined) {
  return value ?? undefined;
}

function normalizeRoutineTypePreferences(
  preferences: Partial<NotificationPreferences["nonCriticalByType"]> | null | undefined,
) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType,
    ...preferences,
  };
}

function normalizeNotificationPreferencePayload(
  preferences: Omit<NotificationPreferences, "lastUpdatedAt">,
) {
  return {
    warningPushEnabled: preferences.warningPushEnabled,
    warningLocalEnabled: preferences.warningLocalEnabled,
    recoveryPushEnabled: preferences.recoveryPushEnabled,
    nonCriticalByType: normalizeRoutineTypePreferences(preferences.nonCriticalByType),
    quietHoursStart: normalizeQuietHoursPreference(preferences.quietHoursStart),
    quietHoursEnd: normalizeQuietHoursPreference(preferences.quietHoursEnd),
  };
}

export type NotificationInboxSyncResult = {
  incidents: NotificationIncidentRecord[];
  syncError: string | null;
};

export async function syncNotificationInbox(
  institutionName: string,
  options: { isOnline: boolean },
): Promise<NotificationInboxSyncResult> {
  let syncError: string | null = null;

  if (options.isOnline) {
    try {
      await refreshRemoteNotificationInboxCache(institutionName);
    } catch (error) {
      syncError = normalizeSyncErrorMessage(error);
    }
  }

  return {
    incidents: await loadMergedNotificationInbox(institutionName),
    syncError,
  };
}

export async function syncNotificationPreferences(options: { isOnline: boolean }) {
  const localPreferences = await getNotificationPreferences();

  if (!options.isOnline) {
    return localPreferences;
  }

  try {
    const convex = getConvexClient();
    const remote = await convex.query((api as any).notifications.getNotificationPreferences, {});

    if (!remote) {
      return localPreferences;
    }

    return await saveNotificationPreferences({
      warningPushEnabled: Boolean(remote.warningPushEnabled),
      warningLocalEnabled: Boolean(remote.warningLocalEnabled),
      recoveryPushEnabled: Boolean(remote.recoveryPushEnabled),
      nonCriticalByType:
        remote.nonCriticalByType === undefined
          ? localPreferences.nonCriticalByType
          : normalizeRoutineTypePreferences(remote.nonCriticalByType),
      quietHoursStart: remote.quietHoursStart ?? null,
      quietHoursEnd: remote.quietHoursEnd ?? null,
    });
  } catch {
    return localPreferences;
  }
}

export async function updateNotificationPreferencesWithSync(
  nextPreferences: Omit<NotificationPreferences, "lastUpdatedAt">,
  options: { isOnline: boolean },
) {
  const saved = await saveNotificationPreferences(nextPreferences);
  const mutationPayload = normalizeNotificationPreferencePayload(nextPreferences);

  if (!options.isOnline) {
    await enqueueSyncJob("update_notification_preferences", mutationPayload);
    return saved;
  }

  const convex = getConvexClient();
  await runUpdateNotificationPreferencesMutation(convex, mutationPayload);
  return saved;
}

export async function markNotificationReadWithSync(incidentId: string, options: { isOnline: boolean }) {
  await markNotificationRead(incidentId);

  if (!isConvexId(incidentId)) return;

  if (!options.isOnline) {
    await enqueueSyncJob("mark_notification_read", { incidentId });
    return;
  }

  const convex = getConvexClient();
  await convex.mutation((api as any).notifications.markIncidentRead, { incidentId });
}

export async function archiveNotificationWithSync(incidentId: string, options: { isOnline: boolean }) {
  await archiveNotification(incidentId);

  if (!isConvexId(incidentId)) return;

  if (!options.isOnline) {
    await enqueueSyncJob("archive_notification", { incidentId });
    return;
  }

  const convex = getConvexClient();
  await convex.mutation((api as any).notifications.archiveIncident, { incidentId });
}

export async function acknowledgeIncidentWithSync(
  incidentId: string,
  institutionName: string,
  options: { isOnline: boolean },
) {
  await saveLocalIncidentSnapshot(incidentId, institutionName, (incident, now) => ({
    ...incident,
    acknowledgedAt: now,
    resolvedAt: null,
    status: "acknowledged",
  }));

  if (!isConvexId(incidentId)) {
    return await syncNotificationInbox(institutionName, options);
  }

  if (!options.isOnline) {
    await enqueueSyncJob("acknowledge_incident", { incidentId });
    return await syncNotificationInbox(institutionName, options);
  }

  const convex = getConvexClient();
  await convex.mutation((api as any).notifications.acknowledgeIncident, { incidentId });
  return await syncNotificationInbox(institutionName, options);
}

export async function resolveIncidentWithSync(
  incidentId: string,
  institutionName: string,
  options: { isOnline: boolean },
) {
  await saveLocalIncidentSnapshot(incidentId, institutionName, (incident, now) => ({
    ...incident,
    resolvedAt: now,
    status: "resolved",
  }));

  if (!isConvexId(incidentId)) {
    return await syncNotificationInbox(institutionName, options);
  }

  if (!options.isOnline) {
    await enqueueSyncJob("resolve_incident", { incidentId });
    return await syncNotificationInbox(institutionName, options);
  }

  const convex = getConvexClient();
  await convex.mutation((api as any).notifications.resolveIncident, { incidentId });
  return await syncNotificationInbox(institutionName, options);
}

export async function getIncidentDetail(incidentId: string, institutionName: string, options: { isOnline: boolean }) {
  const local =
    (await getNotificationById(incidentId)) ??
    (await loadLocalDerivedNotifications(institutionName)).find((incident) => incident.id === incidentId) ??
    null;

  if (!options.isOnline || !isConvexId(incidentId)) {
    return local;
  }

  try {
    const convex = getConvexClient();
    const remote = (await convex.query((api as any).notifications.getIncidentDetail, {
      incidentId,
    })) as RemoteIncidentDetail | null;

    if (!remote) {
      return local;
    }

    const mapped = mapRemoteInboxItem(remote, institutionName, remote.events);
    await saveNotificationCache([mapped]);
    return mapped;
  } catch {
    return local;
  }
}

export async function flushPendingNotificationSyncJobs(options: {
  institutionName: string;
  isOnline: boolean;
}) {
  if (!options.isOnline) return;

  const jobs = await listPendingSyncJobs([
    "acknowledge_incident",
    "archive_notification",
    "mark_notification_read",
    "register_push_device",
    "resolve_incident",
    "update_notification_preferences",
  ]);

  for (const job of jobs) {
    await processSyncJob(job);
  }

  await syncNotificationInbox(options.institutionName, options);
}

async function processSyncJob(job: SyncJobRecord) {
  // Drop sync jobs that reference local-only incident IDs — they can never succeed on the server.
  const incidentJobTypes: SyncJobType[] = [
    "mark_notification_read",
    "archive_notification",
    "acknowledge_incident",
    "resolve_incident",
  ];
  if (incidentJobTypes.includes(job.jobType as SyncJobType) && !isConvexId((job.payload as Record<string, string>)?.incidentId ?? "")) {
    await deleteSyncJob(job.id);
    return;
  }

  await setSyncJobStatus(job.id, "processing");
  const convex = getConvexClient();

  try {
    switch (job.jobType as SyncJobType) {
      case "mark_notification_read":
        await convex.mutation((api as any).notifications.markIncidentRead, job.payload);
        break;
      case "archive_notification":
        await convex.mutation((api as any).notifications.archiveIncident, job.payload);
        break;
      case "acknowledge_incident":
        await convex.mutation((api as any).notifications.acknowledgeIncident, job.payload);
        break;
      case "resolve_incident":
        await convex.mutation((api as any).notifications.resolveIncident, job.payload);
        break;
      case "update_notification_preferences":
        await runUpdateNotificationPreferencesMutation(
          convex,
          normalizeNotificationPreferencePayload(job.payload as Omit<NotificationPreferences, "lastUpdatedAt">),
        );
        break;
      case "register_push_device":
        await convex.mutation((api as any).notifications.registerPushDevice, job.payload);
        break;
    }

    await deleteSyncJob(job.id);
  } catch (error) {
    if (job.jobType === "register_push_device" && isPushTokenConflictError(error)) {
      console.error("Dropping push registration sync job after token ownership conflict.", {
        jobId: job.id,
        payload: job.payload,
      });
      await deleteSyncJob(job.id);
      return;
    }
    await setSyncJobStatus(job.id, "pending");
  }
}

async function refreshRemoteNotificationInboxCache(institutionName: string) {
  const convex = getConvexClient();
  const items = (await convex.query((api as any).notifications.listInbox, {
    limit: 50,
    statusFilter: "all",
  })) as RemoteInboxItem[] | undefined;

  const mapped = (items ?? []).map((item) => mapRemoteInboxItem(item, institutionName));
  await replaceNotificationCacheForInstitution(institutionName, mapped);
}

async function runUpdateNotificationPreferencesMutation(
  convex: ReturnType<typeof getConvexClient>,
  payload: ReturnType<typeof normalizeNotificationPreferencePayload>,
) {
  try {
    await convex.mutation((api as any).notifications.updateNotificationPreferences, payload);
  } catch (error) {
    if (!isLegacyNotificationPreferenceValidatorError(error)) {
      throw error;
    }

    const { nonCriticalByType: _ignored, ...legacyPayload } = payload;
    await convex.mutation((api as any).notifications.updateNotificationPreferences, legacyPayload);
  }
}

async function loadMergedNotificationInbox(institutionName: string) {
  const [remoteCached, localDerived] = await Promise.all([
    listNotificationsForInstitution(institutionName),
    loadLocalDerivedNotifications(institutionName),
  ]);

  return mergeNotificationIncidents(remoteCached, localDerived);
}

async function loadLocalDerivedNotifications(institutionName: string) {
  const devices = await getDevicesForInstitution(institutionName);
  const derived = buildNotificationIncidentsFromDevices(institutionName, devices);
  const stateByIncidentId = await listNotificationStateForIncidentIds(derived.map((incident) => incident.id));

  return derived
    .map((incident) => {
      const state = stateByIncidentId.get(incident.id);
      if (!state) return incident;

      return {
        ...incident,
        readAt: state.readAt,
        archivedAt: state.archivedAt,
        lastViewedVersion: state.lastViewedVersion,
      };
    })
    .filter((incident) => !incident.archivedAt);
}

function normalizeSyncErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Unable to sync notifications.";
}

function mergeNotificationIncidents(
  remoteIncidents: NotificationIncidentRecord[],
  localDerivedIncidents: NotificationIncidentRecord[],
) {
  const merged = new Map<string, NotificationIncidentRecord>();

  for (const incident of localDerivedIncidents) {
    merged.set(getNotificationIdentityKey(incident), incident);
  }

  for (const incident of remoteIncidents) {
    const key = getNotificationIdentityKey(incident);
    const localDerived = merged.get(key);

    if (localDerived && !isConvexId(incident.id)) {
      merged.set(key, mergeCachedLocalIncident(incident, localDerived));
      continue;
    }

    merged.set(key, incident);
  }

  return Array.from(merged.values()).sort(sortNotificationIncidents);
}

function mergeCachedLocalIncident(
  cachedIncident: NotificationIncidentRecord,
  localDerivedIncident: NotificationIncidentRecord,
) {
  if (cachedIncident.status === "resolved") {
    const resolvedAt = cachedIncident.resolvedAt ?? 0;
    if (localDerivedIncident.lastTriggeredAt > resolvedAt) {
      return localDerivedIncident;
    }
  }

  return {
    ...localDerivedIncident,
    status: cachedIncident.status,
    acknowledgedAt: cachedIncident.acknowledgedAt,
    resolvedAt: cachedIncident.resolvedAt,
    readAt: cachedIncident.readAt,
    archivedAt: cachedIncident.archivedAt,
    lastViewedVersion: cachedIncident.lastViewedVersion,
    timeline: cachedIncident.timeline.length > 0 ? cachedIncident.timeline : localDerivedIncident.timeline,
  };
}

function getNotificationIdentityKey(incident: Pick<NotificationIncidentRecord, "deviceId" | "incidentType">) {
  return `${incident.deviceId}:${incident.incidentType}`;
}

function sortNotificationIncidents(a: NotificationIncidentRecord, b: NotificationIncidentRecord) {
  if (a.status === "resolved" && b.status !== "resolved") return 1;
  if (a.status !== "resolved" && b.status === "resolved") return -1;
  return getNotificationSortTime(b) - getNotificationSortTime(a);
}

function mapRemoteInboxItem(
  item: RemoteInboxItem,
  institutionName: string,
  events?: RemoteIncidentDetail["events"],
): NotificationIncidentRecord {
  return {
    id: item.incidentId ?? item._id ?? `${item.deviceId}:${item.incidentType}`,
    institutionName: item.institutionName ?? institutionName,
    deviceId: item.deviceId,
    deviceNickname: item.deviceNickname,
    incidentType: item.incidentType,
    severity: item.severity,
    status: item.status,
    title: item.title,
    body: item.body,
    firstTriggeredAt: item.firstTriggeredAt,
    lastTriggeredAt: item.lastTriggeredAt,
    acknowledgedAt: item.acknowledgedAt ?? null,
    resolvedAt: item.resolvedAt ?? null,
    readAt: item.userState?.readAt ?? item.readAt ?? null,
    archivedAt: item.userState?.archivedAt ?? null,
    lastViewedVersion: item.userState?.lastViewedVersion ?? 0,
    timeline: mapRemoteEvents(events, item),
  };
}

function mapRemoteEvents(events: RemoteIncidentDetail["events"], item: RemoteInboxItem): NotificationTimelineEvent[] {
  if (!events?.length) {
    return [
      {
        id: `${item.incidentId ?? item._id ?? item.deviceId}-opened`,
        type: "opened",
        createdAt: item.firstTriggeredAt,
        actorLabel: null,
        summary: item.title,
      },
    ];
  }

  return events.map((event) => ({
    id: event._id ?? `${item.incidentId ?? item._id ?? item.deviceId}-${event.eventType}-${event.createdAt}`,
    type: event.eventType,
    createdAt: event.createdAt,
    actorLabel: event.actorLabel ?? null,
    summary: event.summary ?? item.title,
  }));
}

async function saveLocalIncidentSnapshot(
  incidentId: string,
  institutionName: string,
  buildNextIncident: (
    incident: NotificationIncidentRecord,
    now: number,
  ) => NotificationIncidentRecord,
) {
  const existing =
    (await getNotificationById(incidentId)) ??
    (await loadLocalDerivedNotifications(institutionName)).find((incident) => incident.id === incidentId) ??
    null;

  if (!existing) return;

  const now = Date.now();
  await saveNotificationCache([buildNextIncident(existing, now)]);
}

export const __testing = {
  getNotificationIdentityKey,
  isLegacyNotificationPreferenceValidatorError,
  mergeCachedLocalIncident,
  mergeNotificationIncidents,
  normalizeNotificationPreferencePayload,
  normalizeSyncErrorMessage,
  normalizeQuietHoursPreference,
  normalizeRoutineTypePreferences,
  sortNotificationIncidents,
};
