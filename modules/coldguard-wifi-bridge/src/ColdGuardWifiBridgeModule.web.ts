import type { ColdGuardWifiBridgeModuleContract } from "./ColdGuardWifiBridge.types";

function createColdGuardWifiBridgeWebModule(): ColdGuardWifiBridgeModuleContract {
  return {
    async connectToAccessPointAsync() {
      throw new Error("WIFI_BRIDGE_UNAVAILABLE");
    },
    async releaseNetworkBindingAsync() {
      return;
    },
  };
}

export function getColdGuardWifiBridgeModule() {
  return createColdGuardWifiBridgeWebModule();
}

export default getColdGuardWifiBridgeModule;
