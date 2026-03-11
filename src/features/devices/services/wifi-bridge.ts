import { Platform } from "react-native";
import getColdGuardWifiBridgeModule from "../../../../modules/coldguard-wifi-bridge";
import type { ColdGuardWifiTicket } from "../types";

export type ColdGuardWifiBridge = {
  connect(ticket: ColdGuardWifiTicket): Promise<{ localIp: string; ssid: string }>;
  release(): Promise<void>;
};

export function createColdGuardWifiBridge(): ColdGuardWifiBridge {
  const wifiBridgeModule = Platform.OS === "android" ? getColdGuardWifiBridgeModule() : null;

  if (Platform.OS === "android" && wifiBridgeModule?.connectToAccessPointAsync) {
    return {
      connect: (ticket) =>
        wifiBridgeModule.connectToAccessPointAsync(ticket.ssid, ticket.password),
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
