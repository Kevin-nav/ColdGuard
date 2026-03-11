const mockConnectToAccessPointAsync = jest.fn();
const mockReleaseNetworkBindingAsync = jest.fn();

jest.mock("../../../../modules/coldguard-wifi-bridge", () => ({
  __esModule: true,
  default: () => ({
    connectToAccessPointAsync: (...args: unknown[]) => mockConnectToAccessPointAsync(...args),
    releaseNetworkBindingAsync: () => mockReleaseNetworkBindingAsync(),
  }),
}));

describe("createColdGuardWifiBridge", () => {
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

  test("fails loudly when the bridge is unavailable on non-android platforms", async () => {
    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
    }));

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
    ).rejects.toThrow("WIFI_BRIDGE_UNAVAILABLE");
  });
});
