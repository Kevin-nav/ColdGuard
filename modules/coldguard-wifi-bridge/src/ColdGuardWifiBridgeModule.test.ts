describe("getColdGuardWifiBridgeModule", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("returns the native module when it loads successfully", () => {
    const nativeModule = {
      connectToAccessPointAsync: jest.fn(),
      getMonitoringStatusesAsync: jest.fn(),
      releaseNetworkBindingAsync: jest.fn(),
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
  test("stopMonitoringDeviceAsync returns a status map keyed by device id", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("./ColdGuardWifiBridgeModule.web");

    await expect(module.default().stopMonitoringDeviceAsync("device-123")).resolves.toEqual({
      "device-123": {
        deviceId: "device-123",
        error: null,
        isRunning: false,
        transport: null,
      },
    });
  });
});
