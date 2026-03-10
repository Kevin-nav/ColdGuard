import { deleteConnectionGrant } from "../../../lib/storage/sqlite/connection-grant-repository";
import {
  getDeviceById,
  saveDeviceConnectionSnapshot,
  updateDeviceConnectionTestStatus,
} from "../../../lib/storage/sqlite/device-repository";
import type { ProfileSnapshot } from "../../../lib/storage/sqlite/profile-repository";
import { getClinicHandshakeToken } from "../../../lib/storage/secure-store";
import type {
  CachedConnectionGrant,
  ColdGuardConnectionPayload,
  ColdGuardDiscoveredDevice,
  ColdGuardWifiTicket,
} from "../types";
import { RealColdGuardBleClient } from "./ble-client";
import {
  claimMockHardwareDevice,
  decommissionMockHardwareDevice,
  discoverMockHardwareDevice,
} from "./mock-hardware-registry";
import { createColdGuardWifiBridge } from "./wifi-bridge";
import {
  assignDeviceUsers,
  decommissionManagedDevice,
  ensureDeviceConnectionGrant,
  ensureSupervisorAdminGrant,
  recordDeviceConnectionTest,
  registerEnrolledDevice,
} from "./device-directory";

export type ConnectionTestPayload = ColdGuardConnectionPayload & {
  localIp: string;
  receivedAt: number;
  ssid: string;
  testUrl: string;
};

export interface ColdGuardBleClient {
  discoverDevice(args: { deviceId: string; expectedState: "blank" | "enrolled" }): Promise<ColdGuardDiscoveredDevice>;
  enrollDevice(args: {
    adminGrant: CachedConnectionGrant;
    bootstrapToken: string;
    deviceId: string;
    handshakeToken: string;
    institutionId: string;
    nickname: string;
  }): Promise<ColdGuardDiscoveredDevice>;
  requestWifiTicket(args: {
    deviceId: string;
    grant: CachedConnectionGrant;
    handshakeToken: string;
  }): Promise<ColdGuardWifiTicket>;
  decommissionDevice(args: {
    adminGrant: CachedConnectionGrant;
    deviceId: string;
    handshakeToken: string;
  }): Promise<void>;
}

export interface ColdGuardWifiBridge {
  connect(ticket: ColdGuardWifiTicket): Promise<{ localIp: string; ssid: string }>;
  release(): Promise<void>;
}

export function parseDeviceQrPayload(qrPayload: string) {
  const normalized = qrPayload.trim();
  const match = normalized.match(/^coldguard:\/\/device\/([^?]+)\?claim=([^&]+)&v=1$/);
  if (!match) {
    throw new Error("INVALID_DEVICE_QR_PAYLOAD");
  }

  return {
    bootstrapToken: decodeURIComponent(match[2]),
    deviceId: decodeURIComponent(match[1]),
  };
}

export class MockColdGuardBleClient implements ColdGuardBleClient {
  async discoverDevice(args: { deviceId: string; expectedState: "blank" | "enrolled" }) {
    await delay(120);
    const device = discoverMockHardwareDevice(args.deviceId);
    if (args.expectedState === "blank" && device.state !== "blank") {
      throw new Error("MOCK_DEVICE_STATE_MISMATCH");
    }
    return device;
  }

  async enrollDevice(args: {
    adminGrant: CachedConnectionGrant;
    bootstrapToken: string;
    deviceId: string;
    handshakeToken: string;
    institutionId: string;
    nickname: string;
  }) {
    if (!args.adminGrant.token || !args.handshakeToken) {
      throw new Error("DEVICE_ENROLLMENT_AUTH_FAILED");
    }

    await delay(120);
    return claimMockHardwareDevice({
      bootstrapClaim: args.bootstrapToken,
      deviceId: args.deviceId,
      institutionId: args.institutionId,
      nickname: args.nickname,
    });
  }

  async requestWifiTicket(args: {
    deviceId: string;
    grant: CachedConnectionGrant;
    handshakeToken: string;
  }) {
    if (!args.handshakeToken || !args.grant.token) {
      throw new Error("DEVICE_CONNECTION_AUTH_FAILED");
    }

    await delay(120);
    return {
      expiresAt: Date.now() + 60_000,
      password: `${args.deviceId.slice(-4)}-wifi`,
      ssid: `ColdGuard_${args.deviceId.slice(-4)}`,
      testUrl: "http://192.168.4.1/api/v1/connection-test",
    };
  }

  async decommissionDevice(args: {
    adminGrant: CachedConnectionGrant;
    deviceId: string;
    handshakeToken: string;
  }) {
    if (!args.handshakeToken || !args.adminGrant.token) {
      throw new Error("DEVICE_DECOMMISSION_AUTH_FAILED");
    }

    await delay(120);
    decommissionMockHardwareDevice(args.deviceId);
  }
}

const realBleClient = new RealColdGuardBleClient();

