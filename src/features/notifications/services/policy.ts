import type { DeviceRecord } from "../../../lib/storage/sqlite/device-repository";
import type { NotificationIncidentRecord, NotificationIncidentType, NotificationSeverity } from "../types";

const DOOR_OPEN_WARNING_MS = 2 * 60_000;
const DOOR_OPEN_CRITICAL_MS = 5 * 60_000;
const OFFLINE_WARNING_MS = 10 * 60_000;
const OFFLINE_CRITICAL_MS = 30 * 60_000;

type IncidentDefinition = {
  body: string;
  severity: NotificationSeverity;
  title: string;
  type: NotificationIncidentType;
};

export function buildNotificationIncidentsFromDevices(
  institutionName: string,
  devices: DeviceRecord[],
  now = Date.now(),
) {
  return devices
    .flatMap((device) => buildIncidentsForDevice(institutionName, device, now))
    .sort((a, b) => b.lastTriggeredAt - a.lastTriggeredAt);
}

export function buildIncidentsForDevice(
  institutionName: string,
  device: DeviceRecord,
  now = Date.now(),
): NotificationIncidentRecord[] {
  const definitions = getIncidentDefinitions(device, now);

  return definitions.map((definition, index) => ({
    id: `${device.id}:${definition.type}`,
    institutionName,
    deviceId: device.id,
    deviceNickname: device.nickname,
    incidentType: definition.type,
    severity: definition.severity,
    status: "open",
    title: definition.title,
    body: definition.body,
    firstTriggeredAt: device.lastSeenAt,
    lastTriggeredAt: device.lastSeenAt + index,
    acknowledgedAt: null,
    resolvedAt: null,
    readAt: null,
    archivedAt: null,
    lastViewedVersion: 0,
    timeline: [
      {
        id: `${device.id}:${definition.type}:opened`,
        type: "opened",
        createdAt: device.lastSeenAt,
        actorLabel: null,
        summary: definition.title,
      },
    ],
  }));
}

function getIncidentDefinitions(device: DeviceRecord, now: number): IncidentDefinition[] {
  const incidents: IncidentDefinition[] = [];

  if (device.mktStatus === "alert") {
    incidents.push({
      type: "temperature",
      severity: "critical",
      title: `${device.nickname} is above the safe temperature range`,
      body: `Current temperature is ${device.currentTempC.toFixed(1)} C. Immediate intervention is required.`,
    });
  } else if (device.mktStatus === "warning") {
    incidents.push({
      type: "temperature",
      severity: "warning",
      title: `${device.nickname} has a temperature excursion in progress`,
      body: `Current temperature is ${device.currentTempC.toFixed(1)} C. Monitor the unit closely.`,
    });
  }

  const elapsedSinceSeen = now - device.lastSeenAt;
  if (elapsedSinceSeen >= OFFLINE_CRITICAL_MS) {
    incidents.push({
      type: "device_offline",
      severity: "critical",
      title: `${device.nickname} has been offline for more than 30 minutes`,
      body: "ColdGuard has not received a fresh heartbeat. Check connectivity and power immediately.",
    });
  } else if (elapsedSinceSeen >= OFFLINE_WARNING_MS) {
    incidents.push({
      type: "device_offline",
      severity: "warning",
      title: `${device.nickname} has not checked in recently`,
      body: "The device appears offline. Confirm the mobile bridge or sensor connection.",
    });
  }

  if (device.doorOpen) {
    if (elapsedSinceSeen >= DOOR_OPEN_CRITICAL_MS) {
      incidents.push({
        type: "door_open",
        severity: "critical",
        title: `${device.nickname} has remained open too long`,
        body: "Door open duration has passed the critical threshold. Close the unit immediately.",
      });
    } else if (elapsedSinceSeen >= DOOR_OPEN_WARNING_MS) {
      incidents.push({
        type: "door_open",
        severity: "warning",
        title: `${device.nickname} door is still open`,
        body: "Door open duration has passed the warning threshold. Close the unit to protect stock.",
      });
    }
  }

  if (device.batteryLevel < 10) {
    incidents.push({
      type: "battery_low",
      severity: "critical",
      title: `${device.nickname} battery is critically low`,
      body: `Battery level is ${device.batteryLevel}%. Restore power or recharge the device immediately.`,
    });
  } else if (device.batteryLevel < 20) {
    incidents.push({
      type: "battery_low",
      severity: "warning",
      title: `${device.nickname} battery is running low`,
      body: `Battery level is ${device.batteryLevel}%. Plan to recharge the device soon.`,
    });
  }

  return dedupeIncidentDefinitions(incidents);
}

function dedupeIncidentDefinitions(incidents: IncidentDefinition[]) {
  const byType = new Map<NotificationIncidentType, IncidentDefinition>();

  for (const incident of incidents) {
    const existing = byType.get(incident.type);
    if (!existing || incident.severity === "critical") {
      byType.set(incident.type, incident);
    }
  }

  return Array.from(byType.values());
}
