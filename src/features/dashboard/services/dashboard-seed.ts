import {
  DeviceRecord,
  getDevicesForInstitution,
  saveDevicesForInstitution,
} from "../../../lib/storage/sqlite/device-repository";
import { ReadingRecord, saveReadings } from "../../../lib/storage/sqlite/reading-repository";

function makeSeedDevices(institutionName: string): Omit<DeviceRecord, "institutionName">[] {
  const now = Date.now();

  return [
    {
      id: `${institutionName}-device-1`,
      nickname: "Cold Room Alpha",
      macAddress: "AA:BB:CC:DD:01",
      currentTempC: 4.6,
      mktStatus: "safe",
      batteryLevel: 93,
      doorOpen: false,
      lastSeenAt: now - 60_000,
    },
    {
      id: `${institutionName}-device-2`,
      nickname: "Outreach Carrier 7",
      macAddress: "AA:BB:CC:DD:02",
      currentTempC: 8.7,
      mktStatus: "warning",
      batteryLevel: 68,
      doorOpen: true,
      lastSeenAt: now - 120_000,
    },
    {
      id: `${institutionName}-device-3`,
      nickname: "Maternity Fridge",
      macAddress: "AA:BB:CC:DD:03",
      currentTempC: 10.9,
      mktStatus: "alert",
      batteryLevel: 38,
      doorOpen: false,
      lastSeenAt: now - 300_000,
    },
  ];
}

function makeSeedReadings(
  institutionName: string,
  devices: Omit<DeviceRecord, "institutionName">[],
): ReadingRecord[] {
  const now = Date.now();

  return devices.flatMap((device, index) => [
    {
      id: `${device.id}-reading-1`,
      institutionName,
      deviceId: device.id,
      tempC: device.currentTempC,
      mktC: index === 0 ? 5.1 : index === 1 ? 8.2 : 10.4,
      doorOpen: device.doorOpen,
      recordedAt: now - index * 120_000,
      sessionId: null,
    },
    {
      id: `${device.id}-reading-2`,
      institutionName,
      deviceId: device.id,
      tempC: device.currentTempC - 0.4,
      mktC: index === 0 ? 5 : index === 1 ? 7.9 : 10,
      doorOpen: false,
      recordedAt: now - index * 180_000 - 60_000,
      sessionId: null,
    },
  ]);
}

export async function seedDashboardDataForInstitution(institutionName: string) {
  const existingDevices = await getDevicesForInstitution(institutionName);
  if (existingDevices.length > 0) {
    return existingDevices;
  }

  const devices = makeSeedDevices(institutionName);
  await saveDevicesForInstitution(institutionName, devices);
  await saveReadings(makeSeedReadings(institutionName, devices));
  return await getDevicesForInstitution(institutionName);
}
