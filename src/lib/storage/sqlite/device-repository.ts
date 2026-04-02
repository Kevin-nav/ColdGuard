import { initializeSQLite } from "./client";
import type { TelemetryTimeSource } from "../../../features/devices/types";

export type DeviceAccessRole = "manager" | "primary" | "viewer";
export type DeviceConnectionTestStatus = "idle" | "running" | "success" | "failed" | null;
export type DeviceConnectionSyncStatus = "idle" | "pending" | "failed" | "synced";
export type DeviceConnectionSyncFailureStage = "record_connection_test" | null;
export type DeviceStatus = "enrolled" | "decommissioned";
export type DeviceLocalAccessMode = "managed" | "quick_connect";

export type DeviceRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  nickname: string;
  firmwareVersion: string;
  protocolVersion: number;
  status: DeviceStatus;
  deviceStatus?: DeviceStatus;
  grantVersion: number;
  accessRole: DeviceAccessRole;
  primaryAssigneeName: string | null;
  primaryAssigneeStaffId: string | null;
  viewerNames: string[];
  macAddress: string;
  currentTempC: number;
  mktStatus: "safe" | "warning" | "alert";
  localAccessMode?: DeviceLocalAccessMode;
  latestSequence: number;
  recordedAt: number;
  rtcIso: string | null;
  sdCardMounted: boolean;
  timeSource: TelemetryTimeSource;
  lastSeenAt: number;
  lastConnectionTestAt: number | null;
  lastConnectionTestStatus: DeviceConnectionTestStatus;
  lastConnectionSyncStatus: DeviceConnectionSyncStatus;
  lastConnectionSyncUpdatedAt: number | null;
  lastConnectionSyncFailureStage: DeviceConnectionSyncFailureStage;
  lastConnectionSyncError: string | null;
};

export type LegacySavedDevice = {
  id: string;
  nickname: string;
  macAddress: string;
  currentTempC: number;
  mktStatus: "safe" | "warning" | "alert";
  localAccessMode?: DeviceLocalAccessMode;
  latestSequence?: number;
  recordedAt?: number;
  rtcIso?: string | null;
  sdCardMounted?: boolean;
  timeSource?: TelemetryTimeSource;
  lastSeenAt: number;
};

type DeviceRow = {
  id: string;
  institution_id: string;
  institution_name: string;
  nickname: string;
  mac_address: string;
  firmware_version: string;
  protocol_version: number;
  device_status: DeviceStatus;
  grant_version: number;
  access_role: DeviceAccessRole;
  primary_assignee_name: string | null;
  primary_assignee_staff_id: string | null;
  viewer_names_json: string;
  current_temp_c: number;
  mkt_status: "safe" | "warning" | "alert";
  local_access_mode: DeviceLocalAccessMode;
  latest_sequence: number;
  recorded_at: number;
  rtc_iso: string | null;
  sd_card_mounted: number;
  time_source: TelemetryTimeSource;
  last_seen_at: number;
  last_connection_test_at: number | null;
  last_connection_test_status: DeviceConnectionTestStatus;
  last_connection_sync_status: DeviceConnectionSyncStatus;
  last_connection_sync_updated_at: number | null;
  last_connection_sync_failure_stage: DeviceConnectionSyncFailureStage;
  last_connection_sync_error: string | null;
};

async function insertOrReplaceDevice(
  database: Awaited<ReturnType<typeof initializeSQLite>>,
  institutionId: string,
  institutionName: string,
  device: Omit<DeviceRecord, "institutionId" | "institutionName">,
) {
  const placeholderList = Array(28).fill("?").join(", ");

  await database.runAsync(
    `
      INSERT OR REPLACE INTO devices
      (
        id, institution_id, institution_name, nickname, mac_address, firmware_version, protocol_version,
        device_status, grant_version, access_role, local_access_mode, primary_assignee_name,
        primary_assignee_staff_id, viewer_names_json, current_temp_c, mkt_status, latest_sequence, recorded_at,
        rtc_iso, time_source, sd_card_mounted, last_seen_at,
        last_connection_test_at, last_connection_test_status, last_connection_sync_status,
        last_connection_sync_updated_at, last_connection_sync_failure_stage, last_connection_sync_error
      )
      VALUES (${placeholderList})
    `,
    device.id,
    institutionId,
    institutionName,
    device.nickname,
    device.macAddress,
    device.firmwareVersion,
    device.protocolVersion,
    device.status,
    device.grantVersion,
    device.accessRole,
    device.localAccessMode ?? "managed",
    device.primaryAssigneeName,
    device.primaryAssigneeStaffId,
    JSON.stringify(device.viewerNames),
    device.currentTempC,
    device.mktStatus,
    device.latestSequence,
    device.recordedAt,
    device.rtcIso,
    device.timeSource,
    0,
    device.lastSeenAt,
    device.lastConnectionTestAt,
    device.lastConnectionTestStatus,
    device.lastConnectionSyncStatus,
    device.lastConnectionSyncUpdatedAt,
    device.lastConnectionSyncFailureStage,
    device.lastConnectionSyncError,
  );
}

