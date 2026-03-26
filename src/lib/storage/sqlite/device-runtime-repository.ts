import { initializeSQLite } from "./client";
import type {
  DeviceControlRole,
  DeviceRuntimeConfig,
  MonitoringMode,
  RuntimeSessionStatus,
  RuntimeTransportMode,
} from "../../../features/devices/types";

type DeviceRuntimeConfigRow = {
  active_runtime_base_url: string | null;
  active_transport: RuntimeTransportMode | null;
  control_role: DeviceControlRole | null;
  device_id: string;
  facility_wifi_password: string | null;
  facility_wifi_runtime_base_url: string | null;
  facility_wifi_ssid: string | null;
  softap_password: string | null;
  softap_runtime_base_url: string | null;
  softap_ssid: string | null;
  primary_controller_user_id: string | null;
  primary_lease_expires_at: number | null;
  primary_lease_session_id: string | null;
  last_monitor_at: number | null;
  last_monitor_error: string | null;
  last_ping_at: number | null;
  last_recover_at: number | null;
  last_runtime_error: string | null;
  monitoring_mode: MonitoringMode;
  session_status: RuntimeSessionStatus;
  updated_at: number;
};

function mapRow(row: DeviceRuntimeConfigRow): DeviceRuntimeConfig {
  return {
    activeRuntimeBaseUrl: row.active_runtime_base_url,
    activeTransport: row.active_transport,
    controlRole: row.control_role ?? "none",
    deviceId: row.device_id,
    facilityWifiPassword: row.facility_wifi_password,
    facilityWifiRuntimeBaseUrl: row.facility_wifi_runtime_base_url,
    facilityWifiSsid: row.facility_wifi_ssid,
    softApPassword: row.softap_password,
    softApRuntimeBaseUrl: row.softap_runtime_base_url,
    softApSsid: row.softap_ssid,
    primaryControllerUserId: row.primary_controller_user_id ?? null,
    primaryLeaseExpiresAt: row.primary_lease_expires_at ?? null,
    primaryLeaseSessionId: row.primary_lease_session_id ?? null,
    lastMonitorAt: row.last_monitor_at,
    lastMonitorError: row.last_monitor_error,
    lastPingAt: row.last_ping_at,
    lastRecoverAt: row.last_recover_at,
    lastRuntimeError: row.last_runtime_error,
    monitoringMode: row.monitoring_mode,
    sessionStatus: row.session_status,
    updatedAt: row.updated_at,
  };
}

export async function getDeviceRuntimeConfig(deviceId: string): Promise<DeviceRuntimeConfig | null> {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<DeviceRuntimeConfigRow>(
    `
      SELECT device_id, active_transport, control_role, session_status, monitoring_mode, active_runtime_base_url,
             facility_wifi_ssid, facility_wifi_password, facility_wifi_runtime_base_url,
             softap_ssid, softap_password, softap_runtime_base_url,
             primary_controller_user_id, primary_lease_expires_at, primary_lease_session_id,
             last_ping_at, last_recover_at, last_monitor_at, last_runtime_error, last_monitor_error, updated_at
      FROM device_runtime_config
      WHERE device_id = ?
    `,
    deviceId,
  );

  return row ? mapRow(row) : null;
}

