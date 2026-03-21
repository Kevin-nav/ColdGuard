import type {
  ColdGuardMonitoringDeviceStatus,
  ColdGuardMonitoringServiceOptions,
  ColdGuardMonitoringStatusMap,
  ColdGuardWifiBridgeModuleContract,
} from "./ColdGuardWifiBridge.types";

function createColdGuardWifiBridgeWebModule(): ColdGuardWifiBridgeModuleContract {
  return {
    async connectToAccessPointAsync() {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async fetchRuntimeSnapshotAsync() {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async getMonitoringStatusesAsync() {
      return {};
    },
    async releaseNetworkBindingAsync() {
      return;
    },
    async startMonitoringDeviceAsync(
      _options: ColdGuardMonitoringServiceOptions,
    ): Promise<ColdGuardMonitoringStatusMap> {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async stopMonitoringDeviceAsync(deviceId: string) {
      const status: ColdGuardMonitoringDeviceStatus = {
        deviceId,
        error: null,
        isRunning: false,
        transport: null,
      };
      const statuses: ColdGuardMonitoringStatusMap = {
        [deviceId]: status,
      };
      return statuses;
    },
  };
}

export function getColdGuardWifiBridgeModule() {
  return createColdGuardWifiBridgeWebModule();
}

export default getColdGuardWifiBridgeModule;
