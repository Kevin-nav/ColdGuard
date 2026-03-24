import { Platform } from "react-native";
import getColdGuardWifiBridgeModule from "../../../../modules/coldguard-wifi-bridge";
import type {
  ColdGuardEnrollmentProgressEvent,
  ColdGuardEnrollmentRequest,
  ColdGuardEnrollmentResult,
  ColdGuardMonitoringServiceOptions,
  ColdGuardMonitoringStatusMap,
  ColdGuardRuntimeFetchResult,
} from "../../../../modules/coldguard-wifi-bridge";
import type { EventSubscription } from "expo-modules-core";
import type { ColdGuardWifiTicket } from "../types";

export type ColdGuardWifiBridge = {
  connect(ticket: ColdGuardWifiTicket): Promise<{ localIp: string; ssid: string }>;
  fetchRuntimeSnapshot?(runtimeBaseUrl: string): Promise<ColdGuardRuntimeFetchResult>;
  release(): Promise<void>;
};

export function createColdGuardWifiBridge(): ColdGuardWifiBridge {
  const wifiBridgeModule = Platform.OS === "android" ? getColdGuardWifiBridgeModule() : null;

  if (Platform.OS === "android" && wifiBridgeModule?.connectToAccessPointAsync) {
    const bridge: ColdGuardWifiBridge = {
      connect: (ticket) => wifiBridgeModule.connectToAccessPointAsync(ticket.ssid, ticket.password),
      release: async () => {
        await wifiBridgeModule.releaseNetworkBindingAsync?.();
      },
    };

    if (wifiBridgeModule.fetchRuntimeSnapshotAsync) {
      bridge.fetchRuntimeSnapshot = (runtimeBaseUrl) => wifiBridgeModule.fetchRuntimeSnapshotAsync(runtimeBaseUrl);
    }

    return bridge;
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

export async function startNativeEnrollment(
  options: ColdGuardEnrollmentRequest,
): Promise<ColdGuardEnrollmentResult> {
  const wifiBridgeModule = Platform.OS === "android" ? getColdGuardWifiBridgeModule() : null;
  if (!wifiBridgeModule?.startEnrollmentAsync) {
    throw new Error("WIFI_BRIDGE_ENROLLMENT_UNAVAILABLE");
  }
  return await wifiBridgeModule.startEnrollmentAsync(options);
}

export function subscribeToNativeEnrollmentStages(
  listener: (event: ColdGuardEnrollmentProgressEvent) => void,
): EventSubscription | null {
  const wifiBridgeModule = Platform.OS === "android" ? getColdGuardWifiBridgeModule() : null;
  if (!wifiBridgeModule?.addListener) {
    return null;
  }
  return wifiBridgeModule.addListener("onEnrollmentStage", listener);
}
