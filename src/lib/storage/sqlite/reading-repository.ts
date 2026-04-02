import { initializeSQLite } from "./client";
import type { DeviceTelemetryReadingRecord } from "../../../features/devices/types";

export type ReadingRecord = DeviceTelemetryReadingRecord;

type ReadingRow = {
  current_temp_c: number;
  device_id: string;
  id: string;
  institution_name: string;
  mkt_status: ReadingRecord["mktStatus"];
  recorded_at: number;
  rtc_iso: string | null;
  sd_card_mounted: number;
  sequence: number;
  time_source: ReadingRecord["timeSource"];
};

function normalizeReadingId(reading: ReadingRecord) {
  return reading.id || `${reading.deviceId}:${reading.sequence}`;
}

export async function saveReadings(readings: ReadingRecord[]) {
  if (readings.length === 0) {
    return;
  }

  const database = await initializeSQLite();

  for (const reading of readings) {
    await database.runAsync(
      `
        INSERT OR REPLACE INTO readings
        (
          id, institution_name, device_id, sequence, recorded_at, rtc_iso, time_source, current_temp_c, mkt_status,
          sd_card_mounted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      normalizeReadingId(reading),
      reading.institutionName,
      reading.deviceId,
      reading.sequence,
      reading.recordedAt,
      reading.rtcIso,
      reading.timeSource,
      reading.currentTempC,
      reading.mktStatus,
      0,
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
      SELECT
        id, institution_name, device_id, sequence, recorded_at, rtc_iso, time_source, current_temp_c, mkt_status,
        sd_card_mounted
      FROM readings
      WHERE institution_name = ?
      ORDER BY recorded_at DESC, sequence DESC
      LIMIT ?
    `,
    institutionName,
    limit,
  );

  return rows.map(mapReadingRow);
}

export async function getReadingsAfterSequenceForDevice(
  deviceId: string,
  afterSequence: number,
  limit = 100,
): Promise<ReadingRecord[]> {
  const database = await initializeSQLite();
  const rows = await database.getAllAsync<ReadingRow>(
    `
      SELECT
        id, institution_name, device_id, sequence, recorded_at, rtc_iso, time_source, current_temp_c, mkt_status,
        sd_card_mounted
      FROM readings
      WHERE device_id = ?
        AND sequence > ?
      ORDER BY sequence ASC
      LIMIT ?
    `,
    deviceId,
    afterSequence,
    limit,
  );

  return rows.map(mapReadingRow);
}

export async function getLatestReadingForDevice(deviceId: string): Promise<ReadingRecord | null> {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<ReadingRow>(
    `
      SELECT
        id, institution_name, device_id, sequence, recorded_at, rtc_iso, time_source, current_temp_c, mkt_status,
        sd_card_mounted
      FROM readings
      WHERE device_id = ?
      ORDER BY sequence DESC
      LIMIT 1
    `,
    deviceId,
  );

  return row ? mapReadingRow(row) : null;
}

function mapReadingRow(row: ReadingRow): ReadingRecord {
  return {
    currentTempC: row.current_temp_c,
    deviceId: row.device_id,
    id: row.id,
    institutionName: row.institution_name,
    mktStatus: row.mkt_status,
    recordedAt: row.recorded_at,
    rtcIso: row.rtc_iso,
    sdCardMounted: false,
    sequence: row.sequence,
    timeSource: row.time_source,
  };
}
