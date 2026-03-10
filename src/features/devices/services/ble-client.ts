import { PermissionsAndroid, Platform } from "react-native";
import { BleError, BleManager, type Device, type ScanMode, Subscription } from "react-native-ble-plx";
import type { CachedConnectionGrant, ColdGuardDiscoveredDevice, ColdGuardWifiTicket } from "../types";
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
  firmwareVersion: string;
  macAddress: string;
  ok: boolean;
  protocolVersion: number;
  requestId: string;
  state: "blank" | "enrolled";
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
    adminGrant: CachedConnectionGrant;
    bootstrapToken: string;
    deviceId: string;
    handshakeToken: string;
    institutionId: string;
    nickname: string;
  }): Promise<ColdGuardDiscoveredDevice> {
    const { device, hello } = await connectAndHello(args.deviceId);

    try {
      await sendCommand(device, "enroll.begin", {
        bootstrapToken: args.bootstrapToken,
        deviceId: args.deviceId,
        grantToken: args.adminGrant.token,
        handshakeToken: args.handshakeToken,
        institutionId: args.institutionId,
        nickname: args.nickname,
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
    deviceId: string;
    grant: CachedConnectionGrant;
    handshakeToken: string;
  }): Promise<ColdGuardWifiTicket> {
    const { device, hello } = await connectAndHello(args.deviceId);

    try {
      const proofTimestamp = Date.now();
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      await sendCommand(device, "grant.verify", {
        deviceId: args.deviceId,
        grantToken: args.grant.token,
        handshakeProof,
        proofTimestamp,
      });

      const response = await sendCommand(device, "wifi.ticket.request", {});
      return {
        expiresAt: Number(response.expiresAt),
        password: String(response.password),
        ssid: String(response.ssid),
        testUrl: String(response.testUrl),
      };
    } finally {
      await device.cancelConnection().catch(() => undefined);
    }
  }

  async decommissionDevice(args: {
    adminGrant: CachedConnectionGrant;
    deviceId: string;
    handshakeToken: string;
  }): Promise<void> {
    const { device, hello } = await connectAndHello(args.deviceId);

    try {
      const proofTimestamp = Date.now();
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      await sendCommand(device, "device.decommission", {
        grantToken: args.adminGrant.token,
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
  const hello = helloResponse as HelloResponse;
  if (hello.deviceId !== expectedDeviceId) {
    await connectedDevice.cancelConnection().catch(() => undefined);
    throw new Error("BLE_DEVICE_ID_MISMATCH");
  }

  return {
    device: connectedDevice,
    hello,
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