export async function enrollColdGuardDevice(args: {
  nickname: string;
  profile: ProfileSnapshot;
  qrPayload: string;
  bleClient?: ColdGuardBleClient;
}) {
  if (args.profile.role !== "Supervisor") {
    throw new Error("DEVICE_MANAGEMENT_FORBIDDEN");
  }

  const handshakeToken = await getRequiredClinicHandshakeToken();
  const { bootstrapToken, deviceId } = parseDeviceQrPayload(args.qrPayload);
  const bleClient = args.bleClient ?? realBleClient;
  const adminGrant = await ensureSupervisorAdminGrant(args.profile, deviceId);

  await bleClient.discoverDevice({ deviceId, expectedState: "blank" });
  const enrolledDevice = await bleClient.enrollDevice({
    adminGrant,
    bootstrapToken,
    deviceId,
    handshakeToken,
    institutionId: args.profile.institutionId,
    nickname: args.nickname.trim(),
  });

  return await registerEnrolledDevice({
    bleName: enrolledDevice.bleName,
    deviceId: enrolledDevice.deviceId,
    firmwareVersion: enrolledDevice.firmwareVersion,
    macAddress: enrolledDevice.macAddress,
    nickname: args.nickname.trim() || `ColdGuard ${enrolledDevice.deviceId.slice(-4).toUpperCase()}`,
    protocolVersion: enrolledDevice.protocolVersion,
  });
}

export async function runColdGuardConnectionTest(args: {
  deviceId: string;
  bleClient?: ColdGuardBleClient;
  wifiBridge?: ColdGuardWifiBridge;
}) {
  const device = await getDeviceById(args.deviceId);
  if (!device) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  const testedAt = Date.now();
  await updateDeviceConnectionTestStatus({
    deviceId: args.deviceId,
    testedAt,
    status: "running",
  });

  try {
    const handshakeToken = await getRequiredClinicHandshakeToken();
    const grant = await ensureDeviceConnectionGrant(args.deviceId);
    const bleClient = args.bleClient ?? realBleClient;
    const wifiBridge = args.wifiBridge ?? createColdGuardWifiBridge();

    try {
      await bleClient.discoverDevice({
        deviceId: args.deviceId,
        expectedState: "enrolled",
      });
      const ticket = await bleClient.requestWifiTicket({
        deviceId: args.deviceId,
        grant,
        handshakeToken,
      });
      const network = await wifiBridge.connect(ticket);
      const response = await fetch(ticket.testUrl);
      if (!response.ok) {
        throw new Error(`HTTP_CONNECTION_TEST_FAILED_${response.status}`);
      }
      const remotePayload = (await response.json()) as ColdGuardConnectionPayload & {
        institutionId?: string;
        nickname?: string;
      };

      const payload: ConnectionTestPayload = {
        ...remotePayload,
        localIp: network.localIp,
        receivedAt: Date.now(),
        ssid: ticket.ssid,
        testUrl: ticket.testUrl,
      };

      await saveDeviceConnectionSnapshot(args.deviceId, {
        batteryLevel: payload.batteryLevel,
        currentTempC: payload.currentTempC,
        doorOpen: payload.doorOpen,
        lastConnectionTestAt: payload.receivedAt,
        lastConnectionTestStatus: "success",
        lastSeenAt: payload.lastSeenAt,
        macAddress: payload.macAddress,
        mktStatus: payload.mktStatus,
      });

      await updateDeviceConnectionTestStatus({
        deviceId: args.deviceId,
        testedAt: payload.receivedAt,
        status: "success",
      });

      try {
        await recordDeviceConnectionTest({
          deviceId: args.deviceId,
          lastSeenAt: payload.lastSeenAt,
          summary: payload.statusText,
          status: "success",
          transport: "ble+wifi",
        });
      } catch {
        // Keep the local success result even if backend audit logging is temporarily unavailable.
      }

      return payload;
    } finally {
      await wifiBridge.release().catch(() => undefined);
    }
  } catch (error) {
    await updateDeviceConnectionTestStatus({
      deviceId: args.deviceId,
      testedAt: Date.now(),
      status: "failed",
    });

    try {
      await recordDeviceConnectionTest({
        deviceId: args.deviceId,
        summary: error instanceof Error ? error.message : "Connection test failed.",
        status: "failed",
        transport: "ble+wifi",
      });
    } catch {
      // Preserve the local failure state even if backend audit logging is unavailable.
    }

    throw error;
  }
}

export async function assignColdGuardDevice(args: {
  deviceId: string;
  primaryStaffId: string | null;
  viewerStaffIds: string[];
}) {
  if (!args.primaryStaffId) {
    throw new Error("PRIMARY_ASSIGNEE_REQUIRED");
  }

  return await assignDeviceUsers({
    deviceId: args.deviceId,
    primaryStaffId: args.primaryStaffId,
    viewerStaffIds: args.viewerStaffIds.filter((staffId) => staffId !== args.primaryStaffId),
  });
}

export async function decommissionColdGuardDevice(args: {
  deviceId: string;
  profile: ProfileSnapshot;
  bleClient?: ColdGuardBleClient;
}) {
  if (args.profile.role !== "Supervisor") {
    throw new Error("DEVICE_MANAGEMENT_FORBIDDEN");
  }

  const bleClient = args.bleClient ?? realBleClient;
  const handshakeToken = await getRequiredClinicHandshakeToken();
  const adminGrant = await ensureSupervisorAdminGrant(args.profile, args.deviceId);

  await bleClient.decommissionDevice({
    adminGrant,
    deviceId: args.deviceId,
    handshakeToken,
  });
  await decommissionManagedDevice(args.deviceId);
  await deleteConnectionGrant("admin", args.deviceId);
  await deleteConnectionGrant("device", args.deviceId);
}

async function getRequiredClinicHandshakeToken() {
  const handshakeToken = await getClinicHandshakeToken();
  if (!handshakeToken) {
    throw new Error("CLINIC_HANDSHAKE_TOKEN_MISSING");
  }
  return handshakeToken;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
