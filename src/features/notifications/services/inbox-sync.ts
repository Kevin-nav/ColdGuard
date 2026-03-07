import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "../../../lib/convex/client";
import { getDevicesForInstitution } from "../../../lib/storage/sqlite/device-repository";
import {
  archiveNotification,
  getNotificationById,
  getNotificationPreferences,
  listNotificationsForInstitution,
  markNotificationRead,
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
import type { NotificationIncidentRecord, NotificationPreferences, NotificationTimelineEvent } from "../types";

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

export async function syncNotificationInbox(institutionName: string, options: { isOnline: boolean }) {
  if (!options.isOnline) {
    await seedNotificationsFromLocalDevices(institutionName);
    return await listNotificationsForInstitution(institutionName);
  }

  try {
    const convex = getConvexClient();
    const items = (await convex.query((api as any).notifications.listInbox, {
      limit: 50,
      statusFilter: "all",
    })) as RemoteInboxItem[] | undefined;

    if (!items?.length) {
      await seedNotificationsFromLocalDevices(institutionName);
      return await listNotificationsForInstitution(institutionName);
    }

    await saveNotificationCache(items.map((item) => mapRemoteInboxItem(item, institutionName)));
    return await listNotificationsForInstitution(institutionName);
  } catch {
    await seedNotificationsFromLocalDevices(institutionName);
    return await listNotificationsForInstitution(institutionName);
  }
}

export async function syncNotificationPreferences(options: { isOnline: boolean }) {
  if (!options.isOnline) {
    return await getNotificationPreferences();
  }

  try {
    const convex = getConvexClient();
    const remote = await convex.query((api as any).notifications.getNotificationPreferences, {});

    if (!remote) {
      return await getNotificationPreferences();
    }

    return await saveNotificationPreferences({
      warningPushEnabled: Boolean(remote.warningPushEnabled),
      warningLocalEnabled: Boolean(remote.warningLocalEnabled),
      recoveryPushEnabled: Boolean(remote.recoveryPushEnabled),
      quietHoursStart: remote.quietHoursStart ?? null,
      quietHoursEnd: remote.quietHoursEnd ?? null,
    });
  } catch {
    return await getNotificationPreferences();
  }
}

export async function updateNotificationPreferencesWithSync(
  nextPreferences: Omit<NotificationPreferences, "lastUpdatedAt">,
  options: { isOnline: boolean },
) {
  const saved = await saveNotificationPreferences(nextPreferences);

  if (!options.isOnline) {
    await enqueueSyncJob("update_notification_preferences", nextPreferences);
    return saved;
  }

  const convex = getConvexClient();
  await convex.mutation((api as any).notifications.updateNotificationPreferences, nextPreferences);
  return saved;
}

export async function markNotificationReadWithSync(incidentId: string, options: { isOnline: boolean }) {
  await markNotificationRead(incidentId);

  if (!options.isOnline) {
    await enqueueSyncJob("mark_notification_read", { incidentId });
    return;
  }

  const convex = getConvexClient();
  await convex.mutation((api as any).notifications.markIncidentRead, { incidentId });
}

export async function archiveNotificationWithSync(incidentId: string, options: { isOnline: boolean }) {
  await archiveNotification(incidentId);

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
  const existing = await getNotificationById(incidentId);
  if (existing) {
    await saveNotificationCache([
      {
        ...existing,
        acknowledgedAt: Date.now(),
        status: "acknowledged",
      },
    ]);
  }

  if (!options.isOnline) {
    await enqueueSyncJob("acknowledge_incident", { incidentId });
    return await listNotificationsForInstitution(institutionName);
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
  const existing = await getNotificationById(incidentId);
  if (existing) {
    await saveNotificationCache([
      {
        ...existing,
        resolvedAt: Date.now(),
        status: "resolved",
      },
    ]);
  }

  if (!options.isOnline) {
    await enqueueSyncJob("resolve_incident", { incidentId });
    return await listNotificationsForInstitution(institutionName);
  }

  const convex = getConvexClient();
  await convex.mutation((api as any).notifications.resolveIncident, { incidentId });
  return await syncNotificationInbox(institutionName, options);
}

export async function getIncidentDetail(incidentId: string, institutionName: string, options: { isOnline: boolean }) {
  const local = await getNotificationById(incidentId);

  if (!options.isOnline) {
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
        await convex.mutation((api as any).notifications.updateNotificationPreferences, job.payload);
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

async function seedNotificationsFromLocalDevices(institutionName: string) {
  const devices = await getDevicesForInstitution(institutionName);
  const fallback = buildNotificationIncidentsFromDevices(institutionName, devices);
  if (fallback.length > 0) {
    await saveNotificationCache(fallback);
  }
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
