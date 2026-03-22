import { PermissionsAndroid, Platform } from "react-native";
import { BleError, BleManager, type Device, type ScanMode, Subscription } from "react-native-ble-plx";
import { decode as decodeBase64 } from "base-64";
import type {
  CachedDeviceActionTicket,
  ColdGuardDiscoveredDevice,
  ColdGuardWifiTicket,
  FacilityWifiProvisioning,
} from "../types";
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
  enrollmentReady: boolean;
  firmwareVersion: string;
  macAddress: string;
  ok: boolean;
  protocolVersion: number;
  requestId: string;
  state: "blank" | "ready" | "enrolled" | "pending";
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
const SCAN_RETRY_DELAY_MS = 1_500;
const SCAN_RETRY_MAX_ATTEMPTS = 3;
const MAX_BLE_WRITE_BYTES = 180;
const BLE_TRANSPORT_CHUNK_BYTES = 120;
let bleManager: BleManager | null = null;

type BleCommandSession = {
  close: () => void;
  device: Device;
  sendCommand: (command: string, body: Record<string, unknown>) => Promise<GenericBleResponse>;
};

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
    typeof candidate.enrollmentReady === "boolean" &&
    typeof candidate.firmwareVersion === "string" &&
    typeof candidate.macAddress === "string" &&
    typeof candidate.ok === "boolean" &&
    typeof candidate.protocolVersion === "number" &&
    Number.isFinite(candidate.protocolVersion) &&
    typeof candidate.requestId === "string" &&
    (candidate.state === "blank" ||
      candidate.state === "ready" ||
      candidate.state === "enrolled" ||
      candidate.state === "pending")
  );
}

function isBlankLikeState(state: HelloResponse["state"]) {
  return state === "blank" || state === "ready";
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

function parseWifiProvisionResponse(response: GenericBleResponse): FacilityWifiProvisioning {
  const runtimeBaseUrl = response.runtimeBaseUrl;
  if (typeof runtimeBaseUrl !== "string" || runtimeBaseUrl.length === 0) {
    throw new Error("BLE_WIFI_PROVISION_RUNTIME_BASE_URL_INVALID");
  }

  return {
    password: requireWifiTicketStringField(response, "password"),
    runtimeBaseUrl,
    ssid: requireWifiTicketStringField(response, "ssid"),
  };
}

function createProofTimestamp(hello: HelloSession) {
  const elapsedSinceHelloMs = Math.max(0, Date.now() - hello.receivedAtMs);
  return Math.round(hello.deviceTimeMs + elapsedSinceHelloMs);
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function splitTransportPayload(value: string, chunkSize = BLE_TRANSPORT_CHUNK_BYTES) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }
  return chunks;
}