export async function replaceDevicesForInstitution(
  institutionId: string,
  institutionName: string,
  devices: Omit<DeviceRecord, "institutionId" | "institutionName">[],
) {
  const database = await initializeSQLite();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      "DELETE FROM devices WHERE institution_id = ? AND local_access_mode != 'quick_connect'",
      institutionId,
    );

    for (const device of devices) {
      await insertOrReplaceDevice(database, institutionId, institutionName, device);
    }
  });
}

export async function saveDevicesForInstitution(
  institutionId: string,
  devices: (LegacySavedDevice | Omit<DeviceRecord, "institutionId" | "institutionName">)[],
  institutionName = institutionId,
) {
  await replaceDevicesForInstitution(
    institutionId,
    institutionName,
    devices.map((device) => normalizeSavedDevice(device)),
  );
}

export async function replaceCachedDevicesForInstitution(args: {
  institutionId: string;
  institutionName: string;
  devices: (
    Omit<DeviceRecord, "institutionId" | "institutionName" | "status" | "lastConnectionTestStatus"> & {
      deviceStatus?: DeviceStatus;
      lastConnectionTestStatus?: DeviceConnectionTestStatus | "idle" | "running";
      lastConnectionSyncError?: string | null;
      lastConnectionSyncFailureStage?: DeviceConnectionSyncFailureStage;
      lastConnectionSyncStatus?: DeviceConnectionSyncStatus;
      lastConnectionSyncUpdatedAt?: number | null;
    }
  )[];
}) {
  await replaceDevicesForInstitution(
    args.institutionId,
    args.institutionName,
    args.devices.map((device) => ({
      ...device,
      status: device.deviceStatus ?? "enrolled",
      lastConnectionTestStatus: device.lastConnectionTestStatus ?? "idle",
      lastConnectionSyncStatus: device.lastConnectionSyncStatus ?? "idle",
      lastConnectionSyncUpdatedAt: device.lastConnectionSyncUpdatedAt ?? null,
      lastConnectionSyncFailureStage: device.lastConnectionSyncFailureStage ?? null,
      lastConnectionSyncError: device.lastConnectionSyncError ?? null,
    })),
  );
}

export async function getDevicesForInstitution(institutionId: string): Promise<DeviceRecord[]> {
  const database = await initializeSQLite();
  const rows = await database.getAllAsync<DeviceRow>(
    `
      SELECT ${buildDeviceSelectClause(true)}
      FROM devices
      WHERE institution_id = ? OR institution_id = '' OR local_access_mode = 'quick_connect'
      ORDER BY nickname ASC
    `,
    institutionId,
    institutionId,
  );

  return rows.map(mapDeviceRow);
}

export async function getDeviceById(deviceId: string, institutionId?: string): Promise<DeviceRecord | null> {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<DeviceRow>(
    `
      SELECT ${buildDeviceSelectClause(institutionId !== undefined)}
      FROM devices
      WHERE id = ?${institutionId !== undefined ? " AND (institution_id = ? OR institution_id = '' OR local_access_mode = 'quick_connect')" : ""}
    `,
    deviceId,
    ...(institutionId !== undefined ? [institutionId] : []),
  );

  return row ? mapDeviceRow(row) : null;
}

export async function saveDeviceConnectionSnapshot(
  deviceId: string,
  snapshot: {
    currentTempC: number;
    lastConnectionTestAt: number;
    lastConnectionTestStatus: DeviceConnectionTestStatus;
    lastSeenAt: number;
    macAddress: string;
    mktStatus: DeviceRecord["mktStatus"];
    recordedAt: number;
    rtcIso: string | null;
    sdCardMounted: boolean;
    sequence: number;
    timeSource: TelemetryTimeSource;
  },
) {
  const database = await initializeSQLite();
  await database.runAsync(
    `
      UPDATE devices
      SET mac_address = ?, current_temp_c = ?, mkt_status = ?, latest_sequence = ?, recorded_at = ?,
          rtc_iso = ?, time_source = ?, sd_card_mounted = ?, last_seen_at = ?, last_connection_test_at = ?,
          last_connection_test_status = ?
      WHERE id = ?
    `,
    snapshot.macAddress,
    snapshot.currentTempC,
    snapshot.mktStatus,
    snapshot.sequence,
    snapshot.recordedAt,
    snapshot.rtcIso,
    snapshot.timeSource,
    0,
    snapshot.lastSeenAt,
    snapshot.lastConnectionTestAt,
    snapshot.lastConnectionTestStatus,
    deviceId,
  );
}

