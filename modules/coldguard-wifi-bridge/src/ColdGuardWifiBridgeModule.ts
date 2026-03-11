import { requireNativeModule } from "expo";
import type { ColdGuardWifiBridgeModuleContract } from "./ColdGuardWifiBridge.types";

let cachedModule: ColdGuardWifiBridgeModuleContract | null | undefined;

function isMissingNativeModuleError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error.message ?? "";

  return (
    code === "MODULE_NOT_FOUND" ||
    code === "ERR_UNAVAILABLE" ||
    message.includes("Cannot find native module") ||
    message.includes("Could not find the module") ||
    message.includes("MODULE_NOT_FOUND")
  );
}

export function getColdGuardWifiBridgeModule() {
  if (cachedModule === undefined) {
    try {
      cachedModule = requireNativeModule<ColdGuardWifiBridgeModuleContract>("ColdGuardWifiBridge");
    } catch (error) {
      if (!isMissingNativeModuleError(error)) {
        throw error;
      }
      cachedModule = null;
    }
  }

  return cachedModule;
}

export default getColdGuardWifiBridgeModule;
