import type { ColdGuardWifiBridgeModuleContract } from "./ColdGuardWifiBridge.types";

function createColdGuardWifiBridgeWebModule(): ColdGuardWifiBridgeModuleContract {
  return {
    async connectToAccessPointAsync() {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async getMonitoringServiceStatusAsync() {
      return {
        deviceId: null,
        error: null,
        isRunning: false,
        transport: null,
      };
    },
    async releaseNetworkBindingAsync() {
      return;
    },
    async startMonitoringServiceAsync() {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async stopMonitoringServiceAsync() {
      return {
        deviceId: null,
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
