import { initializeSQLite } from "./client";

export type ReadingRecord = {
  id: string;
  institutionName: string;
  deviceId: string;
  tempC: number;
  mktC: number;
  doorOpen: boolean;
  recordedAt: number;
  sessionId: string | null;
};

type ReadingRow = {
  id: string;
  institution_name: string;
  device_id: string;
  temp_c: number;
  mkt_c: number;
  door_open: number;
  recorded_at: number;
  session_id: string | null;
};

export async function saveReadings(readings: ReadingRecord[]) {
  const database = await initializeSQLite();

  for (const reading of readings) {
    await database.runAsync(
      `
        INSERT OR REPLACE INTO readings
        (id, institution_name, device_id, temp_c, mkt_c, door_open, recorded_at, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      reading.id,
      reading.institutionName,
      reading.deviceId,
      reading.tempC,
      reading.mktC,
      reading.doorOpen ? 1 : 0,
      reading.recordedAt,
      reading.sessionId,
    );
  }
}

export async function getRecentReadingsForInstitution(
  institutionName: string,
  limit = 12,
): Promise<ReadingRecord[]> {
  const database = await initializeSQLite();
  const rows = await database.getAllAsync<ReadingRow>(
    `
      SELECT id, institution_name, device_id, temp_c, mkt_c, door_open, recorded_at, session_id
      FROM readings
      WHERE institution_name = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `,
    institutionName,
    limit,
  );

  return rows.map((row) => ({
    id: row.id,
    institutionName: row.institution_name,
    deviceId: row.device_id,
    tempC: row.temp_c,
    mktC: row.mkt_c,
    doorOpen: row.door_open === 1,
    recordedAt: row.recorded_at,
    sessionId: row.session_id,
  }));
}