function getBleManager() {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

function resetBleManager() {
  try {
    bleManager?.destroy();
  } catch {
    // Ignore teardown errors from a stale native BLE session.
  }
  bleManager = null;
}

function parseAdvertisementField(
  encodedField: string | null | undefined,
  fieldName: string,
) {
  if (!encodedField) {
    return null;
  }

  let decodedField = "";
  try {
    decodedField = decodeBase64(encodedField);
  } catch {
    return null;
  }

  const entries = decodedField.split(";");
  for (const entry of entries) {
    const [rawKey, ...valueParts] = entry.split("=");
    if (rawKey?.trim().toLowerCase() !== fieldName.toLowerCase()) {
      continue;
    }

    const value = valueParts.join("=").trim();
    return value.length > 0 ? value : null;
  }

  return null;
}

function getDeviceIdFromAdvertisement(device: Pick<Device, "serviceData">) {
  if (!device.serviceData || typeof device.serviceData !== "object") {
    return null;
  }

  for (const encodedValue of Object.values(device.serviceData)) {
    const advertisedDeviceId = parseAdvertisementField(encodedValue, "id");
    if (advertisedDeviceId) {
      return advertisedDeviceId;
    }
  }

  return null;
}

function doesDeviceMatchExpectedId(
  device: Pick<Device, "id" | "localName" | "name" | "serviceData">,
  expectedDeviceId: string,
) {
  const advertisedDeviceId = getDeviceIdFromAdvertisement(device);
  if (advertisedDeviceId === expectedDeviceId) {
    return true;
  }

  const expectedSuffix = expectedDeviceId.slice(-4).toUpperCase();
  return (
    device.name?.toUpperCase().includes(expectedSuffix) ||
    device.localName?.toUpperCase().includes(expectedSuffix) ||
    device.id === expectedDeviceId
  );
}

export class RealColdGuardBleClient {
  async discoverDevice(args: { deviceId: string; expectedState: "blank" | "enrolled" }): Promise<ColdGuardDiscoveredDevice> {
    const { close, device, hello } = await connectAndHello(args.deviceId);
    close();
    await device.cancelConnection().catch(() => undefined);

    if (args.expectedState === "blank") {
      if (!isBlankLikeState(hello.state)) {
        throw new Error("BLE_DEVICE_STATE_MISMATCH");
      }
    } else if (hello.state !== args.expectedState) {
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
    const { close, device, hello, sendCommand } = await connectAndHello(args.deviceId);

    try {
      if (!isBlankLikeState(hello.state)) {
        throw new Error("BLE_DEVICE_STATE_MISMATCH");
      }

      if (!hello.enrollmentReady) {
        throw new Error("ENROLLMENT_NOT_READY");
      }

      const proofTimestamp = createProofTimestamp(hello);
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      await sendCommand("enroll.begin", {
        actionTicket: args.actionTicket,
        bootstrapToken: args.bootstrapToken,
        deviceId: args.deviceId,
        handshakeProof,
        handshakeToken: args.handshakeToken,
        institutionId: args.institutionId,
        nickname: args.nickname,
        proofTimestamp,
      });
      await sendCommand("enroll.commit", {});
    } finally {
      close();
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
    const { close, device, hello, sendCommand } = await connectAndHello(args.deviceId);

    try {
      const proofTimestamp = createProofTimestamp(hello);
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      await sendCommand("grant.verify", {
        actionTicket: args.actionTicket,
        deviceId: args.deviceId,
        handshakeProof,
        proofTimestamp,
      });

      const response = await sendCommand("wifi.ticket.request", {});
      return parseWifiTicketResponse(response);
    } finally {
      close();
      await device.cancelConnection().catch(() => undefined);
    }
  }

  async provisionWifi(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
    password: string;
    ssid: string;
  }): Promise<FacilityWifiProvisioning> {
    const { close, device, hello, sendCommand } = await connectAndHello(args.deviceId);

    try {
      const proofTimestamp = createProofTimestamp(hello);
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      const response = await sendCommand("wifi.provision", {
        actionTicket: args.actionTicket,
        handshakeProof,
        password: args.password,
        proofTimestamp,
        ssid: args.ssid,
      });
      return parseWifiProvisionResponse(response);
    } finally {
      close();
      await device.cancelConnection().catch(() => undefined);
    }
  }

  async decommissionDevice(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }): Promise<void> {
    const { close, device, hello, sendCommand } = await connectAndHello(args.deviceId);

    try {
      const proofTimestamp = createProofTimestamp(hello);
      const handshakeProof = await createHandshakeProof({
        deviceId: args.deviceId,
        deviceNonce: hello.deviceNonce,
        handshakeToken: args.handshakeToken,
        proofTimestamp,
      });

      await sendCommand("device.decommission", {
        actionTicket: args.actionTicket,
        handshakeProof,
        proofTimestamp,
      });
    } finally {
      close();
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

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= SCAN_RETRY_MAX_ATTEMPTS; attempt += 1) {
    let connectedDevice: Device | null = null;
    let session: BleCommandSession | null = null;

    try {
      const device = await scanForColdGuardDevice(expectedDeviceId);
      connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();
      session = openCommandSession(connectedDevice);
      const helloResponse = await session.sendCommand("hello", {});
      const helloReceivedAtMs = Date.now();
      const hello = parseHelloResponse(helloResponse);
      if (hello.deviceId !== expectedDeviceId) {
        throw new Error("BLE_DEVICE_ID_MISMATCH");
      }

      return {
        close: session.close,
        device: connectedDevice,
        hello: {
          ...hello,
          receivedAtMs: helloReceivedAtMs,
        } satisfies HelloSession,
        sendCommand: session.sendCommand,
      };
    } catch (error) {
      session?.close();
      await connectedDevice?.cancelConnection().catch(() => undefined);
      lastError = error instanceof Error ? error : new Error("BLE_CONNECTION_FAILED");
      if (attempt < SCAN_RETRY_MAX_ATTEMPTS && isTransientBleConnectionError(lastError)) {
        resetBleManager();
        await delay(SCAN_RETRY_DELAY_MS);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("BLE_DEVICE_NOT_FOUND");
}

async function scanForColdGuardDevice(expectedDeviceId: string) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= SCAN_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await scanForColdGuardDeviceOnce(expectedDeviceId);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("BLE_DEVICE_NOT_FOUND");
      if (attempt < SCAN_RETRY_MAX_ATTEMPTS) {
        await delay(SCAN_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError ?? new Error("BLE_DEVICE_NOT_FOUND");
}

async function scanForColdGuardDeviceOnce(expectedDeviceId: string) {
  return await new Promise<Device>((resolve, reject) => {
    let settled = false;
    let fallbackCandidate: Device | null = null;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        getBleManager().stopDeviceScan();
        if (fallbackCandidate) {
          resolve(fallbackCandidate);
          return;
        }
        reject(new Error("BLE_DEVICE_NOT_FOUND"));
      }
    }, SCAN_TIMEOUT_MS);

    getBleManager().startDeviceScan(
      null,
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

        if (!fallbackCandidate) {
          fallbackCandidate = device;
        }

        if (!doesDeviceMatchExpectedId(device, expectedDeviceId)) {
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientBleConnectionError(error: Error) {
  const normalized = error.message.trim().toLowerCase();
  return (
    normalized === "ble_device_id_mismatch" ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled") ||
    normalized.includes("not found") ||
    normalized.includes("discover") ||
    normalized.includes("gatt") ||
    normalized.includes("disconnected")
  );
}

function openCommandSession(device: Device): BleCommandSession {
  const pending = new Map<
    string,
    {
      reject: (error: Error) => void;
      resolve: (response: GenericBleResponse) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  const subscription = getBleManager().monitorCharacteristicForDevice(
    device.id,
    COLDGUARD_BLE_SERVICE_UUID,
    COLDGUARD_BLE_RESPONSE_CHARACTERISTIC_UUID,
    (error, characteristic) => {
      if (error) {
        const wrappedError = new Error(error.message);
        for (const entry of pending.values()) {
          clearTimeout(entry.timeout);
          entry.reject(wrappedError);
        }
        pending.clear();
        return;
      }

      if (!characteristic?.value) {
        return;
      }

      try {
        const response = decodeBleMessage(characteristic.value, isGenericBleResponse);
        const entry = pending.get(response.requestId);
        if (!entry) {
          return;
        }

        clearTimeout(entry.timeout);
        pending.delete(response.requestId);
        if (!response.ok) {
          entry.reject(new Error(response.errorCode ?? response.message ?? "BLE_COMMAND_FAILED"));
          return;
        }
        entry.resolve(response);
      } catch (nextError) {
        const wrappedError = nextError instanceof Error ? nextError : new Error("BLE_RESPONSE_INVALID");
        for (const entry of pending.values()) {
          clearTimeout(entry.timeout);
          entry.reject(wrappedError);
        }
        pending.clear();
      }
    },
  );

  return {
    close() {
      subscription.remove();
      for (const entry of pending.values()) {
        clearTimeout(entry.timeout);
        entry.reject(new Error("BLE_SESSION_CLOSED"));
      }
      pending.clear();
    },
    device,
    async sendCommand(command: string, body: Record<string, unknown>) {
      const requestId = `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const rawPayload = JSON.stringify({
        command,
        requestId,
        ...body,
      });
      const payload = encodeBleMessage({
        command,
        requestId,
        ...body,
      });

      async function writePayload(
        rawJsonPayload: string,
        expectedResponseId: string | null,
        commandLabel: string,
      ) {
        return await new Promise<GenericBleResponse | null>((resolve, reject) => {
          let timeout: ReturnType<typeof setTimeout> | null = null;

          if (expectedResponseId) {
            timeout = setTimeout(() => {
              pending.delete(expectedResponseId);
              reject(new Error(`BLE_RESPONSE_TIMEOUT_${commandLabel.toUpperCase().replace(/\./g, "_")}`));
            }, 8_000);

            pending.set(expectedResponseId, {
              reject,
              resolve,
              timeout,
            });
          }

          void device
            .writeCharacteristicWithResponseForService(
              COLDGUARD_BLE_SERVICE_UUID,
              COLDGUARD_BLE_COMMAND_CHARACTERISTIC_UUID,
              encodeBleMessage(JSON.parse(rawJsonPayload) as Record<string, unknown>),
            )
            .then(() => {
              if (!expectedResponseId) {
                resolve(null);
              }
            })
            .catch((error) => {
              if (timeout) {
                clearTimeout(timeout);
              }
              if (expectedResponseId) {
                pending.delete(expectedResponseId);
              }
              const message = error instanceof Error ? error.message : "BLE_WRITE_FAILED";
              reject(new Error(`${message} [${commandLabel}]`));
            });
        });
      }

      if (getUtf8ByteLength(payload) <= MAX_BLE_WRITE_BYTES) {
        return (await writePayload(rawPayload, requestId, command)) as GenericBleResponse;
      }

      const chunks = splitTransportPayload(payload);
      for (let index = 0; index < chunks.length; index += 1) {
        const chunkPayload = JSON.stringify({
          command: "transport.chunk",
          data: chunks[index],
          final: index === chunks.length - 1,
          requestId: `chunk-${requestId}-${index}`,
          transportId: requestId,
        });
        const expectedResponseId = index === chunks.length - 1 ? requestId : null;
        const response = await writePayload(chunkPayload, expectedResponseId, command);
        if (response) {
          return response;
        }
      }

      throw new Error(`BLE_CHUNK_DISPATCH_FAILED [${command}]`);
    },
  };
}

export const __testing = {
  createProofTimestamp,
  doesDeviceMatchExpectedId,
  getBleManager,
  isTransientBleConnectionError,
  splitTransportPayload,
  parseHelloResponse,
  parseWifiProvisionResponse,
  parseWifiTicketResponse,
};
