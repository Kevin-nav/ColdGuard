jest.mock("react-native", () => ({
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: "ACCESS_FINE_LOCATION",
      BLUETOOTH_CONNECT: "BLUETOOTH_CONNECT",
      BLUETOOTH_SCAN: "BLUETOOTH_SCAN",
    },
    RESULTS: {
      GRANTED: "granted",
    },
    requestMultiple: jest.fn(async () => ({
      ACCESS_FINE_LOCATION: "granted",
      BLUETOOTH_CONNECT: "granted",
      BLUETOOTH_SCAN: "granted",
    })),
  },
  Platform: {
    OS: "android",
  },
}));

jest.mock("react-native-ble-plx", () => ({
  BleManager: jest.fn(),
  Subscription: jest.fn(),
}));

import { __testing } from "./ble-client";

test("rejects malformed hello responses before reading deviceId", () => {
  expect(() =>
    __testing.parseHelloResponse({
      command: "hello",
      ok: true,
      requestId: "req-1",
    } as any),
  ).toThrow("BLE_INVALID_HELLO_RESPONSE");
});

test("parses a valid hello response", () => {
  expect(
    __testing.parseHelloResponse({
      bleName: "ColdGuard_A100",
      command: "hello",
      deviceId: "device-1",
      deviceNonce: "nonce-1",
      deviceTimeMs: 1200,
      firmwareVersion: "fw-1.0.0",
      macAddress: "AA:BB:CC:DD:EE:01",
      ok: true,
      protocolVersion: 1,
      requestId: "req-1",
      state: "pending",
    }),
  ).toEqual(
    expect.objectContaining({
      command: "hello",
      deviceId: "device-1",
      deviceTimeMs: 1200,
      state: "pending",
    }),
  );
});

test("rejects wifi ticket responses with missing expiresInMs", () => {
  expect(() =>
    __testing.parseWifiTicketResponse({
      command: "wifi.ticket.request",
      ok: true,
      password: "pass-1",
      requestId: "req-1",
      ssid: "ColdGuard_A100",
      testUrl: "http://192.168.4.1/api/v1/connection-test",
    }),
  ).toThrow("BLE_WIFI_TICKET_EXPIRES_IN_MS_MISSING");
});

test("rejects wifi ticket responses with missing string fields", () => {
  expect(() =>
    __testing.parseWifiTicketResponse({
      command: "wifi.ticket.request",
      expiresInMs: 60_000,
      ok: true,
      password: "pass-1",
      requestId: "req-1",
      ssid: "ColdGuard_A100",
      testUrl: undefined,
    }),
  ).toThrow("BLE_WIFI_TICKET_TESTURL_MISSING");
});

test("parses a valid wifi ticket response", () => {
  jest.spyOn(Date, "now").mockReturnValue(1000);
  expect(
    __testing.parseWifiTicketResponse({
      command: "wifi.ticket.request",
      expiresInMs: "60000",
      ok: true,
      password: "pass-1",
      requestId: "req-1",
      ssid: "ColdGuard_A100",
      testUrl: "http://192.168.4.1/api/v1/connection-test",
    }),
  ).toEqual({
    expiresAt: 61_000,
    password: "pass-1",
    ssid: "ColdGuard_A100",
    testUrl: "http://192.168.4.1/api/v1/connection-test",
  });
  jest.restoreAllMocks();
});

test("creates a proof timestamp from device uptime plus local elapsed time", () => {
  jest.spyOn(Date, "now").mockReturnValue(1600);
  expect(
    __testing.createProofTimestamp({
      bleName: "ColdGuard_A100",
      command: "hello",
      deviceId: "device-1",
      deviceNonce: "nonce-1",
      deviceTimeMs: 5000,
      firmwareVersion: "fw-1.0.0",
      macAddress: "AA:BB:CC:DD:EE:01",
      ok: true,
      protocolVersion: 1,
      receivedAtMs: 1200,
      requestId: "req-1",
      state: "blank",
    }),
  ).toBe(5400);
  jest.restoreAllMocks();
});

test("matches scan results by BLE name suffix even without a service filter", () => {
  expect(
    __testing.doesDeviceMatchExpectedId(
      {
        id: "AA:BB:CC:DD:EE:FF",
        localName: null,
        name: "ColdGuard_7BCC",
      } as any,
      "CG-ESP32-5C7BCC",
    ),
  ).toBe(true);
});

test("splits oversized BLE transport payloads into multiple chunks", () => {
  expect(__testing.splitTransportPayload("a".repeat(250), 120)).toEqual([
    "a".repeat(120),
    "a".repeat(120),
    "a".repeat(10),
  ]);
});
