import { type DeviceRecord } from "../../../lib/storage/sqlite/device-repository";
import { type NotificationIncidentRecord } from "../types";

const OFFLINE_WARNING_MS = 10 * 60_000;
const OFFLINE_CRITICAL_MS = 30 * 60_000;

function createIncidentBase(
  institutionName: string,
  device: DeviceRecord,
  incident: Omit<NotificationIncidentRecord, "id" | "institutionName" | "deviceId" | "deviceNickname" | "timeline">,
): NotificationIncidentRecord {
  return {
    ...incident,
    id: `${device.id}-${incident.incidentType}`,
    institutionName,
    deviceId: device.id,
    deviceNickname: device.nickname,
    timeline: [],
  };
}

export function buildSeedNotificationsForDevices(institutionName: string, devices: DeviceRecord[]) {
  const now = Date.now();
  const incidents: NotificationIncidentRecord[] = [];

  for (const device of devices) {
    const timeSinceLastSeen = now - device.lastSeenAt;

    if (device.mktStatus === "warning" || device.mktStatus === "alert") {
      incidents.push(
        createIncidentBase(institutionName, device, {
          incidentType: "temperature",
          severity: device.mktStatus === "alert" ? "critical" : "warning",
          status: "open",
          title: device.mktStatus === "alert" ? "Temperature excursion critical" : "Temperature excursion warning",
          body:
            device.mktStatus === "alert"
              ? `${device.nickname} remains outside the safe range and needs intervention.`
              : `${device.nickname} is drifting outside the safe temperature range.`,
          firstTriggeredAt: device.lastSeenAt,
          lastTriggeredAt: device.lastSeenAt,
          acknowledgedAt: null,
          resolvedAt: null,
          readAt: null,
          archivedAt: null,
          lastViewedVersion: 0,
        }),
      );
    }

    if (timeSinceLastSeen >= OFFLINE_WARNING_MS) {
      incidents.push(
        createIncidentBase(institutionName, device, {
          incidentType: "device_offline",
          severity: timeSinceLastSeen >= OFFLINE_CRITICAL_MS ? "critical" : "warning",
          status: "open",
          title: timeSinceLastSeen >= OFFLINE_CRITICAL_MS ? "Device offline critical" : "Device offline warning",
          body:
            timeSinceLastSeen >= OFFLINE_CRITICAL_MS
              ? `${device.nickname} has not checked in for over 30 minutes.`
              : `${device.nickname} has not checked in recently.`,
          firstTriggeredAt: device.lastSeenAt,
          lastTriggeredAt: device.lastSeenAt,
          acknowledgedAt: null,
          resolvedAt: null,
          readAt: null,
          archivedAt: null,
          lastViewedVersion: 0,
        }),
      );
    }

  }

  return incidents;
}
