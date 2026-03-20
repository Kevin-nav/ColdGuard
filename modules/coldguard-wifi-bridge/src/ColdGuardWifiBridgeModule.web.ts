import type { ColdGuardWifiBridgeModuleContract } from "./ColdGuardWifiBridge.types";

function createColdGuardWifiBridgeWebModule(): ColdGuardWifiBridgeModuleContract {
  return {
    async connectToAccessPointAsync() {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async getMonitoringStatusesAsync() {
      return {};
    },
    async releaseNetworkBindingAsync() {
      return;
    },
    async startMonitoringDeviceAsync() {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async stopMonitoringDeviceAsync(deviceId: string) {
      return {
        deviceId,
        error: null,
        isRunning: false,
        transport: null,
      };
    },
  };
}

export function getColdGuardWifiBridgeModule() {
  return createColdGuardWifiBridgeWebModule();
}

export default getColdGuardWifiBridgeModule;
