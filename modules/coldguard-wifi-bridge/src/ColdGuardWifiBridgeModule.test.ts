describe("getColdGuardWifiBridgeModule", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("returns the native module when it loads successfully", () => {
    const nativeModule = {
      connectToAccessPointAsync: jest.fn(),
      fetchRuntimeSnapshotAsync: jest.fn(),
      fetchRuntimeHistoryAsync: jest.fn(),
      getMonitoringStatusesAsync: jest.fn(),
      listNearbyColdGuardNetworksAsync: jest.fn(),
      releaseNetworkBindingAsync: jest.fn(),
      startEnrollmentAsync: jest.fn(),
      startMonitoringDeviceAsync: jest.fn(),
      stopMonitoringDeviceAsync: jest.fn(),
    };
    jest.doMock("expo", () => ({
      requireNativeModule: jest.fn(() => nativeModule),
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getColdGuardWifiBridgeModule } = require("./ColdGuardWifiBridgeModule");
      expect(getColdGuardWifiBridgeModule()).toBe(nativeModule);
    });
  });

  test("returns null when the native module is missing", () => {
    jest.doMock("expo", () => ({
      requireNativeModule: jest.fn(() => {
        const error = new Error("Cannot find native module 'ColdGuardWifiBridge'");
        (error as Error & { code?: string }).code = "ERR_UNAVAILABLE";
        throw error;
      }),
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getColdGuardWifiBridgeModule } = require("./ColdGuardWifiBridgeModule");
      expect(getColdGuardWifiBridgeModule()).toBeNull();
    });
  });

  test("rethrows non-missing native module initialization errors", () => {
    jest.doMock("expo", () => ({
      requireNativeModule: jest.fn(() => {
        throw new Error("Native module registration failed");
      }),
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getColdGuardWifiBridgeModule } = require("./ColdGuardWifiBridgeModule");
      expect(() => getColdGuardWifiBridgeModule()).toThrow("Native module registration failed");
    });
  });
});

describe("ColdGuardWifiBridgeModule.web", () => {
  test("startEnrollmentAsync throws when the web bridge is unavailable", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("./ColdGuardWifiBridgeModule.web");

    await expect(
      module.default().startEnrollmentAsync({
        actionTicketJson: "{}",
        bootstrapToken: "bootstrap-token",
        connectActionTicketJson: "{}",
        deviceId: "device-123",
        handshakeToken: "handshake-token",
        institutionId: "inst-1",
        nickname: "ColdGuard 0123",
      }),
    ).rejects.toThrow("WIFI_BRIDGE_UNAVAILABLE");
  });

  test("stopMonitoringDeviceAsync returns a status map keyed by device id", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("./ColdGuardWifiBridgeModule.web");

    await expect(module.default().stopMonitoringDeviceAsync("device-123")).resolves.toEqual(
      expect.objectContaining({
        "device-123": expect.objectContaining({
          deviceId: "device-123",
          error: null,
          isRunning: false,
          transport: null,
        }),
      }),
    );
  });

  test("fetchRuntimeHistoryAsync throws when the web bridge is unavailable", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("./ColdGuardWifiBridgeModule.web");

    await expect(module.default().fetchRuntimeHistoryAsync("http://192.168.4.1")).rejects.toThrow(
      "WIFI_BRIDGE_UNAVAILABLE",
    );
  });

  test("listNearbyColdGuardNetworksAsync throws when the web bridge is unavailable", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("./ColdGuardWifiBridgeModule.web");

    await expect(module.default().listNearbyColdGuardNetworksAsync()).rejects.toThrow(
      "WIFI_BRIDGE_UNAVAILABLE",
    );
  });
});
