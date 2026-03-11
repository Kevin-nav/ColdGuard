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
      firmwareVersion: "fw-1.0.0",
      macAddress: "AA:BB:CC:DD:EE:01",
      ok: true,
      protocolVersion: 1,
      requestId: "req-1",
      state: "enrolled",
    }),
  ).toEqual(
    expect.objectContaining({
      command: "hello",
      deviceId: "device-1",
      state: "enrolled",
    }),
  );
});

test("rejects wifi ticket responses with missing expiresAt", () => {
  expect(() =>
    __testing.parseWifiTicketResponse({
      command: "wifi.ticket.request",
      ok: true,
      password: "pass-1",
      requestId: "req-1",
      ssid: "ColdGuard_A100",
      testUrl: "http://192.168.4.1/api/v1/connection-test",
    }),
  ).toThrow("BLE_WIFI_TICKET_EXPIRES_AT_MISSING");
});

test("rejects wifi ticket responses with missing string fields", () => {
  expect(() =>
    __testing.parseWifiTicketResponse({
      command: "wifi.ticket.request",
      expiresAt: Date.now() + 60_000,
      ok: true,
      password: "pass-1",
      requestId: "req-1",
      ssid: "ColdGuard_A100",
      testUrl: undefined,
    }),
  ).toThrow("BLE_WIFI_TICKET_TESTURL_MISSING");
});

test("parses a valid wifi ticket response", () => {
  expect(
    __testing.parseWifiTicketResponse({
      command: "wifi.ticket.request",
      expiresAt: `${Date.now() + 60_000}`,
      ok: true,
      password: "pass-1",
      requestId: "req-1",
      ssid: "ColdGuard_A100",
      testUrl: "http://192.168.4.1/api/v1/connection-test",
    }),
  ).toEqual({
    expiresAt: expect.any(Number),
    password: "pass-1",
    ssid: "ColdGuard_A100",
    testUrl: "http://192.168.4.1/api/v1/connection-test",
  });
});
