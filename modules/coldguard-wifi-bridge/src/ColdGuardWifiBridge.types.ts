export type ColdGuardWifiConnectionResult = {
  localIp: string;
  ssid: string;
};

export type ColdGuardWifiBridgeModuleContract = {
  connectToAccessPointAsync(ssid: string, password: string): Promise<ColdGuardWifiConnectionResult>;
  releaseNetworkBindingAsync(): Promise<void>;
};

export type ColdGuardWifiBridgeViewProps = {
  onLoad?: (event: { nativeEvent: { url: string } }) => void;
  style?: unknown;
  url?: string;
};
