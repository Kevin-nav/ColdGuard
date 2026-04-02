import type { ColdGuardMonitoringStatusMap } from "../../../../modules/coldguard-wifi-bridge";

const mockConnectToAccessPointAsync = jest.fn();
const mockFetchRuntimeSnapshotAsync = jest.fn();
const mockFetchRuntimeHistoryAsync = jest.fn();
const mockGetMonitoringStatusesAsync = jest.fn();
const mockListNearbyColdGuardNetworksAsync = jest.fn();
const mockReleaseNetworkBindingAsync = jest.fn();
const mockStartEnrollmentAsync = jest.fn();
const mockStartMonitoringDeviceAsync = jest.fn();
const mockStopMonitoringDeviceAsync = jest.fn();
const mockAddListener = jest.fn();

jest.mock("../../../../modules/coldguard-wifi-bridge", () => ({
  __esModule: true,
  default: () => ({
    connectToAccessPointAsync: (...args: unknown[]) => mockConnectToAccessPointAsync(...args),
    fetchRuntimeSnapshotAsync: (...args: unknown[]) => mockFetchRuntimeSnapshotAsync(...args),
    fetchRuntimeHistoryAsync: (...args: unknown[]) => mockFetchRuntimeHistoryAsync(...args),
    getMonitoringStatusesAsync: (...args: unknown[]) => mockGetMonitoringStatusesAsync(...args),
    listNearbyColdGuardNetworksAsync: (...args: unknown[]) => mockListNearbyColdGuardNetworksAsync(...args),
    releaseNetworkBindingAsync: () => mockReleaseNetworkBindingAsync(),
    startEnrollmentAsync: (...args: unknown[]) => mockStartEnrollmentAsync(...args),
    startMonitoringDeviceAsync: (...args: unknown[]) => mockStartMonitoringDeviceAsync(...args),
    stopMonitoringDeviceAsync: (...args: unknown[]) => mockStopMonitoringDeviceAsync(...args),
    addListener: (...args: unknown[]) => mockAddListener(...args),
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
        password: "48291573",
        ssid: "ColdGuard_A100",
        testUrl: "http://192.168.4.1/api/v1/connection-test",
      }),
    ).resolves.toEqual({
      localIp: "192.168.4.2",
      ssid: "ColdGuard_A100",
    });

    expect(mockConnectToAccessPointAsync).toHaveBeenCalledWith("ColdGuard_A100", "48291573");
  });

  test("lists nearby ColdGuard networks through the native module on android", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    mockListNearbyColdGuardNetworksAsync.mockResolvedValue(["ColdGuard_A100", "ColdGuard_B200"]);

    let createColdGuardWifiBridge: typeof import("./wifi-bridge").createColdGuardWifiBridge;
    jest.isolateModules(() => {
      ({ createColdGuardWifiBridge } = jest.requireActual("./wifi-bridge"));
    });
    const bridge = createColdGuardWifiBridge!();

    await expect(bridge.listNearbyColdGuardNetworks()).resolves.toEqual(["ColdGuard_A100", "ColdGuard_B200"]);
    expect(mockListNearbyColdGuardNetworksAsync).toHaveBeenCalledTimes(1);
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
      historyJson: "{\"hasMore\":false,\"nextSequence\":0,\"rows\":[]}",
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
      historyJson: "{\"hasMore\":false,\"nextSequence\":0,\"rows\":[]}",
      runtimeBaseUrl: "http://192.168.4.1",
      statusJson: "{\"deviceId\":\"device-1\"}",
    });

    expect(mockFetchRuntimeSnapshotAsync).toHaveBeenCalledWith("http://192.168.4.1/api/v1/connection-test");
  });

  test("fetches runtime history through the native module on android", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    mockFetchRuntimeHistoryAsync.mockResolvedValue({
      hasMore: false,
      nextSequence: 9,
      rowsJson: "[]",
      runtimeBaseUrl: "http://192.168.4.1",
    });

    let createColdGuardWifiBridge: typeof import("./wifi-bridge").createColdGuardWifiBridge;
    jest.isolateModules(() => {
      ({ createColdGuardWifiBridge } = jest.requireActual("./wifi-bridge"));
    });
    const bridge = createColdGuardWifiBridge!();

    await expect(bridge.fetchRuntimeHistory?.("http://192.168.4.1/api/v1/runtime/history", 8, 100)).resolves.toEqual({
      hasMore: false,
      nextSequence: 9,
      rowsJson: "[]",
      runtimeBaseUrl: "http://192.168.4.1",
    });

    expect(mockFetchRuntimeHistoryAsync).toHaveBeenCalledWith("http://192.168.4.1/api/v1/runtime/history", 8, 100);
  });

  test("omits runtime snapshot helpers when the native method is unavailable", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    jest.doMock("../../../../modules/coldguard-wifi-bridge", () => ({
      __esModule: true,
      default: () => ({
        connectToAccessPointAsync: (...args: unknown[]) => mockConnectToAccessPointAsync(...args),
        getMonitoringStatusesAsync: (...args: unknown[]) => mockGetMonitoringStatusesAsync(...args),
        listNearbyColdGuardNetworksAsync: undefined,
        releaseNetworkBindingAsync: undefined,
        startMonitoringDeviceAsync: (...args: unknown[]) => mockStartMonitoringDeviceAsync(...args),
        stopMonitoringDeviceAsync: (...args: unknown[]) => mockStopMonitoringDeviceAsync(...args),
      }),
    }));

    let createColdGuardWifiBridge: typeof import("./wifi-bridge").createColdGuardWifiBridge;
    jest.isolateModules(() => {
      ({ createColdGuardWifiBridge } = jest.requireActual("./wifi-bridge"));
    });
    const bridge = createColdGuardWifiBridge!();

    expect(bridge.fetchRuntimeSnapshot).toBeUndefined();
    await expect(bridge.listNearbyColdGuardNetworks()).rejects.toThrow("WIFI_BRIDGE_DISCOVERY_UNAVAILABLE");
    await expect(bridge.release()).resolves.toBeUndefined();
    expect(mockReleaseNetworkBindingAsync).not.toHaveBeenCalled();
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

  test("starts native enrollment on android and returns the native result", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    jest.doMock("../../../../modules/coldguard-wifi-bridge", () => ({
      __esModule: true,
      default: () => ({
        addListener: (...args: unknown[]) => mockAddListener(...args),
        connectToAccessPointAsync: (...args: unknown[]) => mockConnectToAccessPointAsync(...args),
        fetchRuntimeSnapshotAsync: (...args: unknown[]) => mockFetchRuntimeSnapshotAsync(...args),
        getMonitoringStatusesAsync: (...args: unknown[]) => mockGetMonitoringStatusesAsync(...args),
        listNearbyColdGuardNetworksAsync: (...args: unknown[]) => mockListNearbyColdGuardNetworksAsync(...args),
        releaseNetworkBindingAsync: () => mockReleaseNetworkBindingAsync(),
        startEnrollmentAsync: (...args: unknown[]) => mockStartEnrollmentAsync(...args),
        startMonitoringDeviceAsync: (...args: unknown[]) => mockStartMonitoringDeviceAsync(...args),
        stopMonitoringDeviceAsync: (...args: unknown[]) => mockStopMonitoringDeviceAsync(...args),
      }),
    }));
    mockStartEnrollmentAsync.mockResolvedValue({
      bleName: "ColdGuard_7BCC",
      deviceId: "CG-ESP32-5C7BCC",
      diagnostics: {
        attemptsByStageJson: "{\"finding_device\":1}",
        detail: "Enrollment completed successfully.",
        deviceId: "CG-ESP32-5C7BCC",
        failureStage: null,
        rawErrorMessage: null,
        runtimeBaseUrl: "http://192.168.4.1",
        ssid: "ColdGuard_7BCC",
        timelineJson: "[]",
      },
      firmwareVersion: "cg-transport-0.1.2",
      macAddress: "74:24:A8:5C:7B:CC",
      protocolVersion: 1,
      runtimeBaseUrl: "http://192.168.4.1",
      smokeTestPassed: true,
      softApPassword: "48291573",
      softApSsid: "ColdGuard_7BCC",
    });

    let startNativeEnrollment: typeof import("./wifi-bridge").startNativeEnrollment;
    jest.isolateModules(() => {
      ({ startNativeEnrollment } = jest.requireActual("./wifi-bridge"));
    });

    await expect(
      startNativeEnrollment!({
        actionTicketJson: "{\"action\":\"enroll\"}",
        bootstrapToken: "bootstrap-1",
        connectActionTicketJson: "{\"action\":\"connect\"}",
        deviceId: "CG-ESP32-5C7BCC",
        handshakeToken: "handshake-1",
        institutionId: "inst-1",
        nickname: "ColdGuard 7BCC",
      }),
    ).resolves.toMatchObject({
      deviceId: "CG-ESP32-5C7BCC",
      smokeTestPassed: true,
      softApSsid: "ColdGuard_7BCC",
    });

    expect(mockStartEnrollmentAsync).toHaveBeenCalledWith({
      actionTicketJson: "{\"action\":\"enroll\"}",
      bootstrapToken: "bootstrap-1",
      connectActionTicketJson: "{\"action\":\"connect\"}",
      deviceId: "CG-ESP32-5C7BCC",
      handshakeToken: "handshake-1",
      institutionId: "inst-1",
      nickname: "ColdGuard 7BCC",
    });
  });

  test("serializes native enrollment requests on android", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    const gate = (() => {
      let resolve!: () => void;
      const promise = new Promise<void>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    })();
    mockStartEnrollmentAsync.mockImplementation(async () => {
      await gate.promise;
      return {
        bleName: "ColdGuard_7BCC",
        deviceId: "CG-ESP32-5C7BCC",
        diagnostics: {
          attemptsByStageJson: "{\"finding_device\":1}",
          detail: "Enrollment completed successfully.",
          deviceId: "CG-ESP32-5C7BCC",
          failureStage: null,
          rawErrorMessage: null,
          runtimeBaseUrl: "http://192.168.4.1",
          ssid: "ColdGuard_7BCC",
          timelineJson: "[]",
        },
        firmwareVersion: "cg-transport-0.1.2",
        macAddress: "74:24:A8:5C:7B:CC",
        protocolVersion: 1,
        runtimeBaseUrl: "http://192.168.4.1",
        smokeTestPassed: true,
        softApPassword: "48291573",
        softApSsid: "ColdGuard_7BCC",
      };
    });

    let startNativeEnrollment: typeof import("./wifi-bridge").startNativeEnrollment;
    jest.isolateModules(() => {
      ({ startNativeEnrollment } = jest.requireActual("./wifi-bridge"));
    });

    const first = startNativeEnrollment!({
      actionTicketJson: "{\"action\":\"enroll\"}",
      bootstrapToken: "bootstrap-1",
      connectActionTicketJson: "{\"action\":\"connect\"}",
      deviceId: "CG-ESP32-5C7BCC",
      handshakeToken: "handshake-1",
      institutionId: "inst-1",
      nickname: "ColdGuard 7BCC",
    });
    const second = startNativeEnrollment!({
      actionTicketJson: "{\"action\":\"enroll\"}",
      bootstrapToken: "bootstrap-2",
      connectActionTicketJson: "{\"action\":\"connect\"}",
      deviceId: "CG-ESP32-5C7BCE",
      handshakeToken: "handshake-2",
      institutionId: "inst-1",
      nickname: "ColdGuard 7BCE",
    });

    await Promise.resolve();
    expect(mockStartEnrollmentAsync).toHaveBeenCalledTimes(1);

    gate.resolve();

    await expect(first).resolves.toMatchObject({
      deviceId: "CG-ESP32-5C7BCC",
    });
    await expect(second).resolves.toMatchObject({
      deviceId: "CG-ESP32-5C7BCC",
    });
    expect(mockStartEnrollmentAsync).toHaveBeenCalledTimes(2);
  });

  test("subscribes to native enrollment stage events on android", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    jest.doMock("../../../../modules/coldguard-wifi-bridge", () => ({
      __esModule: true,
      default: () => ({
        addListener: (...args: unknown[]) => mockAddListener(...args),
        connectToAccessPointAsync: (...args: unknown[]) => mockConnectToAccessPointAsync(...args),
        fetchRuntimeSnapshotAsync: (...args: unknown[]) => mockFetchRuntimeSnapshotAsync(...args),
        getMonitoringStatusesAsync: (...args: unknown[]) => mockGetMonitoringStatusesAsync(...args),
        listNearbyColdGuardNetworksAsync: (...args: unknown[]) => mockListNearbyColdGuardNetworksAsync(...args),
        releaseNetworkBindingAsync: () => mockReleaseNetworkBindingAsync(),
        startEnrollmentAsync: (...args: unknown[]) => mockStartEnrollmentAsync(...args),
        startMonitoringDeviceAsync: (...args: unknown[]) => mockStartMonitoringDeviceAsync(...args),
        stopMonitoringDeviceAsync: (...args: unknown[]) => mockStopMonitoringDeviceAsync(...args),
      }),
    }));
    const subscription = { remove: jest.fn() };
    mockAddListener.mockReturnValue(subscription);

    let subscribeToNativeEnrollmentStages: typeof import("./wifi-bridge").subscribeToNativeEnrollmentStages;
    jest.isolateModules(() => {
      ({ subscribeToNativeEnrollmentStages } = jest.requireActual("./wifi-bridge"));
    });

    const listener = jest.fn();
    expect(subscribeToNativeEnrollmentStages!(listener)).toBe(subscription);
    expect(mockAddListener).toHaveBeenCalledWith("onEnrollmentStage", listener);
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
        password: "48291573",
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
