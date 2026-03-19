describe("getColdGuardWifiBridgeModule", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("returns the native module when it loads successfully", () => {
    const nativeModule = {
      connectToAccessPointAsync: jest.fn(),
      getMonitoringServiceStatusAsync: jest.fn(),
      releaseNetworkBindingAsync: jest.fn(),
      startMonitoringServiceAsync: jest.fn(),
      stopMonitoringServiceAsync: jest.fn(),
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