export async function upsertLocalQuickConnectDevice(args: {
  currentTempC?: number;
  deviceId: string;
  firmwareVersion?: string;
  institutionId: string;
  institutionName: string;
  lastSeenAt?: number;
  latestSequence?: number;
  macAddress?: string;
  mktStatus?: DeviceRecord["mktStatus"];
  nickname: string;
  protocolVersion?: number;
  recordedAt?: number;
  rtcIso?: string | null;
  timeSource?: TelemetryTimeSource;
}) {
  const existing = await getDeviceById(args.deviceId);
  const database = await initializeSQLite();
  const now = Date.now();

  await insertOrReplaceDevice(database, args.institutionId, args.institutionName, {
    accessRole: existing?.accessRole ?? "viewer",
    currentTempC: args.currentTempC ?? existing?.currentTempC ?? 0,
    firmwareVersion: args.firmwareVersion ?? existing?.firmwareVersion ?? "quick-connect",
    grantVersion: existing?.grantVersion ?? 1,
    id: args.deviceId,
    lastConnectionSyncError: existing?.lastConnectionSyncError ?? null,
    lastConnectionSyncFailureStage: existing?.lastConnectionSyncFailureStage ?? null,
    lastConnectionSyncStatus: existing?.lastConnectionSyncStatus ?? "idle",
    lastConnectionSyncUpdatedAt: existing?.lastConnectionSyncUpdatedAt ?? null,
    lastConnectionTestAt: existing?.lastConnectionTestAt ?? null,
    lastConnectionTestStatus: existing?.lastConnectionTestStatus ?? "idle",
    lastSeenAt: args.lastSeenAt ?? existing?.lastSeenAt ?? now,
    latestSequence: args.latestSequence ?? existing?.latestSequence ?? 0,
    localAccessMode: "quick_connect",
    macAddress: args.macAddress ?? existing?.macAddress ?? args.deviceId,
    mktStatus: args.mktStatus ?? existing?.mktStatus ?? "safe",
    nickname: args.nickname.trim() || existing?.nickname || args.deviceId,
    primaryAssigneeName: existing?.primaryAssigneeName ?? null,
    primaryAssigneeStaffId: existing?.primaryAssigneeStaffId ?? null,
    protocolVersion: args.protocolVersion ?? existing?.protocolVersion ?? 1,
    recordedAt: args.recordedAt ?? existing?.recordedAt ?? now,
    rtcIso: args.rtcIso ?? existing?.rtcIso ?? null,
    sdCardMounted: false,
    status: existing?.status ?? "enrolled",
    timeSource: args.timeSource ?? existing?.timeSource ?? "unknown",
    viewerNames: existing?.viewerNames ?? [],
  });

  return await getDeviceById(args.deviceId);
}

export { upsertLocalQuickConnectDevice as upsertLocalDevice };

export async function updateDeviceConnectionTestStatus(args: {
  deviceId: string;
  status: "failed" | "running" | "success";
  testedAt: number;
}) {
  const database = await initializeSQLite();
  await database.runAsync(
    `
      UPDATE devices
      SET last_connection_test_at = ?, last_connection_test_status = ?
      WHERE id = ?
    `,
    args.testedAt,
    args.status,
    args.deviceId,
  );
}

export async function updateDeviceConnectionSyncState(args: {
  deviceId: string;
  errorMessage: string | null;
  failureStage: DeviceConnectionSyncFailureStage;
  status: DeviceConnectionSyncStatus;
  updatedAt: number;
}) {
  const database = await initializeSQLite();
  await database.runAsync(
    `
      UPDATE devices
      SET last_connection_sync_status = ?, last_connection_sync_updated_at = ?,
          last_connection_sync_failure_stage = ?, last_connection_sync_error = ?
      WHERE id = ?
    `,
    args.status,
    args.updatedAt,
    args.failureStage,
    args.errorMessage,
    args.deviceId,
  );
}

