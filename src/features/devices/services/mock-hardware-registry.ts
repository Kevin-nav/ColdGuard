import type {
  ColdGuardConnectionGrant,
  ColdGuardConnectionPayload,
  ColdGuardDiscoveredDevice,
  ColdGuardWifiTicket,
} from "../types";

type MockHardwareDevice = {
  bleName: string;
  bootstrapClaim: string;
  deviceId: string;
  firmwareVersion: string;
  institutionId: string | null;
  nickname: string;
  protocolVersion: number;
  state: "blank" | "enrolled";
};

const DEFAULT_MOCK_DEVICES: MockHardwareDevice[] = [
  {
    bleName: "ColdGuard_A100",
    bootstrapClaim: "claim-alpha-100",
    deviceId: "CG-ESP32-A100",
    firmwareVersion: "fw-1.0.0",
    institutionId: null,
    nickname: "Cold Room Alpha",
    protocolVersion: 1,
    state: "blank",
  },
  {
    bleName: "ColdGuard_B200",
    bootstrapClaim: "claim-bravo-200",
    deviceId: "CG-ESP32-B200",
    firmwareVersion: "fw-1.0.0",
    institutionId: null,
    nickname: "Carrier Bravo",
    protocolVersion: 1,
    state: "blank",
  },
];

const hardwareDevices = new Map(DEFAULT_MOCK_DEVICES.map((device) => [device.deviceId, { ...device }]));

export function resetMockHardwareRegistry() {
  hardwareDevices.clear();
  DEFAULT_MOCK_DEVICES.forEach((device) => {
    hardwareDevices.set(device.deviceId, { ...device });
  });
}

export function discoverMockHardwareDevice(deviceId: string): ColdGuardDiscoveredDevice {
  const device = hardwareDevices.get(deviceId);
  if (!device) {
    throw new Error("MOCK_DEVICE_NOT_FOUND");
  }

  return {
    bleName: device.bleName,
    bootstrapClaim: device.bootstrapClaim,
    deviceId: device.deviceId,
    firmwareVersion: device.firmwareVersion,
    macAddress: `MOCK-${device.deviceId.slice(-4)}`,
    protocolVersion: device.protocolVersion,
    state: device.state,
  };
}

export function claimMockHardwareDevice(args: {
  bootstrapClaim: string;
  deviceId: string;
  institutionId: string;
  nickname: string;
}) {
  const device = hardwareDevices.get(args.deviceId);
  if (!device || device.bootstrapClaim !== args.bootstrapClaim) {
    throw new Error("MOCK_DEVICE_CLAIM_INVALID");
  }

  device.institutionId = args.institutionId;
  device.nickname = args.nickname.trim();
  device.state = "enrolled";

  return discoverMockHardwareDevice(args.deviceId);
}

export function runMockConnectionTest(args: {
  deviceId: string;
  grant: ColdGuardConnectionGrant;
  institutionId: string;
}): { payload: ColdGuardConnectionPayload; ticket: ColdGuardWifiTicket } {
  const device = hardwareDevices.get(args.deviceId);
  if (!device) {
    throw new Error("MOCK_DEVICE_ACCESS_DENIED");
  }

  if (args.grant.deviceId !== args.deviceId || args.grant.institutionId !== args.institutionId) {
    throw new Error("MOCK_GRANT_INVALID");
  }

  device.state = "enrolled";
  device.institutionId = args.institutionId;

  const now = Date.now();
  return {
    payload: {
      batteryLevel: 89,
      currentTempC: 4.7,
      doorOpen: false,
      firmwareVersion: device.firmwareVersion,
      lastSeenAt: now,
      macAddress: `MOCK-${device.deviceId.slice(-4)}`,
      mktStatus: "safe",
      statusText: "Mock BLE-to-WiFi handover completed.",
    },
    ticket: {
      expiresAt: now + 60_000,
      password: `${device.deviceId.slice(-4)}-wifi`,
      ssid: `ColdGuard_${device.deviceId.slice(-4)}`,
      testUrl: "http://192.168.4.1/api/v1/connection-test",
    },
  };
}

export function decommissionMockHardwareDevice(deviceId: string) {
  const device = hardwareDevices.get(deviceId);
  if (!device) {
    throw new Error("MOCK_DEVICE_NOT_FOUND");
  }

  device.institutionId = null;
  device.state = "blank";
}
