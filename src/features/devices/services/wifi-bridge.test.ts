import type { ColdGuardMonitoringStatusMap } from "../../../../modules/coldguard-wifi-bridge";

const mockConnectToAccessPointAsync = jest.fn();
const mockFetchRuntimeSnapshotAsync = jest.fn();
const mockGetMonitoringStatusesAsync = jest.fn();
const mockReleaseNetworkBindingAsync = jest.fn();
const mockStartMonitoringDeviceAsync = jest.fn();
const mockStopMonitoringDeviceAsync = jest.fn();

jest.mock("../../../../modules/coldguard-wifi-bridge", () => ({
  __esModule: true,
  default: () => ({
    connectToAccessPointAsync: (...args: unknown[]) => mockConnectToAccessPointAsync(...args),
    fetchRuntimeSnapshotAsync: (...args: unknown[]) => mockFetchRuntimeSnapshotAsync(...args),
    getMonitoringStatusesAsync: (...args: unknown[]) => mockGetMonitoringStatusesAsync(...args),
    releaseNetworkBindingAsync: () => mockReleaseNetworkBindingAsync(),
    startMonitoringDeviceAsync: (...args: unknown[]) => mockStartMonitoringDeviceAsync(...args),
    stopMonitoringDeviceAsync: (...args: unknown[]) => mockStopMonitoringDeviceAsync(...args),
  }),
}));

