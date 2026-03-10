export type ColdGuardWifiConnectionResult = {
  localIp: string;
  ssid: string;
};

export type ColdGuardWifiBridgeModuleContract = {
  connectToAccessPointAsync(ssid: string, password: string): Promise<ColdGuardWifiConnectionResult>;
  releaseNetworkBindingAsync(): Promise<void>;
};

export type ColdGuardWifiBridgeViewProps = {
  onError?: (event: { nativeEvent: { message: string; url: string } }) => void;
  onLoad?: (event: { nativeEvent: { url: string } }) => void;
  style?: unknown;
  url?: string;
};
