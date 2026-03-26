import type {
  ColdGuardEnrollmentRequest,
  ColdGuardMonitoringDeviceStatus,
  ColdGuardMonitoringServiceOptions,
  ColdGuardMonitoringStatusMap,
  ColdGuardWifiBridgeModuleContract,
} from "./ColdGuardWifiBridge.types";

function createColdGuardWifiBridgeWebModule(): ColdGuardWifiBridgeModuleContract {
  return {
    addListener() {
      return {
        remove() {
          return;
        },
      };
    },
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
    async startEnrollmentAsync(_options: ColdGuardEnrollmentRequest) {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async startMonitoringDeviceAsync(
      _options: ColdGuardMonitoringServiceOptions,
    ): Promise<ColdGuardMonitoringStatusMap> {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async stopMonitoringDeviceAsync(deviceId: string) {
      const status: ColdGuardMonitoringDeviceStatus = {
        controlRole: null,
        deviceId,
        error: null,
        isRunning: false,
        primaryControllerUserId: null,
        primaryLeaseExpiresAt: null,
        primaryLeaseSessionId: null,
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
