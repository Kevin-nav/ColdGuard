import {
  deleteDeviceRuntimeConfig,
  getDeviceRuntimeConfig,
  listMonitoredDeviceRuntimeConfigs,
  saveDeviceRuntimeConfig,
  upsertDeviceRuntimeConfig,
} from "./device-runtime-repository";

const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetAllAsync: jest.Mock<any, any> = jest.fn(async () => []);
const mockGetFirstAsync: jest.Mock<any, any> = jest.fn(async () => null);

jest.mock("./client", () => ({
  initializeSQLite: jest.fn(async () => ({
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("saves a device runtime config", async () => {
  const record = await saveDeviceRuntimeConfig({
    activeRuntimeBaseUrl: "http://192.168.4.1",
    activeTransport: "softap",
    controlRole: "primary",
    deviceId: "device-1",
    facilityWifiPassword: null,
    facilityWifiRuntimeBaseUrl: null,
    facilityWifiSsid: null,
    primaryControllerUserId: "user-1",
    primaryLeaseExpiresAt: 10000,
    primaryLeaseSessionId: "lease-1",
    softApPassword: "softap-secret",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    lastMonitorAt: null,
    lastMonitorError: null,
    lastPingAt: 1000,
    lastRecoverAt: null,
    lastRuntimeError: null,
    monitoringMode: "off",
    sessionStatus: "connected",
  });

  expect(mockRunAsync).toHaveBeenCalled();
  expect(record.deviceId).toBe("device-1");
  expect(record.activeTransport).toBe("softap");
  expect(record.controlRole).toBe("primary");
});

test("loads a saved runtime config", async () => {
  mockGetFirstAsync.mockResolvedValue({
    active_runtime_base_url: "http://device.local",
    active_transport: "facility_wifi",
    control_role: "secondary",
    device_id: "device-1",
    facility_wifi_password: "pw",
    facility_wifi_runtime_base_url: "http://10.0.0.22",
    facility_wifi_ssid: "ClinicNet",
    primary_controller_user_id: "user-1",
    primary_lease_expires_at: 10000,
    primary_lease_session_id: "lease-1",
    softap_password: "softap-secret",
    softap_runtime_base_url: "http://192.168.4.1",
    softap_ssid: "ColdGuard_A100",
    last_monitor_at: 300,
    last_monitor_error: null,
    last_ping_at: 250,
    last_recover_at: 200,
    last_runtime_error: "timeout",
    monitoring_mode: "foreground_service",
    session_status: "recovering",
    updated_at: 400,
  });

  await expect(getDeviceRuntimeConfig("device-1")).resolves.toEqual({
    activeRuntimeBaseUrl: "http://device.local",
    activeTransport: "facility_wifi",
    controlRole: "secondary",
    deviceId: "device-1",
    facilityWifiPassword: "pw",
    facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
    facilityWifiSsid: "ClinicNet",
    primaryControllerUserId: "user-1",
    primaryLeaseExpiresAt: 10000,
    primaryLeaseSessionId: "lease-1",
    softApPassword: "softap-secret",
    softApRuntimeBaseUrl: "http://192.168.4.1",
    softApSsid: "ColdGuard_A100",
    lastMonitorAt: 300,
    lastMonitorError: null,
    lastPingAt: 250,
    lastRecoverAt: 200,
    lastRuntimeError: "timeout",
    monitoringMode: "foreground_service",
    sessionStatus: "recovering",
    updatedAt: 400,
  });
});

test("defaults missing control role fields for legacy runtime rows", async () => {
  mockGetFirstAsync.mockResolvedValue({
    active_runtime_base_url: "http://device.local",
    active_transport: null,
    device_id: "device-legacy",
    facility_wifi_password: null,
    facility_wifi_runtime_base_url: null,
    facility_wifi_ssid: null,
    softap_password: null,
    softap_runtime_base_url: null,
    softap_ssid: null,
    last_monitor_at: null,
    last_monitor_error: null,
    last_ping_at: null,
    last_recover_at: null,
    last_runtime_error: null,
    monitoring_mode: "off",
    session_status: "idle",
    updated_at: 500,
  });

  await expect(getDeviceRuntimeConfig("device-legacy")).resolves.toEqual({
    activeRuntimeBaseUrl: "http://device.local",
    activeTransport: null,
    controlRole: "none",
    deviceId: "device-legacy",
    facilityWifiPassword: null,
    facilityWifiRuntimeBaseUrl: null,
    facilityWifiSsid: null,
    primaryControllerUserId: null,
    primaryLeaseExpiresAt: null,
    primaryLeaseSessionId: null,
    softApPassword: null,
    softApRuntimeBaseUrl: null,
    softApSsid: null,
    lastMonitorAt: null,
    lastMonitorError: null,
    lastPingAt: null,
    lastRecoverAt: null,
    lastRuntimeError: null,
    monitoringMode: "off",
    sessionStatus: "idle",
    updatedAt: 500,
  });
});

test("upserts a runtime config with existing values", async () => {
  mockGetFirstAsync.mockResolvedValueOnce({
    active_runtime_base_url: "http://device.local",
    active_transport: "facility_wifi",
    control_role: "secondary",
    device_id: "device-1",
    facility_wifi_password: "pw",
    facility_wifi_runtime_base_url: "http://10.0.0.22",
    facility_wifi_ssid: "ClinicNet",
    primary_controller_user_id: "user-1",
    primary_lease_expires_at: 10000,
    primary_lease_session_id: "lease-1",
    softap_password: "softap-secret",
    softap_runtime_base_url: "http://192.168.4.1",
    softap_ssid: "ColdGuard_A100",
    last_monitor_at: 300,
    last_monitor_error: null,
    last_ping_at: 250,
    last_recover_at: 200,
    last_runtime_error: "timeout",
    monitoring_mode: "foreground_service",
    session_status: "recovering",
    updated_at: 400,
  });

  const record = await upsertDeviceRuntimeConfig("device-1", {
    activeTransport: "softap",
    lastRuntimeError: null,
    sessionStatus: "connected",
  });

  expect(record.facilityWifiSsid).toBe("ClinicNet");
  expect(record.softApSsid).toBe("ColdGuard_A100");
  expect(record.activeTransport).toBe("softap");
  expect(record.controlRole).toBe("secondary");
  expect(record.sessionStatus).toBe("connected");
});

test("deletes a device runtime config", async () => {
  await deleteDeviceRuntimeConfig("device-1");
  expect(mockRunAsync).toHaveBeenCalledWith(
    "DELETE FROM device_runtime_config WHERE device_id = ?",
    "device-1",
  );
});

test("lists monitored runtime configs", async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      active_runtime_base_url: "http://device.local",
      active_transport: "softap",
      control_role: "primary",
      device_id: "device-1",
      facility_wifi_password: null,
      facility_wifi_runtime_base_url: null,
      facility_wifi_ssid: null,
      primary_controller_user_id: "user-1",
      primary_lease_expires_at: 2000,
      primary_lease_session_id: "lease-1",
      softap_password: "softap-secret",
      softap_runtime_base_url: "http://192.168.4.1",
      softap_ssid: "ColdGuard_A100",
      last_monitor_at: 300,
      last_monitor_error: null,
      last_ping_at: 250,
      last_recover_at: 200,
      last_runtime_error: null,
      monitoring_mode: "foreground_service",
      session_status: "connected",
      updated_at: 400,
    },
  ]);

  await expect(listMonitoredDeviceRuntimeConfigs()).resolves.toEqual([
    expect.objectContaining({
      activeRuntimeBaseUrl: "http://device.local",
      activeTransport: "softap",
      controlRole: "primary",
      deviceId: "device-1",
      primaryControllerUserId: "user-1",
      primaryLeaseExpiresAt: 2000,
      primaryLeaseSessionId: "lease-1",
      monitoringMode: "foreground_service",
      sessionStatus: "connected",
    }),
  ]);
});

test("trims excluded device ids before building the query bindings", async () => {
  mockGetAllAsync.mockResolvedValue([]);

  await listMonitoredDeviceRuntimeConfigs({
    excludeDeviceIds: [" device-1 ", "   ", "device-2"],
  });

  expect(mockGetAllAsync).toHaveBeenCalledWith(
    expect.stringContaining("device_id NOT IN (?, ?)"),
    "device-1",
    "device-2",
  );
});
