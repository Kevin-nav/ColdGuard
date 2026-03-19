export type ColdGuardWifiConnectionResult = {
  localIp: string;
  ssid: string;
};

export type ColdGuardMonitoringServiceOptions = {
  connectActionTicketJson?: string | null;
  deviceId: string;
  facilityWifiRuntimeBaseUrl?: string | null;
  handshakeToken?: string | null;
  softApPassword?: string | null;
  softApRuntimeBaseUrl?: string | null;
  softApSsid?: string | null;
  transport: "ble_fallback" | "facility_wifi" | "softap";
};

export type ColdGuardMonitoringServiceStatus = {
  deviceId: string | null;
  error: string | null;
  isRunning: boolean;
  transport: "ble_fallback" | "facility_wifi" | "softap" | null;
};

export type ColdGuardWifiBridgeModuleContract = {
  connectToAccessPointAsync(ssid: string, password: string): Promise<ColdGuardWifiConnectionResult>;
  getMonitoringServiceStatusAsync(): Promise<ColdGuardMonitoringServiceStatus>;
  releaseNetworkBindingAsync(): Promise<void>;
  startMonitoringServiceAsync(options: ColdGuardMonitoringServiceOptions): Promise<ColdGuardMonitoringServiceStatus>;
  stopMonitoringServiceAsync(): Promise<ColdGuardMonitoringServiceStatus>;
};

export type ColdGuardWifiBridgeViewProps = {
  onError?: (event: { nativeEvent: { message: string; url: string } }) => void;
  onLoad?: (event: { nativeEvent: { url: string } }) => void;
  style?: unknown;
  url?: string;
};
