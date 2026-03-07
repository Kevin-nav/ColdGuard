import { type DeviceRecord } from "../../../lib/storage/sqlite/device-repository";
import { type NotificationIncidentRecord } from "../types";

const DOOR_WARNING_MS = 2 * 60_000;
const DOOR_CRITICAL_MS = 5 * 60_000;
const OFFLINE_WARNING_MS = 10 * 60_000;
const OFFLINE_CRITICAL_MS = 30 * 60_000;
const BATTERY_WARNING_LEVEL = 20;
const BATTERY_CRITICAL_LEVEL = 10;

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

    if (device.doorOpen && timeSinceLastSeen >= DOOR_WARNING_MS) {
      const severity = timeSinceLastSeen >= DOOR_CRITICAL_MS ? "critical" : "warning";
      incidents.push(
        createIncidentBase(institutionName, device, {
          incidentType: "door_open",
          severity,
          status: "open",
          title: severity === "critical" ? "Door remains open" : "Door open warning",
          body:
            severity === "critical"
              ? `${device.nickname} has been left open long enough to threaten cold-chain safety.`
              : `${device.nickname} door is still open and should be checked.`,
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

    if (device.batteryLevel < BATTERY_WARNING_LEVEL) {
      incidents.push(
        createIncidentBase(institutionName, device, {
          incidentType: "battery_low",
          severity: device.batteryLevel < BATTERY_CRITICAL_LEVEL ? "critical" : "warning",
          status: "open",
          title: device.batteryLevel < BATTERY_CRITICAL_LEVEL ? "Battery critically low" : "Battery low warning",
          body:
            device.batteryLevel < BATTERY_CRITICAL_LEVEL
              ? `${device.nickname} battery is below 10%.`
              : `${device.nickname} battery needs attention soon.`,
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
