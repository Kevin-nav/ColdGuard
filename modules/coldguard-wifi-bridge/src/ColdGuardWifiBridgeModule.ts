import { requireNativeModule } from "expo";
import type { ColdGuardWifiBridgeModuleContract } from "./ColdGuardWifiBridge.types";

let cachedModule: ColdGuardWifiBridgeModuleContract | null | undefined;

export function getColdGuardWifiBridgeModule() {
  if (cachedModule === undefined) {
    try {
      cachedModule = requireNativeModule<ColdGuardWifiBridgeModuleContract>("ColdGuardWifiBridge");
    } catch {
      cachedModule = null;
    }
  }

  return cachedModule;
}

export default getColdGuardWifiBridgeModule;
