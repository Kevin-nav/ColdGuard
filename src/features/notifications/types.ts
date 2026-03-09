export type NotificationIncidentType =
  | "temperature"
  | "door_open"
  | "device_offline"
  | "battery_low";

export type NotificationSeverity = "warning" | "critical";

export type NotificationStatus = "open" | "acknowledged" | "resolved";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

export type NotificationTimelineEventType =
  | "opened"
  | "reopened"
  | "updated"
  | "escalated"
  | "acknowledged"
  | "resolved";

export type NotificationRoutinePreferenceMap = Record<NotificationIncidentType, boolean>;

export type NotificationPreferences = {
  warningPushEnabled: boolean;
  warningLocalEnabled: boolean;
  recoveryPushEnabled: boolean;
  nonCriticalByType: NotificationRoutinePreferenceMap;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  lastUpdatedAt: number;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  warningPushEnabled: true,
  warningLocalEnabled: true,
  recoveryPushEnabled: true,
  nonCriticalByType: {
    temperature: true,
    door_open: true,
    device_offline: true,
    battery_low: true,
  },
  quietHoursStart: null,
  quietHoursEnd: null,
  lastUpdatedAt: 0,
};

export type NotificationTimelineEvent = {
  id: string;
  type: NotificationTimelineEventType;
  createdAt: number;
  actorLabel: string | null;
  summary: string;
};

export type NotificationIncidentRecord = {
  id: string;
  institutionName: string;
  deviceId: string;
  deviceNickname: string;
  incidentType: NotificationIncidentType;
  severity: NotificationSeverity;
  status: NotificationStatus;
  title: string;
  body: string;
  firstTriggeredAt: number;
  lastTriggeredAt: number;
  acknowledgedAt: number | null;
  resolvedAt: number | null;
  readAt: number | null;
  archivedAt: number | null;
  lastViewedVersion: number;
  timeline: NotificationTimelineEvent[];
};

export function getNotificationSortTime(incident: NotificationIncidentRecord) {
  return incident.status === "resolved"
    ? incident.resolvedAt ?? incident.lastTriggeredAt
    : incident.lastTriggeredAt;
}

export function getNotificationSeverityColorKey(severity: NotificationSeverity) {
  return severity === "critical" ? "danger" : "warning";
}

export function formatNotificationTypeLabel(type: NotificationIncidentType) {
  switch (type) {
    case "temperature":
      return "Temperature";
    case "door_open":
      return "Door Open";
    case "device_offline":
      return "Offline";
    case "battery_low":
      return "Low Battery";
  }
}
