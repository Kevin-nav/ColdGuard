import {
  getDevicesForInstitution,
  saveDevicesForInstitution,
} from "../../../lib/storage/sqlite/device-repository";
import { ReadingRecord, saveReadings } from "../../../lib/storage/sqlite/reading-repository";

type LegacySeedDevice = {
  currentTempC: number;
  id: string;
  lastSeenAt: number;
  macAddress: string;
  mktStatus: "safe" | "warning" | "alert";
  nickname: string;
  recordedAt: number;
  rtcIso: string | null;
  sdCardMounted: boolean;
  timeSource: "rtc" | "fallback" | "unknown";
};

function makeSeedDevices(institutionName: string): LegacySeedDevice[] {
  const now = Date.now();

  return [
    {
      id: `${institutionName}-device-1`,
      nickname: "Cold Room Alpha",
      macAddress: "AA:BB:CC:DD:01",
      currentTempC: 4.6,
      mktStatus: "safe",
      lastSeenAt: now - 60_000,
      recordedAt: now - 60_000,
      rtcIso: new Date(now - 60_000).toISOString(),
      sdCardMounted: true,
      timeSource: "rtc",
    },
    {
      id: `${institutionName}-device-2`,
      nickname: "Outreach Carrier 7",
      macAddress: "AA:BB:CC:DD:02",
      currentTempC: 8.7,
      mktStatus: "warning",
      lastSeenAt: now - 120_000,
      recordedAt: now - 120_000,
      rtcIso: new Date(now - 120_000).toISOString(),
      sdCardMounted: true,
      timeSource: "rtc",
    },
    {
      id: `${institutionName}-device-3`,
      nickname: "Maternity Fridge",
      macAddress: "AA:BB:CC:DD:03",
      currentTempC: 10.9,
      mktStatus: "alert",
      lastSeenAt: now - 300_000,
      recordedAt: now - 300_000,
      rtcIso: new Date(now - 300_000).toISOString(),
      sdCardMounted: false,
      timeSource: "fallback",
    },
  ];
}

function makeSeedReadings(
  institutionName: string,
  devices: LegacySeedDevice[],
): ReadingRecord[] {
  const now = Date.now();

  return devices.flatMap((device, index) => [
    {
      id: `${device.id}-reading-1`,
      institutionName,
      deviceId: device.id,
      currentTempC: device.currentTempC,
      mktStatus: device.mktStatus,
      recordedAt: now - index * 120_000,
      rtcIso: device.rtcIso,
      sdCardMounted: device.sdCardMounted,
      sequence: index * 2 + 1,
      timeSource: device.timeSource,
    },
    {
      id: `${device.id}-reading-2`,
      institutionName,
      deviceId: device.id,
      currentTempC: device.currentTempC - 0.4,
      mktStatus: device.mktStatus,
      recordedAt: now - index * 180_000 - 60_000,
      rtcIso: device.rtcIso,
      sdCardMounted: device.sdCardMounted,
      sequence: index * 2 + 2,
      timeSource: device.timeSource,
    },
  ]);
}

export async function seedDashboardDataForInstitution(args: {
  institutionId: string;
  institutionName: string;
}) {
  const existingDevices = await getDevicesForInstitution(args.institutionId);
  if (existingDevices.length > 0) {
    return existingDevices;
  }

  const devices = makeSeedDevices(args.institutionName);
  await saveDevicesForInstitution(
    args.institutionId,
    devices.map((device) => ({
      ...device,
      firmwareVersion: "seed-fw-1.0.0",
      protocolVersion: 1,
      status: "enrolled" as const,
      grantVersion: 1,
      accessRole: "manager" as const,
      primaryAssigneeName: null,
      primaryAssigneeStaffId: null,
      viewerNames: [],
      lastConnectionTestAt: null,
      lastConnectionTestStatus: "idle" as const,
    })),
    args.institutionName,
  );
  await saveReadings(makeSeedReadings(args.institutionName, devices));
  return await getDevicesForInstitution(args.institutionId);
}
