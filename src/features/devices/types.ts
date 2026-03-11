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
  state: "blank" | "enrolled" | "pending";
};

export type ColdGuardWifiTicket = {
  expiresAt: number;
  password: string;
  ssid: string;
  testUrl: string;
};

export type ColdGuardConnectionPayload = {
  batteryLevel: number;
  currentTempC: number;
  doorOpen: boolean;
  firmwareVersion: string;
  lastSeenAt: number;
  macAddress: string;
  mktStatus: "safe" | "warning" | "alert";
  statusText: string;
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
