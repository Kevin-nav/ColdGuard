import { PermissionsAndroid, Platform } from "react-native";
import { BleError, BleManager, type Device, type ScanMode, Subscription } from "react-native-ble-plx";
import type { CachedDeviceActionTicket, ColdGuardDiscoveredDevice, ColdGuardWifiTicket } from "../types";
import {
  COLDGUARD_BLE_COMMAND_CHARACTERISTIC_UUID,
  COLDGUARD_BLE_RESPONSE_CHARACTERISTIC_UUID,
  COLDGUARD_BLE_SERVICE_UUID,
  createHandshakeProof,
  decodeBleMessage,
  encodeBleMessage,
} from "./protocol";

type HelloResponse = {
  bleName: string;
  command: "hello";
  deviceId: string;
  deviceNonce: string;
  deviceTimeMs: number;
  firmwareVersion: string;
  macAddress: string;
  ok: boolean;
  protocolVersion: number;
  requestId: string;
  state: "blank" | "enrolled" | "pending";
};

type HelloSession = HelloResponse & {
  receivedAtMs: number;
};

type GenericBleResponse = {
  command: string;
  errorCode?: string;
  message?: string;
  ok: boolean;
  requestId: string;
  [key: string]: unknown;
};

const SCAN_TIMEOUT_MS = 12_000;
let bleManager: BleManager | null = null;

function isGenericBleResponse(value: unknown): value is GenericBleResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.command === "string" &&
    typeof candidate.ok === "boolean" &&
    typeof candidate.requestId === "string" &&
    (candidate.errorCode === undefined || typeof candidate.errorCode === "string") &&
    (candidate.message === undefined || typeof candidate.message === "string")
  );
}

function isHelloResponse(value: unknown): value is HelloResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.command === "hello" &&
    typeof candidate.bleName === "string" &&
    typeof candidate.deviceId === "string" &&
    typeof candidate.deviceNonce === "string" &&
    typeof candidate.deviceTimeMs === "number" &&
    Number.isFinite(candidate.deviceTimeMs) &&
    typeof candidate.firmwareVersion === "string" &&
    typeof candidate.macAddress === "string" &&
    typeof candidate.ok === "boolean" &&
    typeof candidate.protocolVersion === "number" &&
    Number.isFinite(candidate.protocolVersion) &&
    typeof candidate.requestId === "string" &&
    (candidate.state === "blank" || candidate.state === "enrolled" || candidate.state === "pending")
  );
}

function parseHelloResponse(helloResponse: GenericBleResponse): HelloResponse {
  if (!isHelloResponse(helloResponse)) {
    throw new Error("BLE_INVALID_HELLO_RESPONSE");
  }

  return helloResponse;
}

function requireWifiTicketStringField(
  response: GenericBleResponse,
  fieldName: "password" | "ssid" | "testUrl",
) {
  const value = response[fieldName];
  if (value === null || value === undefined) {
    throw new Error(`BLE_WIFI_TICKET_${fieldName.toUpperCase()}_MISSING`);
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`BLE_WIFI_TICKET_${fieldName.toUpperCase()}_INVALID`);
  }
  return value;
}

function parseWifiTicketResponse(response: GenericBleResponse): ColdGuardWifiTicket {
  const expiresInMs = response.expiresInMs;
  if (expiresInMs === null || expiresInMs === undefined) {
    throw new Error("BLE_WIFI_TICKET_EXPIRES_IN_MS_MISSING");
  }

  const normalizedExpiresInMs = typeof expiresInMs === "number" ? expiresInMs : Number(expiresInMs);
  if (!Number.isFinite(normalizedExpiresInMs)) {
    throw new Error("BLE_WIFI_TICKET_EXPIRES_IN_MS_INVALID");
  }

  return {
    expiresAt: Date.now() + normalizedExpiresInMs,
    password: requireWifiTicketStringField(response, "password"),
    ssid: requireWifiTicketStringField(response, "ssid"),
    testUrl: requireWifiTicketStringField(response, "testUrl"),
  };
}

function createProofTimestamp(hello: HelloSession) {
  const elapsedSinceHelloMs = Math.max(0, Date.now() - hello.receivedAtMs);
  return Math.round(hello.deviceTimeMs + elapsedSinceHelloMs);
}