describe("wifi bridge helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("passes ticket credentials through to the native module on android", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    mockConnectToAccessPointAsync.mockResolvedValue({
      localIp: "192.168.4.2",
      ssid: "ColdGuard_A100",
    });

    let createColdGuardWifiBridge: typeof import("./wifi-bridge").createColdGuardWifiBridge;
    jest.isolateModules(() => {
      ({ createColdGuardWifiBridge } = jest.requireActual("./wifi-bridge"));
    });
    const bridge = createColdGuardWifiBridge!();

    await expect(
      bridge.connect({
        expiresAt: 1,
        password: "pass-1",
        ssid: "ColdGuard_A100",
        testUrl: "http://192.168.4.1/api/v1/connection-test",
      }),
    ).resolves.toEqual({
      localIp: "192.168.4.2",
      ssid: "ColdGuard_A100",
    });

    expect(mockConnectToAccessPointAsync).toHaveBeenCalledWith("ColdGuard_A100", "pass-1");
  });

  test("releases the native network binding after use on android", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    mockReleaseNetworkBindingAsync.mockResolvedValue(undefined);

    let createColdGuardWifiBridge: typeof import("./wifi-bridge").createColdGuardWifiBridge;
    jest.isolateModules(() => {
      ({ createColdGuardWifiBridge } = jest.requireActual("./wifi-bridge"));
    });
    const bridge = createColdGuardWifiBridge!();

    await expect(bridge.release()).resolves.toBeUndefined();
    expect(mockReleaseNetworkBindingAsync).toHaveBeenCalledTimes(1);
  });

  test("fetches runtime snapshots through the native module on android", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    mockFetchRuntimeSnapshotAsync.mockResolvedValue({
      alertsJson: "{\"alerts\":[]}",
      runtimeBaseUrl: "http://192.168.4.1",
      statusJson: "{\"deviceId\":\"device-1\"}",
    });

    let createColdGuardWifiBridge: typeof import("./wifi-bridge").createColdGuardWifiBridge;
    jest.isolateModules(() => {
      ({ createColdGuardWifiBridge } = jest.requireActual("./wifi-bridge"));
    });
    const bridge = createColdGuardWifiBridge!();

    await expect(bridge.fetchRuntimeSnapshot?.("http://192.168.4.1/api/v1/connection-test")).resolves.toEqual({
      alertsJson: "{\"alerts\":[]}",
      runtimeBaseUrl: "http://192.168.4.1",
      statusJson: "{\"deviceId\":\"device-1\"}",
    });

    expect(mockFetchRuntimeSnapshotAsync).toHaveBeenCalledWith("http://192.168.4.1/api/v1/connection-test");
  });

  test("proxies multi-device monitoring commands on android", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    const statuses: ColdGuardMonitoringStatusMap = {
      "device-1": {
        deviceId: "device-1",
        error: null,
        isRunning: true,
        transport: "facility_wifi",
      },
      "device-2": {
        deviceId: "device-2",
        error: "RECOVERING_SOFTAP",
        isRunning: true,
        transport: "softap",
      },
    };
    mockStartMonitoringDeviceAsync.mockResolvedValue(statuses);
    mockGetMonitoringStatusesAsync.mockResolvedValue(statuses);
    mockStopMonitoringDeviceAsync.mockResolvedValue({
      "device-2": statuses["device-2"],
    });

    let getNativeMonitoringServiceStatuses: typeof import("./wifi-bridge").getNativeMonitoringServiceStatuses;
    let startNativeMonitoringDevice: typeof import("./wifi-bridge").startNativeMonitoringDevice;
    let stopNativeMonitoringDevice: typeof import("./wifi-bridge").stopNativeMonitoringDevice;
    jest.isolateModules(() => {
      ({
        getNativeMonitoringServiceStatuses,
        startNativeMonitoringDevice,
        stopNativeMonitoringDevice,
      } = jest.requireActual("./wifi-bridge"));
    });

    await expect(
      startNativeMonitoringDevice!({
        deviceId: "device-1",
        facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
        transport: "facility_wifi",
      }),
    ).resolves.toEqual(statuses);
    await expect(getNativeMonitoringServiceStatuses!()).resolves.toEqual(statuses);
    await expect(stopNativeMonitoringDevice!("device-1")).resolves.toEqual({
      "device-2": statuses["device-2"],
    });

    expect(mockStartMonitoringDeviceAsync).toHaveBeenCalledWith({
      deviceId: "device-1",
      facilityWifiRuntimeBaseUrl: "http://10.0.0.22",
      transport: "facility_wifi",
    });
    expect(mockStopMonitoringDeviceAsync).toHaveBeenCalledWith("device-1");
  });

  test("returns safe empty monitoring state when the bridge is unavailable", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));

    let getNativeMonitoringServiceStatuses: typeof import("./wifi-bridge").getNativeMonitoringServiceStatuses;
    let stopNativeMonitoringDevice: typeof import("./wifi-bridge").stopNativeMonitoringDevice;
    jest.isolateModules(() => {
      ({
        getNativeMonitoringServiceStatuses,
        stopNativeMonitoringDevice,
      } = jest.requireActual("./wifi-bridge"));
    });

    await expect(getNativeMonitoringServiceStatuses!()).resolves.toEqual({});
    await expect(stopNativeMonitoringDevice!("device-1")).resolves.toEqual({});
  });

  test("fails loudly when the bridge is unavailable on non-android platforms", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));

    let createColdGuardWifiBridge: typeof import("./wifi-bridge").createColdGuardWifiBridge;
    let startNativeMonitoringDevice: typeof import("./wifi-bridge").startNativeMonitoringDevice;
    jest.isolateModules(() => {
      ({
        createColdGuardWifiBridge,
        startNativeMonitoringDevice,
      } = jest.requireActual("./wifi-bridge"));
    });
    const bridge = createColdGuardWifiBridge!();

    await expect(
      bridge.connect({
        expiresAt: 1,
        password: "pass-1",
        ssid: "ColdGuard_A100",
        testUrl: "http://192.168.4.1/api/v1/connection-test",
      }),
    ).rejects.toThrow("WIFI_BRIDGE_UNAVAILABLE");
    await expect(
      startNativeMonitoringDevice!({
        deviceId: "device-1",
        transport: "ble_fallback",
      }),
    ).rejects.toThrow("WIFI_BRIDGE_MONITORING_UNAVAILABLE");
  });
});
