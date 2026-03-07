import { initializeSQLite } from "./client";

export type DeviceRecord = {
  id: string;
  institutionName: string;
  nickname: string;
  macAddress: string;
  currentTempC: number;
  mktStatus: "safe" | "warning" | "alert";
  batteryLevel: number;
  doorOpen: boolean;
  lastSeenAt: number;
};

type DeviceRow = {
  id: string;
  institution_name: string;
  nickname: string;
  mac_address: string;
  current_temp_c: number;
  mkt_status: "safe" | "warning" | "alert";
  battery_level: number;
  door_open: number;
  last_seen_at: number;
};

export async function saveDevicesForInstitution(
  institutionName: string,
  devices: Omit<DeviceRecord, "institutionName">[],
) {
  const database = await initializeSQLite();
  await database.runAsync("DELETE FROM devices WHERE institution_name = ?", institutionName);

  for (const device of devices) {
    await database.runAsync(
      `
        INSERT INTO devices
        (id, institution_name, nickname, mac_address, current_temp_c, mkt_status, battery_level, door_open, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      device.id,
      institutionName,
      device.nickname,
      device.macAddress,
      device.currentTempC,
      device.mktStatus,
      device.batteryLevel,
      device.doorOpen ? 1 : 0,
      device.lastSeenAt,
    );
  }
}

export async function getDevicesForInstitution(institutionName: string): Promise<DeviceRecord[]> {
  const database = await initializeSQLite();
  const rows = await database.getAllAsync<DeviceRow>(
    `
      SELECT id, institution_name, nickname, mac_address, current_temp_c, mkt_status, battery_level, door_open, last_seen_at
      FROM devices
      WHERE institution_name = ?
      ORDER BY nickname ASC
    `,
    institutionName,
  );

  return rows.map((row) => ({
    id: row.id,
    institutionName: row.institution_name,
    nickname: row.nickname,
    macAddress: row.mac_address,
    currentTempC: row.current_temp_c,
    mktStatus: row.mkt_status,
    batteryLevel: row.battery_level,
    doorOpen: row.door_open === 1,
    lastSeenAt: row.last_seen_at,
  }));
}
