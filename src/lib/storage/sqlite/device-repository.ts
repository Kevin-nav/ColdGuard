import { initializeSQLite } from "./client";

export type DeviceAccessRole = "manager" | "primary" | "viewer";
export type DeviceConnectionTestStatus = "idle" | "running" | "success" | "failed" | null;
export type DeviceStatus = "enrolled" | "decommissioned";

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
  batteryLevel: number;
  doorOpen: boolean;
  lastSeenAt: number;
  lastConnectionTestAt: number | null;
  lastConnectionTestStatus: DeviceConnectionTestStatus;
};

export type LegacySavedDevice = {
  id: string;
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
  battery_level: number;
  door_open: number;
  last_seen_at: number;
  last_connection_test_at: number | null;
  last_connection_test_status: DeviceConnectionTestStatus;
};

export async function replaceDevicesForInstitution(
  institutionId: string,
  institutionName: string,
  devices: Omit<DeviceRecord, "institutionId" | "institutionName">[],
) {
  const database = await initializeSQLite();
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync("DELETE FROM devices WHERE institution_id = ?", institutionId);

    for (const device of devices) {
      await txn.runAsync(
        `
          INSERT INTO devices
          (
            id, institution_id, institution_name, nickname, mac_address, firmware_version, protocol_version,
            device_status, grant_version, access_role, primary_assignee_name, primary_assignee_staff_id,
            viewer_names_json, current_temp_c, mkt_status, battery_level, door_open, last_seen_at,
            last_connection_test_at, last_connection_test_status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        device.primaryAssigneeName,
        device.primaryAssigneeStaffId,
        JSON.stringify(device.viewerNames),
        device.currentTempC,
        device.mktStatus,
        device.batteryLevel,
        device.doorOpen ? 1 : 0,
        device.lastSeenAt,
        device.lastConnectionTestAt,
        device.lastConnectionTestStatus,
      );
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
    })),
  );
}

export async function getDevicesForInstitution(institutionId: string): Promise<DeviceRecord[]> {
  const database = await initializeSQLite();
  const rows = await database.getAllAsync<DeviceRow>(
    `
      SELECT
        id,
        COALESCE(NULLIF(institution_id, ''), ?) AS institution_id,
        institution_name, nickname, mac_address, firmware_version, protocol_version,
        device_status, grant_version, access_role, primary_assignee_name, primary_assignee_staff_id,
        viewer_names_json, current_temp_c, mkt_status, battery_level, door_open, last_seen_at,
        last_connection_test_at, last_connection_test_status
      FROM devices
      WHERE institution_id = ? OR institution_id = ''
      ORDER BY nickname ASC
    `,
    institutionId,
    institutionId,
  );

  return rows.map(mapDeviceRow);
}

export async function getDeviceById(deviceId: string): Promise<DeviceRecord | null> {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<DeviceRow>(
    `
      SELECT
        id, institution_id, institution_name, nickname, mac_address, firmware_version, protocol_version,
        device_status, grant_version, access_role, primary_assignee_name, primary_assignee_staff_id,
        viewer_names_json, current_temp_c, mkt_status, battery_level, door_open, last_seen_at,
        last_connection_test_at, last_connection_test_status
      FROM devices
      WHERE id = ?
    `,
    deviceId,
  );

  return row ? mapDeviceRow(row) : null;
}

export async function saveDeviceConnectionSnapshot(
  deviceId: string,
  snapshot: {
    batteryLevel: number;
    currentTempC: number;
    doorOpen: boolean;
    lastConnectionTestAt: number;
    lastConnectionTestStatus: DeviceConnectionTestStatus;
    lastSeenAt: number;
    macAddress: string;
    mktStatus: DeviceRecord["mktStatus"];
  },
) {
  const database = await initializeSQLite();
  await database.runAsync(
    `
      UPDATE devices
      SET mac_address = ?, current_temp_c = ?, mkt_status = ?, battery_level = ?, door_open = ?, last_seen_at = ?,
          last_connection_test_at = ?, last_connection_test_status = ?
      WHERE id = ?
    `,
    snapshot.macAddress,
    snapshot.currentTempC,
    snapshot.mktStatus,
    snapshot.batteryLevel,
    snapshot.doorOpen ? 1 : 0,
    snapshot.lastSeenAt,
    snapshot.lastConnectionTestAt,
    snapshot.lastConnectionTestStatus,
    deviceId,
  );
}

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
    batteryLevel: device.batteryLevel,
    currentTempC: device.currentTempC,
    doorOpen: device.doorOpen,
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
  };
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
    batteryLevel: row.battery_level,
    doorOpen: row.door_open === 1,
    lastSeenAt: row.last_seen_at,
    lastConnectionTestAt: row.last_connection_test_at ?? null,
    lastConnectionTestStatus: row.last_connection_test_status ?? "idle",
  };
}
