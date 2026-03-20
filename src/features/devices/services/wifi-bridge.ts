import { Platform } from "react-native";
import getColdGuardWifiBridgeModule from "../../../../modules/coldguard-wifi-bridge";
import type {
  ColdGuardMonitoringServiceOptions,
  ColdGuardMonitoringStatusMap,
} from "../../../../modules/coldguard-wifi-bridge";
import type { ColdGuardWifiTicket } from "../types";

export type ColdGuardWifiBridge = {
  connect(ticket: ColdGuardWifiTicket): Promise<{ localIp: string; ssid: string }>;
  release(): Promise<void>;
};

export function createColdGuardWifiBridge(): ColdGuardWifiBridge {
  const wifiBridgeModule = Platform.OS === "android" ? getColdGuardWifiBridgeModule() : null;

  if (Platform.OS === "android" && wifiBridgeModule?.connectToAccessPointAsync) {
    return {
      connect: (ticket) => wifiBridgeModule.connectToAccessPointAsync(ticket.ssid, ticket.password),
      release: async () => {
        if (wifiBridgeModule.releaseNetworkBindingAsync) {
          await wifiBridgeModule.releaseNetworkBindingAsync();
        }
      },
    };
  }

  return {
    async connect() {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async release() {
      return;
    },
  };
}

export async function startNativeMonitoringDevice(
  options: ColdGuardMonitoringServiceOptions,
): Promise<ColdGuardMonitoringStatusMap> {
  const wifiBridgeModule = Platform.OS === "android" ? getColdGuardWifiBridgeModule() : null;
  if (!wifiBridgeModule?.startMonitoringDeviceAsync) {
    throw new Error("WIFI_BRIDGE_MONITORING_UNAVAILABLE");
  }
  return await wifiBridgeModule.startMonitoringDeviceAsync(options);
}

export async function stopNativeMonitoringDevice(deviceId: string): Promise<ColdGuardMonitoringStatusMap> {
  const wifiBridgeModule = Platform.OS === "android" ? getColdGuardWifiBridgeModule() : null;
  if (!wifiBridgeModule?.stopMonitoringDeviceAsync) {
    return {};
  }
  return await wifiBridgeModule.stopMonitoringDeviceAsync(deviceId);
}

export async function getNativeMonitoringServiceStatuses(): Promise<ColdGuardMonitoringStatusMap> {
  const wifiBridgeModule = Platform.OS === "android" ? getColdGuardWifiBridgeModule() : null;
  if (!wifiBridgeModule?.getMonitoringStatusesAsync) {
    return {};
  }
  return await wifiBridgeModule.getMonitoringStatusesAsync();
}
