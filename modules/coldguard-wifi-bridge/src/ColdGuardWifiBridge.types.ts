export type ColdGuardWifiConnectionResult = {
  localIp: string;
  ssid: string;
};

export type ColdGuardMonitoringTransport = "ble_fallback" | "facility_wifi" | "softap";

export type ColdGuardMonitoringServiceOptions = {
  connectActionTicketJson?: string | null;
  deviceId: string;
  facilityWifiRuntimeBaseUrl?: string | null;
  handshakeToken?: string | null;
  softApPassword?: string | null;
  softApRuntimeBaseUrl?: string | null;
  softApSsid?: string | null;
  transport: ColdGuardMonitoringTransport;
};

export type ColdGuardMonitoringDeviceStatus = {
  deviceId: string;
  error: string | null;
  isRunning: boolean;
  transport: ColdGuardMonitoringTransport | null;
};

export type ColdGuardMonitoringStatusMap = Record<string, ColdGuardMonitoringDeviceStatus>;

export type ColdGuardWifiBridgeModuleContract = {
  connectToAccessPointAsync(ssid: string, password: string): Promise<ColdGuardWifiConnectionResult>;
  getMonitoringStatusesAsync(): Promise<ColdGuardMonitoringStatusMap>;
  releaseNetworkBindingAsync(): Promise<void>;
  startMonitoringDeviceAsync(options: ColdGuardMonitoringServiceOptions): Promise<ColdGuardMonitoringStatusMap>;
  stopMonitoringDeviceAsync(deviceId: string): Promise<ColdGuardMonitoringStatusMap>;
};

export type ColdGuardWifiBridgeViewProps = {
  onError?: (event: { nativeEvent: { message: string; url: string } }) => void;
  onLoad?: (event: { nativeEvent: { url: string } }) => void;
  style?: unknown;
  url?: string;
};