function getBleManager() {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

export class RealColdGuardBleClient {
  async discoverDevice(args: { deviceId: string; expectedState: "blank" | "enrolled" }): Promise<ColdGuardDiscoveredDevice> {
    const { device, hello } = await connectAndHello(args.deviceId);
    await device.cancelConnection().catch(() => undefined);

    if (hello.state !== args.expectedState) {
      throw new Error("BLE_DEVICE_STATE_MISMATCH");
    }

    return {
      bleName: hello.bleName,
      bootstrapClaim: "",
      deviceId: hello.deviceId,
      firmwareVersion: hello.firmwareVersion,
      macAddress: hello.macAddress,
      protocolVersion: hello.protocolVersion,
      state: hello.state,
    };
  }

  async enrollDevice(args: {
    actionTicket: CachedDeviceActionTicket;
    bootstrapToken: string;
    deviceId: string;
    handshakeToken: string;
    institutionId: string;
    nickname: string;
  }): Promise<ColdGuardDiscoveredDevice> {
    const { device, hello } = await connectAndHello(args.deviceId);

    try {
      const proofTimestamp = createProofTimestamp(hello);
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      await sendCommand(device, "enroll.begin", {
        actionTicket: args.actionTicket,
        bootstrapToken: args.bootstrapToken,
        deviceId: args.deviceId,
        handshakeProof,
        handshakeToken: args.handshakeToken,
        institutionId: args.institutionId,
        nickname: args.nickname,
        proofTimestamp,
      });
      await sendCommand(device, "enroll.commit", {});
    } finally {
      await device.cancelConnection().catch(() => undefined);
    }

    return {
      bleName: hello.bleName,
      bootstrapClaim: args.bootstrapToken,
      deviceId: hello.deviceId,
      firmwareVersion: hello.firmwareVersion,
      macAddress: hello.macAddress,
      protocolVersion: hello.protocolVersion,
      state: "enrolled",
    };
  }

  async requestWifiTicket(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }): Promise<ColdGuardWifiTicket> {
    const { device, hello } = await connectAndHello(args.deviceId);

    try {
      const proofTimestamp = createProofTimestamp(hello);
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      await sendCommand(device, "grant.verify", {
        actionTicket: args.actionTicket,
        deviceId: args.deviceId,
        handshakeProof,
        proofTimestamp,
      });

      const response = await sendCommand(device, "wifi.ticket.request", {});
      return parseWifiTicketResponse(response);
    } finally {
      await device.cancelConnection().catch(() => undefined);
    }
  }

  async decommissionDevice(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }): Promise<void> {
    const { device, hello } = await connectAndHello(args.deviceId);

    try {
      const proofTimestamp = createProofTimestamp(hello);
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      await sendCommand(device, "device.decommission", {
        actionTicket: args.actionTicket,
        handshakeProof,
        proofTimestamp,
      });
    } finally {
      await device.cancelConnection().catch(() => undefined);
    }
  }
}

async function ensureBlePermissions() {
  if (Platform.OS !== "android") {
    return;
  }

  const permissions = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  ].filter(Boolean);

  if (permissions.length === 0) {
    return;
  }

  const statuses = await PermissionsAndroid.requestMultiple(permissions);
  const denied = Object.values(statuses).some((status) => status !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied) {
    throw new Error("BLE_PERMISSION_REQUIRED");
  }
}

async function connectAndHello(expectedDeviceId: string) {
  await ensureBlePermissions();

  const device = await scanForColdGuardDevice(expectedDeviceId);
  const connectedDevice = await device.connect({ requestMTU: 512 });
  await connectedDevice.discoverAllServicesAndCharacteristics();

  const helloResponse = await sendCommand(connectedDevice, "hello", {});
  const helloReceivedAtMs = Date.now();
  let hello: HelloResponse;
  try {
    hello = parseHelloResponse(helloResponse);
  } catch (error) {
    await connectedDevice.cancelConnection().catch(() => undefined);
    throw error;
  }

  if (hello.deviceId !== expectedDeviceId) {
    await connectedDevice.cancelConnection().catch(() => undefined);
    throw new Error("BLE_DEVICE_ID_MISMATCH");
  }

  return {
    device: connectedDevice,
    hello: {
      ...hello,
      receivedAtMs: helloReceivedAtMs,
    } satisfies HelloSession,
  };
}

async function scanForColdGuardDevice(expectedDeviceId: string) {
  return await new Promise<Device>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        getBleManager().stopDeviceScan();
        reject(new Error("BLE_DEVICE_NOT_FOUND"));
      }
    }, SCAN_TIMEOUT_MS);

    getBleManager().startDeviceScan(
      [COLDGUARD_BLE_SERVICE_UUID],
      { scanMode: 2 as ScanMode },
      async (error: BleError | null, device: Device | null) => {
        if (settled) {
          return;
        }

        if (error) {
          settled = true;
          clearTimeout(timeout);
          getBleManager().stopDeviceScan();
          reject(new Error(error.message));
          return;
        }

        if (!device) {
          return;
        }

        const maybeMatch =
          device.name?.includes(expectedDeviceId.slice(-4)) ||
          device.localName?.includes(expectedDeviceId.slice(-4)) ||
          device.id === expectedDeviceId;

        if (!maybeMatch) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        getBleManager().stopDeviceScan();
        resolve(device);
      },
    );
  });
}

async function sendCommand(device: Device, command: string, body: Record<string, unknown>) {
  const requestId = `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const payload = encodeBleMessage({
    command,
    requestId,
    ...body,
  });

  return await new Promise<GenericBleResponse>((resolve, reject) => {
    let subscription: Subscription | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    subscription = getBleManager().monitorCharacteristicForDevice(
      device.id,
      COLDGUARD_BLE_SERVICE_UUID,
      COLDGUARD_BLE_RESPONSE_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          cleanup();
          reject(new Error(error.message));
          return;
        }

        if (!characteristic?.value) {
          return;
        }

        try {
          const response = decodeBleMessage(characteristic.value, isGenericBleResponse);
          if (response.requestId !== requestId) {
            return;
          }

          cleanup();
          if (!response.ok) {
            reject(new Error(response.errorCode ?? response.message ?? "BLE_COMMAND_FAILED"));
            return;
          }
          resolve(response);
        } catch (nextError) {
          cleanup();
          reject(nextError instanceof Error ? nextError : new Error("BLE_RESPONSE_INVALID"));
        }
      },
    );

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error("BLE_RESPONSE_TIMEOUT"));
    }, 8_000);

    void device
      .writeCharacteristicWithResponseForService(
        COLDGUARD_BLE_SERVICE_UUID,
        COLDGUARD_BLE_COMMAND_CHARACTERISTIC_UUID,
        payload,
      )
      .catch((error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error("BLE_WRITE_FAILED"));
      });
  });
}

export const __testing = {
  createProofTimestamp,
  parseHelloResponse,
  parseWifiTicketResponse,
};