function parseViewerNames(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSavedDevice(
  device: LegacySavedDevice | Omit<DeviceRecord, "institutionId" | "institutionName">,
): Omit<DeviceRecord, "institutionId" | "institutionName"> {
  return {
    accessRole: "accessRole" in device ? device.accessRole : "viewer",
    latestSequence: device.latestSequence ?? 0,
    recordedAt: device.recordedAt ?? device.lastSeenAt,
    rtcIso: device.rtcIso ?? null,
    localAccessMode: device.localAccessMode ?? "managed",
    sdCardMounted: false,
    timeSource: "timeSource" in device ? device.timeSource ?? "unknown" : "unknown",
    currentTempC: device.currentTempC,
    firmwareVersion: "firmwareVersion" in device ? device.firmwareVersion : "legacy-fw-unknown",
    grantVersion: "grantVersion" in device ? device.grantVersion : 1,
    id: device.id,
    lastConnectionTestAt: "lastConnectionTestAt" in device ? device.lastConnectionTestAt : null,
    lastConnectionTestStatus: "lastConnectionTestStatus" in device ? device.lastConnectionTestStatus : "idle",
    lastSeenAt: device.lastSeenAt,
    macAddress: device.macAddress,
    mktStatus: device.mktStatus,
    nickname: device.nickname,
    primaryAssigneeName: "primaryAssigneeName" in device ? device.primaryAssigneeName : null,
    primaryAssigneeStaffId: "primaryAssigneeStaffId" in device ? device.primaryAssigneeStaffId : null,
    protocolVersion: "protocolVersion" in device ? device.protocolVersion : 1,
    status: "status" in device ? device.status : "enrolled",
    viewerNames: "viewerNames" in device ? device.viewerNames : [],
    lastConnectionSyncStatus: "lastConnectionSyncStatus" in device ? device.lastConnectionSyncStatus : "idle",
    lastConnectionSyncUpdatedAt: "lastConnectionSyncUpdatedAt" in device ? device.lastConnectionSyncUpdatedAt : null,
    lastConnectionSyncFailureStage:
      "lastConnectionSyncFailureStage" in device ? device.lastConnectionSyncFailureStage : null,
    lastConnectionSyncError: "lastConnectionSyncError" in device ? device.lastConnectionSyncError : null,
  };
}

function buildDeviceSelectClause(normalizeEmptyInstitutionId: boolean) {
  const institutionIdSelect = normalizeEmptyInstitutionId
    ? "COALESCE(NULLIF(institution_id, ''), ?) AS institution_id"
    : "institution_id";
  return `
    id,
    ${institutionIdSelect},
    institution_name, nickname, mac_address, firmware_version, protocol_version,
    device_status, grant_version, access_role, local_access_mode, primary_assignee_name, primary_assignee_staff_id,
    viewer_names_json, current_temp_c, mkt_status, latest_sequence, recorded_at, rtc_iso, time_source, sd_card_mounted, last_seen_at,
    last_connection_test_at, last_connection_test_status, last_connection_sync_status,
    last_connection_sync_updated_at, last_connection_sync_failure_stage, last_connection_sync_error
  `;
}

function mapDeviceRow(row: DeviceRow): DeviceRecord {
  return {
    id: row.id,
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    nickname: row.nickname,
    firmwareVersion: row.firmware_version,
    protocolVersion: row.protocol_version,
    status: row.device_status,
    deviceStatus: row.device_status,
    grantVersion: row.grant_version,
    accessRole: row.access_role,
    primaryAssigneeName: row.primary_assignee_name ?? null,
    primaryAssigneeStaffId: row.primary_assignee_staff_id ?? null,
    viewerNames: parseViewerNames(row.viewer_names_json),
    macAddress: row.mac_address,
    currentTempC: row.current_temp_c,
    mktStatus: row.mkt_status,
    localAccessMode: row.local_access_mode,
    latestSequence: row.latest_sequence,
    recordedAt: row.recorded_at,
    rtcIso: row.rtc_iso,
    sdCardMounted: false,
    timeSource: row.time_source,
    lastSeenAt: row.last_seen_at,
    lastConnectionTestAt: row.last_connection_test_at ?? null,
    lastConnectionTestStatus: row.last_connection_test_status ?? "idle",
    lastConnectionSyncStatus: row.last_connection_sync_status ?? "idle",
    lastConnectionSyncUpdatedAt: row.last_connection_sync_updated_at ?? null,
    lastConnectionSyncFailureStage: row.last_connection_sync_failure_stage ?? null,
    lastConnectionSyncError: row.last_connection_sync_error ?? null,
  };
}
