import { api } from "../../../../convex/_generated/api";
import {
  getNotificationById,
  markNotificationRead,
  saveNotificationCache,
  upsertNotificationState,
} from "../../../lib/storage/sqlite/notification-repository";
import { getConvexClient } from "../../../lib/convex/client";
import { enqueueSyncJob } from "../../../lib/storage/sqlite/sync-job-repository";
import { emitNotificationStoreChanged } from "./notification-store-events";

export async function markIncidentReadAction(incidentId: string, isOnline: boolean) {
  await markNotificationRead(incidentId);

  if (isOnline) {
    try {
      const convex = getConvexClient();
      await convex.mutation((api as any).notifications.markIncidentRead, {
        incidentId,
      });
    } catch {
      await enqueueSyncJob("mark_notification_read", { incidentId });
    }
  } else {
    await enqueueSyncJob("mark_notification_read", { incidentId });
  }

  emitNotificationStoreChanged();
}

export async function acknowledgeIncidentAction(incidentId: string, isOnline: boolean) {
  const incident = await getNotificationById(incidentId);
  if (!incident) return;

  await saveNotificationCache([
    {
      ...incident,
      status: "acknowledged",
      acknowledgedAt: Date.now(),
    },
  ]);

  if (isOnline) {
    try {
      const convex = getConvexClient();
      await convex.mutation((api as any).notifications.acknowledgeIncident, {
        incidentId,
      });
    } catch {
      await enqueueSyncJob("acknowledge_incident", { incidentId });
    }
  } else {
    await enqueueSyncJob("acknowledge_incident", { incidentId });
  }

  emitNotificationStoreChanged();
}

export async function resolveIncidentAction(incidentId: string, isOnline: boolean) {
  const incident = await getNotificationById(incidentId);
  if (!incident) return;

  await saveNotificationCache([
    {
      ...incident,
      status: "resolved",
      resolvedAt: Date.now(),
    },
  ]);
  await upsertNotificationState(incidentId, {
    readAt: Date.now(),
  });

  if (isOnline) {
    try {
      const convex = getConvexClient();
      await convex.mutation((api as any).notifications.resolveIncident, {
        incidentId,
      });
    } catch {
      await enqueueSyncJob("resolve_incident", { incidentId });
    }
  } else {
    await enqueueSyncJob("resolve_incident", { incidentId });
  }

  emitNotificationStoreChanged();
}
