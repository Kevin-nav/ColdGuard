import * as Notifications from "expo-notifications";
import type { NotificationIncidentRecord, NotificationPermissionStatus, NotificationPreferences } from "../types";

let isConfigured = false;
const deliveredLocalNotificationKeys = new Set<string>();

export function configureLocalNotificationHandler() {
  if (isConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  isConfigured = true;
}

export async function getLocalNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED) {
    return "granted";
  }
  if (!permission.canAskAgain) {
    return "denied";
  }
  return "undetermined";
}

export async function requestLocalNotificationPermission(): Promise<NotificationPermissionStatus> {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED) {
    return "granted";
  }
  return permission.canAskAgain ? "undetermined" : "denied";
}

export async function mirrorNotificationsLocally(
  incidents: NotificationIncidentRecord[],
  preferences: NotificationPreferences,
) {
  for (const incident of incidents) {
    if (incident.status === "resolved") continue;
    if (incident.severity !== "warning" && incident.severity !== "critical") continue;
    if (incident.severity === "warning" && !preferences.warningLocalEnabled) continue;
    if (incident.severity === "warning" && !preferences.nonCriticalByType[incident.incidentType]) continue;

    const deliveryKey = `${incident.id}:${incident.lastTriggeredAt}:${incident.status}`;
    if (deliveredLocalNotificationKeys.has(deliveryKey)) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        body: incident.body,
        data: { incidentId: incident.id, route: `/incident/${incident.id}` },
        sound: incident.severity === "critical" ? "default" : undefined,
        title: incident.title,
      },
      trigger: null,
    });

    deliveredLocalNotificationKeys.add(deliveryKey);
  }
}
