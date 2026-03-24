import type { EventSubscription } from "expo-modules-core";

export type ColdGuardWifiConnectionResult = {
  localIp: string;
  ssid: string;
};

export type ColdGuardRuntimeFetchResult = {
  alertsJson: string;
  runtimeBaseUrl: string;
  statusJson: string;
};

export type ColdGuardEnrollmentStage =
  | "validating_request"
  | "finding_device"
  | "connecting_ble"
  | "discovering_services"
  | "establishing_secure_channel"
  | "completing_pairing"
  | "requesting_temporary_softap"
  | "connecting_softap"
  | "verifying_runtime"
  | "cleaning_up"
  | "completed"
  | "failed";

export type ColdGuardEnrollmentRequest = {
  actionTicketJson: string;
  bootstrapToken: string;
  connectActionTicketJson: string;
  deviceId: string;
  handshakeToken: string;
  institutionId: string;
  nickname: string;
};

export type ColdGuardEnrollmentProgressEvent = {
  attempt: number;
  detail: string | null;
  deviceId: string | null;
  elapsedMs: number;
  stage: ColdGuardEnrollmentStage;
  stageLabel: string;
};

export type ColdGuardEnrollmentDiagnostics = {
  attemptsByStageJson: string;
  detail: string | null;
  deviceId: string | null;
  failureStage: ColdGuardEnrollmentStage | null;
  rawErrorMessage: string | null;
  runtimeBaseUrl: string | null;
  ssid: string | null;
  timelineJson: string;
};

export type ColdGuardEnrollmentResult = {
  bleName: string;
  deviceId: string;
  diagnostics: ColdGuardEnrollmentDiagnostics;
  firmwareVersion: string;
  macAddress: string;
  protocolVersion: number;
  runtimeBaseUrl: string;
  smokeTestPassed: boolean;
  softApPassword: string;
  softApSsid: string;
};

export type ColdGuardWifiBridgeModuleEvents = {
  onEnrollmentStage(event: ColdGuardEnrollmentProgressEvent): void;
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
  addListener<EventName extends keyof ColdGuardWifiBridgeModuleEvents>(
    eventName: EventName,
    listener: ColdGuardWifiBridgeModuleEvents[EventName],
  ): EventSubscription;
  connectToAccessPointAsync(ssid: string, password: string): Promise<ColdGuardWifiConnectionResult>;
  fetchRuntimeSnapshotAsync(runtimeBaseUrl: string): Promise<ColdGuardRuntimeFetchResult>;
  getMonitoringStatusesAsync(): Promise<ColdGuardMonitoringStatusMap>;
  releaseNetworkBindingAsync(): Promise<void>;
  startEnrollmentAsync(options: ColdGuardEnrollmentRequest): Promise<ColdGuardEnrollmentResult>;
  startMonitoringDeviceAsync(options: ColdGuardMonitoringServiceOptions): Promise<ColdGuardMonitoringStatusMap>;
  stopMonitoringDeviceAsync(deviceId: string): Promise<ColdGuardMonitoringStatusMap>;
};

export type ColdGuardWifiBridgeViewProps = {
  onError?: (event: { nativeEvent: { message: string; url: string } }) => void;
  onLoad?: (event: { nativeEvent: { url: string } }) => void;
  style?: unknown;
  url?: string;
};
