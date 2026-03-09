import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationIncidentRecord,
  type NotificationPreferences,
  type NotificationTimelineEvent,
} from "../../../features/notifications/types";
import { initializeSQLite } from "./client";

type NotificationRow = {
  incident_id: string;
  institution_name: string;
  device_id: string;
  device_nickname: string;
  incident_type: NotificationIncidentRecord["incidentType"];
  severity: NotificationIncidentRecord["severity"];
  status: NotificationIncidentRecord["status"];
  title: string;
  body: string;
  first_triggered_at: number;
  last_triggered_at: number;
  acknowledged_at: number | null;
  resolved_at: number | null;
  read_at: number | null;
  archived_at: number | null;
  last_viewed_version: number | null;
};

type NotificationPreferenceRow = {
  warning_push_enabled: number;
  warning_local_enabled: number;
  recovery_push_enabled: number;
  temperature_enabled: number | null;
  door_open_enabled: number | null;
  device_offline_enabled: number | null;
  battery_low_enabled: number | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  last_updated_at: number;
};

type NotificationStateRow = {
  incident_id: string;
  read_at: number | null;
  archived_at: number | null;
  last_viewed_version: number | null;
};

export async function saveNotificationCache(incidents: NotificationIncidentRecord[]) {
  if (incidents.length === 0) return;

  const database = await initializeSQLite();
  const now = Date.now();

  for (const incident of incidents) {
    await database.runAsync(
      `
        INSERT OR REPLACE INTO notification_cache
        (incident_id, institution_name, device_id, device_nickname, incident_type, severity, status, title, body, first_triggered_at, last_triggered_at, acknowledged_at, resolved_at, last_synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      incident.id,
      incident.institutionName,
      incident.deviceId,
      incident.deviceNickname,
      incident.incidentType,
      incident.severity,
      incident.status,
      incident.title,
      incident.body,
      incident.firstTriggeredAt,
      incident.lastTriggeredAt,
      incident.acknowledgedAt,
      incident.resolvedAt,
      now,
    );

    await database.runAsync(
      `
        INSERT OR IGNORE INTO notification_state_cache
        (incident_id, read_at, archived_at, last_viewed_version)
        VALUES (?, ?, ?, ?)
      `,
      incident.id,
      incident.readAt,
      incident.archivedAt,
      incident.lastViewedVersion,
    );
  }
}

export async function replaceNotificationCacheForInstitution(
  institutionName: string,
  incidents: NotificationIncidentRecord[],
) {
  const database = await initializeSQLite();
  await database.runAsync(
    "DELETE FROM notification_cache WHERE institution_name = ? AND instr(incident_id, ':') = 0",
    institutionName,
  );

  if (incidents.length === 0) return;

  await saveNotificationCache(incidents);
}

export async function listNotificationsForInstitution(
  institutionName: string,
  options: {
    includeArchived?: boolean;
    limit?: number;
  } = {},
): Promise<NotificationIncidentRecord[]> {
  const database = await initializeSQLite();
  const rows = await database.getAllAsync<NotificationRow>(
    `
      SELECT
        n.incident_id,
        n.institution_name,
        n.device_id,
        n.device_nickname,
        n.incident_type,
        n.severity,
        n.status,
        n.title,
        n.body,
        n.first_triggered_at,
        n.last_triggered_at,
        n.acknowledged_at,
        n.resolved_at,
        s.read_at,
        s.archived_at,
        s.last_viewed_version
      FROM notification_cache n
      LEFT JOIN notification_state_cache s ON s.incident_id = n.incident_id
      WHERE n.institution_name = ?
        AND (? = 1 OR s.archived_at IS NULL)
      ORDER BY
        CASE WHEN n.status = 'resolved' THEN 1 ELSE 0 END ASC,
        CASE
          WHEN n.status = 'resolved' THEN COALESCE(n.resolved_at, n.last_triggered_at)
          ELSE n.last_triggered_at
        END DESC
      LIMIT ?
    `,
    institutionName,
    options.includeArchived ? 1 : 0,
    options.limit ?? 100,
  );

  return rows.map(mapNotificationRow);
}

export async function getNotificationById(incidentId: string): Promise<NotificationIncidentRecord | null> {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<NotificationRow>(
    `
      SELECT
        n.incident_id,
        n.institution_name,
        n.device_id,
        n.device_nickname,
        n.incident_type,
        n.severity,
        n.status,
        n.title,
        n.body,
        n.first_triggered_at,
        n.last_triggered_at,
        n.acknowledged_at,
        n.resolved_at,
        s.read_at,
        s.archived_at,
        s.last_viewed_version
      FROM notification_cache n
      LEFT JOIN notification_state_cache s ON s.incident_id = n.incident_id
      WHERE n.incident_id = ?
    `,
    incidentId,
  );

  return row ? mapNotificationRow(row) : null;
}

export async function getUnreadNotificationCount(institutionName: string) {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<{ unread_count: number }>(
    `
      SELECT COUNT(*) AS unread_count
      FROM notification_cache n
      LEFT JOIN notification_state_cache s ON s.incident_id = n.incident_id
      WHERE n.institution_name = ?
        AND s.archived_at IS NULL
        AND s.read_at IS NULL
    `,
    institutionName,
  );

  return row?.unread_count ?? 0;
}

export async function markNotificationRead(incidentId: string) {
  return await upsertNotificationState(incidentId, {
    readAt: Date.now(),
  });
}

export async function archiveNotification(incidentId: string) {
  return await upsertNotificationState(incidentId, {
    archivedAt: Date.now(),
  });
}

export async function saveNotificationPreferences(snapshot: Omit<NotificationPreferences, "lastUpdatedAt">) {
  const database = await initializeSQLite();
  const now = Date.now();

  await database.runAsync(
    `
      INSERT OR REPLACE INTO notification_preferences_cache
      (id, warning_push_enabled, warning_local_enabled, recovery_push_enabled, quiet_hours_start, quiet_hours_end, last_updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?)
    `,
    snapshot.warningPushEnabled ? 1 : 0,
    snapshot.warningLocalEnabled ? 1 : 0,
    snapshot.recoveryPushEnabled ? 1 : 0,
    snapshot.quietHoursStart,
    snapshot.quietHoursEnd,
    now,
  );

  await database.runAsync(
    `
      INSERT OR REPLACE INTO notification_preference_type_cache
      (id, temperature_enabled, door_open_enabled, device_offline_enabled, battery_low_enabled)
      VALUES (1, ?, ?, ?, ?)
    `,
    snapshot.nonCriticalByType.temperature ? 1 : 0,
    snapshot.nonCriticalByType.door_open ? 1 : 0,
    snapshot.nonCriticalByType.device_offline ? 1 : 0,
    snapshot.nonCriticalByType.battery_low ? 1 : 0,
  );

  return {
    ...snapshot,
    lastUpdatedAt: now,
  };
}

export async function getNotificationPreferences() {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<NotificationPreferenceRow>(
    `
      SELECT
        warning_push_enabled,
        warning_local_enabled,
        recovery_push_enabled,
        temperature_enabled,
        door_open_enabled,
        device_offline_enabled,
        battery_low_enabled,
        quiet_hours_start,
        quiet_hours_end,
        last_updated_at
      FROM notification_preferences_cache p
      LEFT JOIN notification_preference_type_cache t ON t.id = p.id
      WHERE p.id = 1
    `,
  );

  if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    warningPushEnabled: row.warning_push_enabled === 1,
    warningLocalEnabled: row.warning_local_enabled === 1,
    recoveryPushEnabled: row.recovery_push_enabled === 1,
    nonCriticalByType: {
      temperature:
        row.temperature_enabled === null
          ? DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType.temperature
          : row.temperature_enabled === 1,
      door_open:
        row.door_open_enabled === null
          ? DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType.door_open
          : row.door_open_enabled === 1,
      device_offline:
        row.device_offline_enabled === null
          ? DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType.device_offline
          : row.device_offline_enabled === 1,
      battery_low:
        row.battery_low_enabled === null
          ? DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType.battery_low
          : row.battery_low_enabled === 1,
    },
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    lastUpdatedAt: row.last_updated_at,
  };
}

export async function listNotificationStateForIncidentIds(incidentIds: string[]) {
  if (incidentIds.length === 0) {
    return new Map<
      string,
      { archivedAt: number | null; lastViewedVersion: number; readAt: number | null }
    >();
  }

  const database = await initializeSQLite();
  const placeholders = incidentIds.map(() => "?").join(", ");
  const rows = await database.getAllAsync<NotificationStateRow>(
    `
      SELECT incident_id, read_at, archived_at, last_viewed_version
      FROM notification_state_cache
      WHERE incident_id IN (${placeholders})
    `,
    ...incidentIds,
  );

  return new Map(
    rows.map((row) => [
      row.incident_id,
      {
        readAt: row.read_at ?? null,
        archivedAt: row.archived_at ?? null,
        lastViewedVersion: row.last_viewed_version ?? 0,
      },
    ]),
  );
}

export async function upsertNotificationState(
  incidentId: string,
  patch: {
    archivedAt?: number | null;
    lastViewedVersion?: number;
    readAt?: number | null;
  },
) {
  const existing = await getNotificationById(incidentId);
  const database = await initializeSQLite();

  await database.runAsync(
    `
      INSERT OR REPLACE INTO notification_state_cache
      (incident_id, read_at, archived_at, last_viewed_version)
      VALUES (?, ?, ?, ?)
    `,
    incidentId,
    patch.readAt ?? existing?.readAt ?? null,
    patch.archivedAt ?? existing?.archivedAt ?? null,
    patch.lastViewedVersion ?? existing?.lastViewedVersion ?? 0,
  );
}

function mapNotificationRow(row: NotificationRow): NotificationIncidentRecord {
  return {
    id: row.incident_id,
    institutionName: row.institution_name,
    deviceId: row.device_id,
    deviceNickname: row.device_nickname,
    incidentType: row.incident_type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    body: row.body,
    firstTriggeredAt: row.first_triggered_at,
    lastTriggeredAt: row.last_triggered_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    readAt: row.read_at ?? null,
    archivedAt: row.archived_at ?? null,
    lastViewedVersion: row.last_viewed_version ?? 0,
    timeline: buildLocalTimeline(row),
  };
}

function buildLocalTimeline(row: NotificationRow): NotificationTimelineEvent[] {
  const timeline: NotificationTimelineEvent[] = [
    {
      id: `${row.incident_id}-opened`,
      type: "opened",
      createdAt: row.first_triggered_at,
      actorLabel: null,
      summary: row.title,
    },
  ];

  if (row.acknowledged_at) {
    timeline.push({
      id: `${row.incident_id}-acknowledged`,
      type: "acknowledged",
      createdAt: row.acknowledged_at,
      actorLabel: "ColdGuard operator",
      summary: "Incident acknowledged.",
    });
  }

  if (row.resolved_at) {
    timeline.push({
      id: `${row.incident_id}-resolved`,
      type: "resolved",
      createdAt: row.resolved_at,
      actorLabel: "ColdGuard operator",
      summary: "Incident resolved.",
    });
  }

  return timeline.sort((a, b) => a.createdAt - b.createdAt);
}
