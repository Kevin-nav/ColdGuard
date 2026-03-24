export type DeviceAssignmentCandidate = {
  displayName: string;
  role: string;
  staffId: string;
  userId?: string;
};

export type AssignableNurse = DeviceAssignmentCandidate & {
  userId: string;
};

export type CachedConnectionGrant = {
  alg?: "ES256";
  deviceId: string;
  exp: number;
  grantVersion: number;
  institutionId: string;
  iss?: string;
  issuedToFirebaseUid: string;
  kid?: string;
  permission: "connect" | "manage";
  role: string;
  scope?: "connect" | "manage";
  sub?: string;
  token: string;
  v: number;
};

export type ColdGuardConnectionGrant = CachedConnectionGrant;

export type DeviceAction =
  | "connect"
  | "decommission"
  | "enroll"
  | "reassign"
  | "wifi_provision";

export type CachedDeviceActionTicket = {
  action: DeviceAction;
  counter: number;
  deviceId: string;
  expiresAt: number;
  institutionId: string;
  issuedAt: number;
  mac: string;
  operatorId?: string;
  ticketId: string;
  v: number;
};

export type ColdGuardDiscoveredDevice = {
  bleName: string;
  bootstrapClaim: string;
  deviceId: string;
  firmwareVersion: string;
  macAddress: string;
  protocolVersion: number;
  state: "blank" | "ready" | "enrolled" | "pending";
};

export type ColdGuardWifiTicket = {
  expiresAt: number;
  password: string;
  ssid: string;
  testUrl: string;
};

export type RuntimeTransportMode = "facility_wifi" | "softap" | "ble_fallback";

export type RuntimeSessionStatus = "idle" | "connecting" | "connected" | "recovering" | "failed";

export type MonitoringMode = "off" | "foreground_service";

export type FacilityWifiProvisioning = {
  password: string;
  runtimeBaseUrl: string;
  ssid: string;
};

export type RuntimeAlertRecord = {
  body: string;
  cursor: string;
  incidentType: "battery_low" | "device_offline" | "door_open" | "temperature";
  severity: "critical" | "warning";
  status: "open" | "resolved";
  title: string;
  triggeredAt: number;
};

export type DeviceRuntimeSnapshot = ColdGuardConnectionPayload & {
  alerts: RuntimeAlertRecord[];
  localIp: string | null;
  receivedAt: number;
  runtimeBaseUrl: string;
  ssid: string | null;
  transport: RuntimeTransportMode;
};

export type DeviceRuntimeConfig = {
  activeRuntimeBaseUrl: string | null;
  activeTransport: RuntimeTransportMode | null;
  deviceId: string;
  facilityWifiPassword: string | null;
  facilityWifiRuntimeBaseUrl: string | null;
  facilityWifiSsid: string | null;
  softApPassword: string | null;
  softApRuntimeBaseUrl: string | null;
  softApSsid: string | null;
  lastMonitorAt: number | null;
  lastMonitorError: string | null;
  lastPingAt: number | null;
  lastRecoverAt: number | null;
  lastRuntimeError: string | null;
  monitoringMode: MonitoringMode;
  sessionStatus: RuntimeSessionStatus;
  updatedAt: number;
};

export type ColdGuardConnectionPayload = {
  accessMode?: "bluetooth_primary" | "facility_runtime" | "runtime_recovery" | "temporary_shared_access";
  batteryLevel: number;
  currentTempC: number;
  doorOpen: boolean;
  firmwareVersion: string;
  lastSeenAt: number;
  macAddress: string;
  mktStatus: "safe" | "warning" | "alert";
  primaryTransport?: "bluetooth";
  secondaryTransport?: "softap" | null;
  softApAvailable?: boolean;
  softApClientCount?: number;
  softApIdleTimeoutMs?: number;
  statusText: string;
  transport?: RuntimeTransportMode;
};

export type RemoteManagedDevice = {
  assignmentRole?: "primary" | "viewer";
  bleName: string;
  deviceId: string;
  deviceStatus?: "enrolled" | "decommissioned";
  firmwareVersion: string;
  grantVersion: number;
  institutionId?: string;
  institutionName?: string;
  lastConnectionTestAt: number | null;
  lastConnectionTestStatus?: "idle" | "failed" | "success" | null;
  lastSeenAt: number;
  macAddress?: string;
  nickname: string;
  primaryAssigneeName: string | null;
  primaryStaffId: string | null;
  protocolVersion?: number;
  status: "active" | "decommissioned";
  viewerAssignments: { displayName: string; staffId: string }[];
  viewerNames?: string[];
};