export async function saveDeviceRuntimeConfig(
  args: Omit<DeviceRuntimeConfig, "updatedAt">,
): Promise<DeviceRuntimeConfig> {
  const database = await initializeSQLite();
  const updatedAt = Date.now();

  await database.runAsync(
    `
      INSERT OR REPLACE INTO device_runtime_config
      (
        device_id, active_transport, control_role, session_status, monitoring_mode, active_runtime_base_url,
        facility_wifi_ssid, facility_wifi_password, facility_wifi_runtime_base_url,
        softap_ssid, softap_password, softap_runtime_base_url,
        primary_controller_user_id, primary_lease_expires_at, primary_lease_session_id,
        last_ping_at, last_recover_at, last_monitor_at, last_runtime_error, last_monitor_error, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args.deviceId,
    args.activeTransport,
    args.controlRole,
    args.sessionStatus,
    args.monitoringMode,
    args.activeRuntimeBaseUrl,
    args.facilityWifiSsid,
    args.facilityWifiPassword,
    args.facilityWifiRuntimeBaseUrl,
    args.softApSsid,
    args.softApPassword,
    args.softApRuntimeBaseUrl,
    args.primaryControllerUserId,
    args.primaryLeaseExpiresAt,
    args.primaryLeaseSessionId,
    args.lastPingAt,
    args.lastRecoverAt,
    args.lastMonitorAt,
    args.lastRuntimeError,
    args.lastMonitorError,
    updatedAt,
  );

  return {
    ...args,
    updatedAt,
  };
}

export async function upsertDeviceRuntimeConfig(
  deviceId: string,
  patch: Partial<Omit<DeviceRuntimeConfig, "deviceId" | "updatedAt">>,
): Promise<DeviceRuntimeConfig> {
  const existing = await getDeviceRuntimeConfig(deviceId);
  return await saveDeviceRuntimeConfig({
    activeRuntimeBaseUrl: patch.activeRuntimeBaseUrl ?? existing?.activeRuntimeBaseUrl ?? null,
    activeTransport: patch.activeTransport ?? existing?.activeTransport ?? null,
    controlRole: patch.controlRole ?? existing?.controlRole ?? "none",
    deviceId,
    facilityWifiPassword: patch.facilityWifiPassword ?? existing?.facilityWifiPassword ?? null,
    facilityWifiRuntimeBaseUrl:
      patch.facilityWifiRuntimeBaseUrl ?? existing?.facilityWifiRuntimeBaseUrl ?? null,
    facilityWifiSsid: patch.facilityWifiSsid ?? existing?.facilityWifiSsid ?? null,
    primaryControllerUserId:
      patch.primaryControllerUserId ?? existing?.primaryControllerUserId ?? null,
    primaryLeaseExpiresAt: patch.primaryLeaseExpiresAt ?? existing?.primaryLeaseExpiresAt ?? null,
    primaryLeaseSessionId: patch.primaryLeaseSessionId ?? existing?.primaryLeaseSessionId ?? null,
    softApPassword: patch.softApPassword ?? existing?.softApPassword ?? null,
    softApRuntimeBaseUrl: patch.softApRuntimeBaseUrl ?? existing?.softApRuntimeBaseUrl ?? null,
    softApSsid: patch.softApSsid ?? existing?.softApSsid ?? null,
    lastMonitorAt: patch.lastMonitorAt ?? existing?.lastMonitorAt ?? null,
    lastMonitorError: patch.lastMonitorError ?? existing?.lastMonitorError ?? null,
    lastPingAt: patch.lastPingAt ?? existing?.lastPingAt ?? null,
    lastRecoverAt: patch.lastRecoverAt ?? existing?.lastRecoverAt ?? null,
    lastRuntimeError: patch.lastRuntimeError ?? existing?.lastRuntimeError ?? null,
    monitoringMode: patch.monitoringMode ?? existing?.monitoringMode ?? "off",
    sessionStatus: patch.sessionStatus ?? existing?.sessionStatus ?? "idle",
  });
}

export async function deleteDeviceRuntimeConfig(deviceId: string) {
  const database = await initializeSQLite();
  await database.runAsync("DELETE FROM device_runtime_config WHERE device_id = ?", deviceId);
}

export async function listMonitoredDeviceRuntimeConfigs(
  options?: { excludeDeviceIds?: string[] },
): Promise<DeviceRuntimeConfig[]> {
  const database = await initializeSQLite();
  const excludeDeviceIds =
    options?.excludeDeviceIds
      ?.map((deviceId) => deviceId.trim())
      .filter((deviceId) => deviceId.length > 0) ?? [];
  const exclusionClause =
    excludeDeviceIds.length > 0
      ? ` AND device_id NOT IN (${excludeDeviceIds.map(() => "?").join(", ")})`
      : "";
  const rows = await database.getAllAsync<DeviceRuntimeConfigRow>(
    `
      SELECT device_id, active_transport, control_role, session_status, monitoring_mode, active_runtime_base_url,
             facility_wifi_ssid, facility_wifi_password, facility_wifi_runtime_base_url,
             softap_ssid, softap_password, softap_runtime_base_url,
             primary_controller_user_id, primary_lease_expires_at, primary_lease_session_id,
             last_ping_at, last_recover_at, last_monitor_at, last_runtime_error, last_monitor_error, updated_at
      FROM device_runtime_config
      WHERE monitoring_mode = 'foreground_service'${exclusionClause}
      ORDER BY device_id ASC
    `,
    ...excludeDeviceIds,
  );

  return rows.map(mapRow);
}
