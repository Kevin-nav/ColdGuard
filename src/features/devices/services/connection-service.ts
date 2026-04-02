import { PermissionsAndroid, Platform } from "react-native";
import { api } from "../../../../convex/_generated/api";
import {
  deleteConnectionGrant,
  deleteDeviceActionTicket,
} from "../../../lib/storage/sqlite/connection-grant-repository";
import { getConvexClient } from "../../../lib/convex/client";
import {
  getDeviceById,
  saveDeviceConnectionSnapshot,
  upsertLocalQuickConnectDevice,
  updateDeviceConnectionSyncState,
  updateDeviceConnectionTestStatus,
} from "../../../lib/storage/sqlite/device-repository";
import { getReadingsAfterSequenceForDevice, saveReadings } from "../../../lib/storage/sqlite/reading-repository";
import {
  deleteDeviceRuntimeConfig,
  getDeviceRuntimeConfig,
  upsertDeviceRuntimeConfig,
} from "../../../lib/storage/sqlite/device-runtime-repository";
import type { ProfileSnapshot } from "../../../lib/storage/sqlite/profile-repository";
import { getProfileSnapshot } from "../../../lib/storage/sqlite/profile-repository";
import { getClinicHandshakeToken, getOrCreateMonitoringClientId } from "../../../lib/storage/secure-store";
import {
  deleteSyncJob,
  enqueueSyncJob,
  listPendingSyncJobs,
  setSyncJobStatus,
} from "../../../lib/storage/sqlite/sync-job-repository";
import type {
  CachedDeviceActionTicket,
  DeviceControlRole,
  DeviceRuntimeConfig,
  ColdGuardConnectionPayload,
  ColdGuardDiscoveredDevice,
  ColdGuardWifiTicket,
  DeviceTelemetryReadingRecord,
  DeviceRuntimeSnapshot,
  FacilityWifiProvisioning,
  RuntimeAlertRecord,
  RuntimeTransportMode,
} from "../types";
import type { ColdGuardEnrollmentProgressEvent } from "../../../../modules/coldguard-wifi-bridge";
import { RealColdGuardBleClient } from "./ble-client";
import {
  claimMockHardwareDevice,
  decommissionMockHardwareDevice,
  discoverMockHardwareDevice,
  provisionMockHardwareWifi,
} from "./mock-hardware-registry";
import {
  createColdGuardWifiBridge,
  getNativeMonitoringServiceStatuses,
  startNativeEnrollment,
  startNativeMonitoringDevice,
  stopNativeMonitoringDevice,
  subscribeToNativeEnrollmentStages,
} from "./wifi-bridge";
import { getLocalNotificationPermissionStatus, requestLocalNotificationPermission } from "../../notifications/services/local-notifications";
import {
  assignDeviceUsers,
  decommissionManagedDevice,
  ensureDeviceActionTicket,
  ensureSupervisorActionTicket,
  recordDeviceConnectionTest,
  registerEnrolledDevice,
  syncVisibleDevices,
} from "./device-directory";

export type ConnectionTestPayload = DeviceRuntimeSnapshot;

type ConnectionSyncJobPayload = {
  deviceId: string;
  lastSeenAt?: number;
  status: "failed" | "success";
  summary: string;
  transport: string;
};

type RemoteConnectionPayload = Omit<ColdGuardConnectionPayload, "lastSeenAt"> & {
  alerts?: RuntimeAlertRecord[];
  institutionId?: string;
  lastSeenAgeMs?: number;
  lastSeenAt?: number;
  nickname?: string;
  runtimeBaseUrl?: string;
};

const DEVICE_CONNECTION_SYNC_JOB_TYPE = "device_connection_test_reconciliation";
const MONITORING_NOTIFICATION_PERMISSION_ERROR =
  "Allow notifications to start ColdGuard background monitoring on this device.";
const FACILITY_WIFI_PROOF_WINDOW_MS = 15 * 60 * 1000;
const PRIMARY_LEASE_HEARTBEAT_INTERVAL_MS = 10_000;
const PRIMARY_LEASE_DURATION_MS = 35_000;
const ENROLLMENT_IN_PROGRESS_ERROR = "ENROLLMENT_IN_PROGRESS";
let enrollmentInProgress = false;

function getMonitoringStatusForDevice(
  statuses: Record<
    string,
    {
      controlRole?: DeviceControlRole | "blocked" | null;
      deviceId: string;
      error: string | null;
      isRunning: boolean;
      primaryControllerUserId?: string | null;
      primaryLeaseExpiresAt?: number | null;
      primaryLeaseSessionId?: string | null;
      transport: RuntimeTransportMode | null;
    }
  >,
  deviceId: string,
) {
  return statuses[deviceId] ?? null;
}

function normalizeMonitoringControlRole(
  value: DeviceControlRole | "blocked" | null | undefined,
): DeviceControlRole {
  return value === "primary" || value === "secondary" ? value : "none";
}

function ensureEnrollmentNotInProgress() {
  if (enrollmentInProgress) {
    throw new Error(ENROLLMENT_IN_PROGRESS_ERROR);
  }
}

function beginEnrollmentGuard() {
  if (enrollmentInProgress) {
    throw new Error(ENROLLMENT_IN_PROGRESS_ERROR);
  }

  enrollmentInProgress = true;
}

function endEnrollmentGuard() {
  enrollmentInProgress = false;
}

export interface ColdGuardBleClient {
  discoverDevice(args: { deviceId: string; expectedState: "blank" | "enrolled" }): Promise<ColdGuardDiscoveredDevice>;
  enrollDevice(args: {
    actionTicket: CachedDeviceActionTicket;
    bootstrapToken: string;
    deviceId: string;
    handshakeToken: string;
    institutionId: string;
    nickname: string;
  }): Promise<ColdGuardDiscoveredDevice>;
  requestWifiTicket(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }): Promise<ColdGuardWifiTicket>;
  requestSharedAccess?(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }): Promise<ColdGuardWifiTicket>;
  claimPrimaryLease?(args: {
    actionTicket: CachedDeviceActionTicket;
    controllerClientId: string;
    controllerUserId: string;
    deviceId: string;
    handshakeToken: string;
    heartbeatIntervalMs?: number;
    leaseDurationMs?: number;
    sessionId?: string | null;
  }): Promise<{
    controlRole: "blocked" | "none" | "primary" | "secondary";
    primaryControllerUserId: string | null;
    primaryLeaseExpiresAt: number | null;
    primaryLeaseHeartbeatIntervalMs: number | null;
    primaryLeaseSessionId: string | null;
  }>;
  provisionWifi(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
    password: string;
    ssid: string;
  }): Promise<FacilityWifiProvisioning>;
  decommissionDevice(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }): Promise<void>;
}

export interface ColdGuardWifiBridge {
  connect(ticket: ColdGuardWifiTicket): Promise<{ localIp: string; ssid: string }>;
  fetchRuntimeSnapshot?(runtimeBaseUrl: string): Promise<{
    alertsJson: string;
    historyJson: string;
    runtimeBaseUrl: string;
    statusJson: string;
  }>;
  fetchRuntimeHistory?(
    runtimeBaseUrl: string,
    afterSequence?: number,
    limit?: number,
  ): Promise<{
    hasMore: boolean;
    nextSequence: number;
    rowsJson: string;
    runtimeBaseUrl: string;
  }>;
  release(): Promise<void>;
}

export function parseDeviceQrPayload(qrPayload: string) {
  const normalized = qrPayload.trim();
  const match = normalized.match(/^coldguard:\/\/device\/([^?]+)\?claim=([^&]+)&v=1$/);
  if (!match) {
    throw new Error("INVALID_DEVICE_QR_PAYLOAD");
  }

  return {
    bootstrapToken: decodeURIComponent(match[2]),
    deviceId: decodeURIComponent(match[1]),
  };
}

export class MockColdGuardBleClient implements ColdGuardBleClient {
  async discoverDevice(args: { deviceId: string; expectedState: "blank" | "enrolled" }) {
    await delay(120);
    const device = discoverMockHardwareDevice(args.deviceId);
    if (args.expectedState === "blank" && device.state !== "blank") {
      throw new Error("MOCK_DEVICE_STATE_MISMATCH");
    }
    return device;
  }

  async enrollDevice(args: {
    actionTicket: CachedDeviceActionTicket;
    bootstrapToken: string;
    deviceId: string;
    handshakeToken: string;
    institutionId: string;
    nickname: string;
  }) {
    if (!args.actionTicket.mac || !args.handshakeToken) {
      throw new Error("DEVICE_ENROLLMENT_AUTH_FAILED");
    }

    await delay(120);
    return claimMockHardwareDevice({
      bootstrapClaim: args.bootstrapToken,
      deviceId: args.deviceId,
      institutionId: args.institutionId,
      nickname: args.nickname,
    });
  }

  async requestWifiTicket(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }) {
    if (!args.handshakeToken || !args.actionTicket.mac) {
      throw new Error("DEVICE_CONNECTION_AUTH_FAILED");
    }

    await delay(120);
    return {
      expiresAt: Date.now() + 60_000,
      password: `${args.deviceId.slice(-4)}-wifi`,
      ssid: `ColdGuard_${args.deviceId.slice(-4)}`,
      testUrl: "http://192.168.4.1/api/v1/connection-test",
    };
  }

  async requestSharedAccess(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }) {
    return await this.requestWifiTicket(args);
  }

  async claimPrimaryLease(args: {
    actionTicket: CachedDeviceActionTicket;
    controllerClientId: string;
    controllerUserId: string;
    deviceId: string;
    handshakeToken: string;
    heartbeatIntervalMs?: number;
    leaseDurationMs?: number;
    sessionId?: string | null;
  }) {
    if (!args.handshakeToken || !args.actionTicket.mac) {
      throw new Error("DEVICE_CONNECTION_AUTH_FAILED");
    }

    await delay(120);
    return {
      controlRole: "primary" as const,
      primaryControllerUserId: args.controllerUserId,
      primaryLeaseExpiresAt: Date.now() + (args.leaseDurationMs ?? 35_000),
      primaryLeaseHeartbeatIntervalMs: args.heartbeatIntervalMs ?? 10_000,
      primaryLeaseSessionId: args.sessionId ?? `lease-${args.deviceId}`,
    };
  }

  async provisionWifi(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
    password: string;
    ssid: string;
  }) {
    if (!args.handshakeToken || !args.actionTicket.mac) {
      throw new Error("DEVICE_WIFI_PROVISION_AUTH_FAILED");
    }

    await delay(120);
    return provisionMockHardwareWifi({
      deviceId: args.deviceId,
      password: args.password,
      ssid: args.ssid,
    });
  }

  async decommissionDevice(args: {
    actionTicket: CachedDeviceActionTicket;
    deviceId: string;
    handshakeToken: string;
  }) {
    if (!args.handshakeToken || !args.actionTicket.mac) {
      throw new Error("DEVICE_DECOMMISSION_AUTH_FAILED");
    }

    await delay(120);
    decommissionMockHardwareDevice(args.deviceId);
  }
}

const realBleClient = new RealColdGuardBleClient();
const RUNTIME_STATUS_PATH = "/api/v1/runtime/status";
const RUNTIME_ALERTS_PATH = "/api/v1/runtime/alerts";
const RUNTIME_HISTORY_PATH = "/api/v1/runtime/history";
const RUNTIME_ACK_PATH = "/api/v1/runtime/ack";
const DEFAULT_HISTORY_PAGE_LIMIT = 100;

function normalizeRuntimeBaseUrl(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function buildRuntimeUrl(baseUrl: string, path: string) {
  return `${normalizeRuntimeBaseUrl(baseUrl)}${path}`;
}

function normalizeRuntimeAlerts(value: unknown): RuntimeAlertRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<RuntimeAlertRecord>;
    if (
      typeof candidate.title !== "string" ||
      typeof candidate.body !== "string" ||
      typeof candidate.triggeredAt !== "number" ||
      (candidate.severity !== "warning" && candidate.severity !== "critical") ||
      (candidate.status !== "open" && candidate.status !== "resolved") ||
      candidate.incidentType !== "temperature" &&
      candidate.incidentType !== "device_offline"
    ) {
      return [];
    }

    return [
      {
        body: candidate.body,
        cursor: typeof candidate.cursor === "string" ? candidate.cursor : `alert-${index}-${candidate.triggeredAt}`,
        incidentType: candidate.incidentType,
        severity: candidate.severity,
        status: candidate.status,
        title: candidate.title,
        triggeredAt: candidate.triggeredAt,
      },
    ];
  });
}

async function fetchRuntimeStatus(baseUrl: string) {
  const response = await fetch(buildRuntimeUrl(baseUrl, RUNTIME_STATUS_PATH));
  if (!response.ok) {
    throw new Error(`HTTP_RUNTIME_STATUS_FAILED_${response.status}`);
  }

  return (await response.json()) as RemoteConnectionPayload;
}

async function fetchRuntimeAlerts(baseUrl: string) {
  try {
    const response = await fetch(buildRuntimeUrl(baseUrl, RUNTIME_ALERTS_PATH));
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { alerts?: unknown };
    return normalizeRuntimeAlerts(payload.alerts);
  } catch {
    return [];
  }
}

function buildRuntimeSnapshot(args: {
  alerts: RuntimeAlertRecord[];
  localIp: string | null;
  receivedAt: number;
  response: RemoteConnectionPayload;
  runtimeBaseUrl: string;
  ssid: string | null;
  transport: RuntimeTransportMode;
}): DeviceRuntimeSnapshot {
  const {
    institutionId: _institutionId,
    lastSeenAgeMs: _lastSeenAgeMs,
    lastSeenAt: _remoteLastSeenAt,
    nickname: _nickname,
    alerts: _alerts,
    runtimeBaseUrl: _reportedRuntimeBaseUrl,
    ...payloadBase
  } = args.response;
  const recordedAt =
    typeof args.response.recordedAt === "number"
      ? args.response.recordedAt
      : typeof (args.response as { recordedAtEpochMs?: unknown }).recordedAtEpochMs === "number"
        ? (args.response as { recordedAtEpochMs: number }).recordedAtEpochMs
        : normalizeConnectionLastSeenAt(args.response, args.receivedAt);

  return {
    accessMode: payloadBase.accessMode,
    currentTempC: typeof payloadBase.currentTempC === "number" ? payloadBase.currentTempC : 0,
    firmwareVersion: payloadBase.firmwareVersion,
    latestSequence: typeof payloadBase.latestSequence === "number" ? payloadBase.latestSequence : 0,
    alerts: args.alerts,
    lastSeenAt: normalizeConnectionLastSeenAt(args.response, args.receivedAt),
    localIp: args.localIp,
    macAddress: payloadBase.macAddress,
    mktStatus: payloadBase.mktStatus,
    primaryTransport: payloadBase.primaryTransport,
    receivedAt: args.receivedAt,
    recordedAt,
    rtcIso: payloadBase.rtcIso ?? null,
    runtimeBaseUrl: normalizeRuntimeBaseUrl(args.runtimeBaseUrl),
    sdCardMounted: false,
    secondaryTransport: payloadBase.secondaryTransport,
    ssid: args.ssid,
    softApAvailable: payloadBase.softApAvailable,
    softApClientCount: payloadBase.softApClientCount,
    softApIdleTimeoutMs: payloadBase.softApIdleTimeoutMs,
    statusText: payloadBase.statusText,
    timeSource: payloadBase.timeSource ?? "unknown",
    transport: args.transport,
  };
}

async function fetchAndBuildRuntimeSnapshot(args: {
  localIp: string | null;
  runtimeBaseUrl: string;
  ssid: string | null;
  transport: RuntimeTransportMode;
}) {
  const response = await fetchRuntimeStatus(args.runtimeBaseUrl);
  const alerts = response.alerts ? normalizeRuntimeAlerts(response.alerts) : await fetchRuntimeAlerts(args.runtimeBaseUrl);
  const receivedAt = Date.now();

  return buildRuntimeSnapshot({
    alerts,
    localIp: args.localIp,
    receivedAt,
    response,
    runtimeBaseUrl: response.runtimeBaseUrl ?? args.runtimeBaseUrl,
    ssid: args.ssid,
    transport: args.transport,
  });
}

async function fetchAndBuildRuntimeSnapshotFromBridge(args: {
  alertsJson: string;
  historyJson: string;
  localIp: string | null;
  runtimeBaseUrl: string;
  ssid: string | null;
  statusJson: string;
  transport: RuntimeTransportMode;
}) {
  try {
    const response = JSON.parse(args.statusJson) as RemoteConnectionPayload;
    const alertsPayload = JSON.parse(args.alertsJson) as { alerts?: unknown };
    const alerts = response.alerts
      ? normalizeRuntimeAlerts(response.alerts)
      : normalizeRuntimeAlerts(alertsPayload.alerts);
    const receivedAt = Date.now();

    return buildRuntimeSnapshot({
      alerts,
      localIp: args.localIp,
      receivedAt,
      response,
      runtimeBaseUrl: response.runtimeBaseUrl ?? args.runtimeBaseUrl,
      ssid: args.ssid,
      transport: args.transport,
    });
  } catch (error) {
    console.warn("Failed to parse native runtime snapshot payload; falling back to HTTP runtime fetch.", {
      alertsJson: args.alertsJson,
      historyJson: args.historyJson,
      runtimeBaseUrl: args.runtimeBaseUrl,
      statusJson: args.statusJson,
    });
    return null;
  }
}

function parseRuntimeHistoryRows(value: unknown, fallbackInstitutionName = ""): DeviceTelemetryReadingRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<DeviceTelemetryReadingRecord> & {
      currentTempC?: number;
      institutionName?: string;
      latestSequence?: number;
      recordedAt?: number;
      recordedAtEpochMs?: number;
      vaccineTempC?: number;
    };
    const currentTempC =
      typeof candidate.currentTempC === "number"
        ? candidate.currentTempC
        : typeof candidate.vaccineTempC === "number"
          ? candidate.vaccineTempC
          : null;
    const recordedAt =
      typeof candidate.recordedAt === "number"
        ? candidate.recordedAt
        : typeof candidate.recordedAtEpochMs === "number"
          ? candidate.recordedAtEpochMs
          : Date.now();

    if (
      typeof candidate.deviceId !== "string" ||
      typeof candidate.sequence !== "number" ||
      currentTempC === null ||
      (candidate.mktStatus !== "safe" && candidate.mktStatus !== "warning" && candidate.mktStatus !== "alert")
    ) {
      return [];
    }

    return [
      {
        currentTempC,
        deviceId: candidate.deviceId,
        id: typeof candidate.id === "string" ? candidate.id : `${candidate.deviceId}:${candidate.sequence}`,
        institutionName: candidate.institutionName ?? fallbackInstitutionName,
        mktStatus: candidate.mktStatus,
        recordedAt,
        rtcIso: typeof candidate.rtcIso === "string" ? candidate.rtcIso : null,
        sdCardMounted: false,
        sequence: candidate.sequence,
        timeSource:
          candidate.timeSource === "rtc" || candidate.timeSource === "fallback"
            ? candidate.timeSource
            : "unknown",
      },
    ];
  });
}

function normalizeRuntimeHistoryPage(value: unknown, runtimeBaseUrl: string) {
  if (!value || typeof value !== "object") {
    return {
      hasMore: false,
      nextSequence: 0,
      rows: [] as DeviceTelemetryReadingRecord[],
      runtimeBaseUrl,
    };
  }

  const candidate = value as {
    hasMore?: unknown;
    nextSequence?: unknown;
    next_sequence?: unknown;
    rows?: unknown;
    rowsJson?: unknown;
    runtimeBaseUrl?: unknown;
  };
  const rowsValue =
    candidate.rowsJson && typeof candidate.rowsJson === "string"
      ? safeParseJson(candidate.rowsJson)
      : candidate.rows;

  return {
    hasMore: Boolean(candidate.hasMore),
    nextSequence:
      typeof candidate.nextSequence === "number"
        ? candidate.nextSequence
        : typeof candidate.next_sequence === "number"
          ? candidate.next_sequence
          : 0,
    rows: parseRuntimeHistoryRows(rowsValue, ""),
    runtimeBaseUrl:
      typeof candidate.runtimeBaseUrl === "string" && candidate.runtimeBaseUrl.length > 0
        ? candidate.runtimeBaseUrl
        : runtimeBaseUrl,
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

async function fetchRuntimeHistory(baseUrl: string, afterSequence = -1, limit = DEFAULT_HISTORY_PAGE_LIMIT) {
  const url = new URL(buildRuntimeUrl(baseUrl, RUNTIME_HISTORY_PATH));
  url.searchParams.set("afterSequence", String(afterSequence));
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`HTTP_RUNTIME_HISTORY_FAILED_${response.status}`);
  }

  return normalizeRuntimeHistoryPage(await response.json(), normalizeRuntimeBaseUrl(baseUrl));
}

async function acknowledgeRuntimeHistoryUpload(runtimeBaseUrl: string, uploadedThroughSequence: number) {
  if (!Number.isFinite(uploadedThroughSequence) || uploadedThroughSequence < 0) {
    return;
  }

  const url = new URL(buildRuntimeUrl(runtimeBaseUrl, RUNTIME_ACK_PATH));
  url.searchParams.set("uploadedThroughSequence", String(uploadedThroughSequence));
  const response = await fetch(url.toString(), { method: "POST" });
  if (!response.ok) {
    throw new Error(`HTTP_RUNTIME_ACK_FAILED_${response.status}`);
  }
}

async function fetchRuntimeHistoryPage(args: {
  afterSequence: number;
  fallbackInstitutionName: string;
  limit?: number;
  runtimeBaseUrl: string;
  wifiBridge?: ColdGuardWifiBridge;
}) {
  if (args.wifiBridge?.fetchRuntimeHistory) {
    const page = await args.wifiBridge.fetchRuntimeHistory(
      args.runtimeBaseUrl,
      args.afterSequence,
      args.limit ?? DEFAULT_HISTORY_PAGE_LIMIT,
    );

    const normalized = normalizeRuntimeHistoryPage(
      {
        hasMore: page.hasMore,
        nextSequence: page.nextSequence,
        rowsJson: page.rowsJson,
        runtimeBaseUrl: page.runtimeBaseUrl,
      },
      args.runtimeBaseUrl,
    );

    return {
      ...normalized,
      rows: parseRuntimeHistoryRows(normalized.rows, args.fallbackInstitutionName),
    };
  }

  const page = await fetchRuntimeHistory(
    args.runtimeBaseUrl,
    args.afterSequence,
    args.limit ?? DEFAULT_HISTORY_PAGE_LIMIT,
  );

  return {
    ...page,
    rows: page.rows.map((row) => ({
      ...row,
      institutionName: row.institutionName || args.fallbackInstitutionName,
    })),
  };
}

async function syncTelemetryHistoryAfterSnapshot(args: {
  deviceId: string;
  snapshot: DeviceRuntimeSnapshot;
  wifiBridge?: ColdGuardWifiBridge;
}) {
  const [device, runtimeConfig] = await Promise.all([
    getDeviceById(args.deviceId),
    getDeviceRuntimeConfig(args.deviceId),
  ]);

  if (!device) {
    return;
  }

  let afterSequence = runtimeConfig?.telemetryHistoryCursor ?? -1;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchRuntimeHistoryPage({
      afterSequence,
      fallbackInstitutionName: device.institutionName,
      runtimeBaseUrl: args.snapshot.runtimeBaseUrl,
      wifiBridge: args.wifiBridge,
    });

    const rows = page.rows.map((row) => ({
      ...row,
      deviceId: args.deviceId,
      id: row.id || `${args.deviceId}:${row.sequence}`,
      institutionName: row.institutionName || device.institutionName,
    }));

    if (rows.length > 0) {
      await saveReadings(rows);
    }

    const maxSequenceFromRows = rows.reduce((max, row) => Math.max(max, row.sequence), afterSequence);
    const nextSequence = Math.max(afterSequence, page.nextSequence, maxSequenceFromRows);

    if (nextSequence <= afterSequence) {
      break;
    }

    afterSequence = nextSequence;
    await upsertDeviceRuntimeConfig(args.deviceId, {
      telemetryHistoryCursor: afterSequence,
    });

    hasMore = page.hasMore;
  }

  await uploadPendingTelemetryHistory(args.deviceId, args.snapshot.runtimeBaseUrl);
}

async function uploadPendingTelemetryHistory(deviceId: string, runtimeBaseUrl?: string) {
  const [device, runtimeConfig] = await Promise.all([
    getDeviceById(deviceId),
    getDeviceRuntimeConfig(deviceId),
  ]);
  if (!device) {
    return;
  }

  const convex = getConvexClient();
  let afterSequence = runtimeConfig?.telemetryUploadCursor ?? -1;

  while (true) {
    const rows = await getReadingsAfterSequenceForDevice(deviceId, afterSequence, DEFAULT_HISTORY_PAGE_LIMIT);
    if (rows.length === 0) {
      return;
    }

    await convex.mutation((api as any).devices.ingestDeviceTelemetryBatch, {
      deviceId,
      readings: rows.map((row) => ({
        mktStatus: row.mktStatus,
        recordedAt: row.recordedAt,
        rtcIso: row.rtcIso ?? "",
        sdCardMounted: false,
        sequence: row.sequence,
        timeSource: row.timeSource,
        vaccineTempC: row.currentTempC,
      })),
    });

    afterSequence = rows[rows.length - 1]?.sequence ?? afterSequence;
    await upsertDeviceRuntimeConfig(deviceId, {
      telemetryUploadCursor: afterSequence,
    });

    if (runtimeBaseUrl) {
      await acknowledgeRuntimeHistoryUpload(runtimeBaseUrl, afterSequence).catch((error) => {
        console.warn("Failed to acknowledge uploaded telemetry history to firmware.", {
          deviceId,
          error: error instanceof Error ? error.message : String(error),
          uploadedThroughSequence: afterSequence,
        });
      });
    }
  }
}

export async function getPendingTelemetryReadingsForDevice(deviceId: string, limit = DEFAULT_HISTORY_PAGE_LIMIT) {
  const runtimeConfig = await getDeviceRuntimeConfig(deviceId);
  const afterSequence = runtimeConfig?.telemetryUploadCursor ?? -1;
  return await getReadingsAfterSequenceForDevice(deviceId, afterSequence, limit);
}

export async function markTelemetryReadingsUploadedThroughSequence(
  deviceId: string,
  sequence: number,
) {
  await upsertDeviceRuntimeConfig(deviceId, {
    telemetryUploadCursor: sequence,
  });
}

async function tryFetchRuntimeSnapshotFromBridge(args: {
  localIp: string | null;
  runtimeBaseUrl: string;
  ssid: string | null;
  transport: RuntimeTransportMode;
  wifiBridge: ColdGuardWifiBridge;
}) {
  if (!args.wifiBridge.fetchRuntimeSnapshot) {
    return null;
  }

  try {
    const runtimeSnapshot = await args.wifiBridge.fetchRuntimeSnapshot(args.runtimeBaseUrl);
    return await fetchAndBuildRuntimeSnapshotFromBridge({
      alertsJson: runtimeSnapshot.alertsJson,
      historyJson: runtimeSnapshot.historyJson,
      localIp: args.localIp,
      runtimeBaseUrl: runtimeSnapshot.runtimeBaseUrl,
      ssid: args.ssid,
      statusJson: runtimeSnapshot.statusJson,
      transport: args.transport,
    });
  } catch (error) {
    console.warn("Native runtime snapshot fetch failed; falling back to HTTP runtime fetch.", {
      error: error instanceof Error ? error.message : String(error),
      runtimeBaseUrl: args.runtimeBaseUrl,
      transport: args.transport,
    });
    return null;
  }
}

async function connectViaFacilityWifi(deviceId: string) {
  const config = await getDeviceRuntimeConfig(deviceId);
  const runtimeBaseUrl = config?.facilityWifiRuntimeBaseUrl;
  if (!runtimeBaseUrl) {
    throw new Error("FACILITY_WIFI_NOT_PROVISIONED");
  }

  const snapshot = await fetchAndBuildRuntimeSnapshot({
    localIp: null,
    runtimeBaseUrl,
    ssid: config?.facilityWifiSsid ?? null,
    transport: "facility_wifi",
  });

  await upsertDeviceRuntimeConfig(deviceId, {
    activeRuntimeBaseUrl: snapshot.runtimeBaseUrl,
    activeTransport: "facility_wifi",
    lastPingAt: snapshot.receivedAt,
    lastRuntimeError: null,
    sessionStatus: "connected",
  });

  void syncTelemetryHistoryAfterSnapshot({
    deviceId,
    snapshot,
  }).catch((error) => {
    console.warn("Failed to sync facility Wi-Fi telemetry history.", {
      deviceId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return snapshot;
}

function hasProvenFacilityWifiPath(config: Awaited<ReturnType<typeof getDeviceRuntimeConfig>>) {
  if (!config?.facilityWifiRuntimeBaseUrl) {
    return false;
  }

  if (config.activeTransport !== "facility_wifi") {
    return false;
  }

  if (!config.lastPingAt) {
    return false;
  }

  return Date.now() - config.lastPingAt <= FACILITY_WIFI_PROOF_WINDOW_MS;
}

async function connectViaSoftAp(args: {
  bleClient: ColdGuardBleClient;
  deviceId: string;
  wifiBridge: ColdGuardWifiBridge;
}) {
  await ensureWifiBridgePermissions();
  const handshakeToken = await getRequiredClinicHandshakeToken();
  const actionTicket = await ensureDeviceActionTicket(args.deviceId, "connect");
  const runtimeConfig = await getDeviceRuntimeConfig(args.deviceId);

  await args.bleClient.discoverDevice({
    deviceId: args.deviceId,
    expectedState: "enrolled",
  });
  const ticket =
    runtimeConfig?.controlRole === "secondary" && args.bleClient.requestSharedAccess
      ? await args.bleClient.requestSharedAccess({
          actionTicket,
          deviceId: args.deviceId,
          handshakeToken,
        })
      : await args.bleClient.requestWifiTicket({
          actionTicket,
          deviceId: args.deviceId,
          handshakeToken,
        });
  const network = await args.wifiBridge.connect(ticket);
  const runtimeBaseUrl = normalizeRuntimeBaseUrl(ticket.testUrl);

  try {
    const snapshotFromBridge = await tryFetchRuntimeSnapshotFromBridge({
      localIp: network.localIp,
      runtimeBaseUrl,
      ssid: ticket.ssid,
      transport: "softap",
      wifiBridge: args.wifiBridge,
    });
    const snapshot = snapshotFromBridge
      ? snapshotFromBridge
      : await fetchAndBuildRuntimeSnapshot({
          localIp: network.localIp,
          runtimeBaseUrl,
          ssid: ticket.ssid,
          transport: "softap",
        });

    await upsertDeviceRuntimeConfig(args.deviceId, {
      activeRuntimeBaseUrl: snapshot.runtimeBaseUrl,
      activeTransport: "softap",
      lastPingAt: snapshot.receivedAt,
      lastRecoverAt: snapshot.receivedAt,
      lastRuntimeError: null,
      sessionStatus: "connected",
      softApPassword: ticket.password,
      softApRuntimeBaseUrl: snapshot.runtimeBaseUrl,
      softApSsid: ticket.ssid,
    });
    await syncTelemetryHistoryAfterSnapshot({
      deviceId: args.deviceId,
      snapshot,
      wifiBridge: args.wifiBridge,
    }).catch((error) => {
      console.warn("Failed to sync SoftAP telemetry history.", {
        deviceId: args.deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return snapshot;
  } finally {
    await args.wifiBridge.release().catch(() => undefined);
  }
}

async function connectViaStoredSoftAp(args: {
  deviceId: string;
  wifiBridge: ColdGuardWifiBridge;
}) {
  await ensureWifiBridgePermissions();
  const config = await getDeviceRuntimeConfig(args.deviceId);
  const runtimeBaseUrl = config?.softApRuntimeBaseUrl;
  const ssid = config?.softApSsid;
  const password = config?.softApPassword;
  if (!runtimeBaseUrl || !ssid || !password) {
    throw new Error("SOFTAP_CREDENTIALS_UNAVAILABLE");
  }

  const network = await args.wifiBridge.connect({
    expiresAt: Date.now() + 60_000,
    password,
    ssid,
    testUrl: `${normalizeRuntimeBaseUrl(runtimeBaseUrl)}/api/v1/connection-test`,
  });

  try {
    const snapshotFromBridge = await tryFetchRuntimeSnapshotFromBridge({
      localIp: network.localIp,
      runtimeBaseUrl,
      ssid,
      transport: "softap",
      wifiBridge: args.wifiBridge,
    });
    const snapshot = snapshotFromBridge
      ? snapshotFromBridge
      : await fetchAndBuildRuntimeSnapshot({
          localIp: network.localIp,
          runtimeBaseUrl,
          ssid,
          transport: "softap",
        });

    await upsertDeviceRuntimeConfig(args.deviceId, {
      activeRuntimeBaseUrl: snapshot.runtimeBaseUrl,
      activeTransport: "softap",
      lastPingAt: snapshot.receivedAt,
      lastRecoverAt: snapshot.receivedAt,
      lastRuntimeError: null,
      sessionStatus: "connected",
      softApPassword: password,
      softApRuntimeBaseUrl: snapshot.runtimeBaseUrl,
      softApSsid: ssid,
    });
    await syncTelemetryHistoryAfterSnapshot({
      deviceId: args.deviceId,
      snapshot,
      wifiBridge: args.wifiBridge,
    }).catch((error) => {
      console.warn("Failed to sync stored SoftAP telemetry history.", {
        deviceId: args.deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return snapshot;
  } finally {
    await args.wifiBridge.release().catch(() => undefined);
  }
}

export async function enrollColdGuardDevice(args: {
  nickname: string;
  onProgress?: (event: ColdGuardEnrollmentProgressEvent) => void;
  profile: ProfileSnapshot;
  qrPayload: string;
  bleClient?: ColdGuardBleClient;
}) {
  if (args.profile.role !== "Supervisor") {
    throw new Error("DEVICE_MANAGEMENT_FORBIDDEN");
  }

  beginEnrollmentGuard();
  try {
    await ensureEnrollmentPermissions();

    const handshakeToken = await getRequiredClinicHandshakeToken();
    const { bootstrapToken, deviceId } = parseDeviceQrPayload(args.qrPayload);
    const bleClient = args.bleClient ?? realBleClient;
    const actionTicket = await ensureSupervisorActionTicket(args.profile, deviceId, "enroll");
    const nickname = args.nickname.trim() || `ColdGuard ${deviceId.slice(-4).toUpperCase()}`;
    const enrolledDevice =
      Platform.OS === "android" && !args.bleClient
        ? await (async () => {
            await ensureBleTransportPermissions();
            await ensureWifiBridgePermissions();
            const connectActionTicket = await ensureSupervisorActionTicket(args.profile, deviceId, "connect");
            const progressSubscription = subscribeToNativeEnrollmentStages((event) => {
              args.onProgress?.(event);
            });

            try {
              const result = await startNativeEnrollment({
                actionTicketJson: JSON.stringify(actionTicket),
                bootstrapToken,
                connectActionTicketJson: JSON.stringify(connectActionTicket),
                deviceId,
                handshakeToken,
                institutionId: args.profile.institutionId,
                nickname,
              });

              await upsertDeviceRuntimeConfig(deviceId, {
                lastRuntimeError: null,
                softApPassword: result.softApPassword,
                softApRuntimeBaseUrl: result.runtimeBaseUrl,
                softApSsid: result.softApSsid,
              });

              return {
                bleName: result.bleName,
                bootstrapClaim: bootstrapToken,
                deviceId: result.deviceId,
                firmwareVersion: result.firmwareVersion,
                macAddress: result.macAddress,
                protocolVersion: result.protocolVersion,
                state: "enrolled" as const,
              };
            } finally {
              progressSubscription?.remove();
            }
          })()
        : await bleClient.enrollDevice({
            actionTicket,
            bootstrapToken,
            deviceId,
            handshakeToken,
            institutionId: args.profile.institutionId,
            nickname,
          });

    const registeredDevice = await registerEnrolledDevice({
      bleName: enrolledDevice.bleName,
      deviceId: enrolledDevice.deviceId,
      firmwareVersion: enrolledDevice.firmwareVersion,
      macAddress: enrolledDevice.macAddress,
      nickname,
      protocolVersion: enrolledDevice.protocolVersion,
    });

    await syncVisibleDevices(args.profile);

    await bootstrapDefaultDeviceMonitoring(enrolledDevice.deviceId);

    endEnrollmentGuard();
    return registeredDevice;
  } finally {
    endEnrollmentGuard();
  }
}

export async function requestColdLaunchPermissions() {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    await ensureEnrollmentPermissions();
  } catch {
    // Cold-launch permission preflight is best-effort. Enrollment and monitoring
    // remain the hard gates if the user declines here.
  }
}

export async function quickConnectColdGuardDevice(args: {
  deviceId: string;
  nickname?: string;
  password: string;
  profile: ProfileSnapshot;
  ssid: string;
  wifiBridge?: ColdGuardWifiBridge;
}) {
  const deviceId = args.deviceId.trim();
  const ssid = args.ssid.trim();
  const password = args.password.trim();

  if (!deviceId) {
    throw new Error("DEVICE_ID_REQUIRED");
  }

  if (!ssid) {
    throw new Error("SOFTAP_SSID_REQUIRED");
  }

  if (!password) {
    throw new Error("SOFTAP_PASSWORD_REQUIRED");
  }

  await ensureWifiBridgePermissions();
  const wifiBridge = args.wifiBridge ?? createColdGuardWifiBridge();
  const runtimeBaseUrl = "http://192.168.4.1";
  const network = await wifiBridge.connect({
    expiresAt: Date.now() + 60_000,
    password,
    ssid,
    testUrl: `${runtimeBaseUrl}/api/v1/connection-test`,
  });

  try {
    const snapshotFromBridge = await tryFetchRuntimeSnapshotFromBridge({
      localIp: network.localIp,
      runtimeBaseUrl,
      ssid,
      transport: "softap",
      wifiBridge,
    });
    const snapshot = snapshotFromBridge
      ? snapshotFromBridge
      : await fetchAndBuildRuntimeSnapshot({
          localIp: network.localIp,
          runtimeBaseUrl,
          ssid,
          transport: "softap",
        });

    await upsertLocalQuickConnectDevice({
      currentTempC: snapshot.currentTempC,
      deviceId,
      firmwareVersion: snapshot.firmwareVersion,
      institutionId: args.profile.institutionId,
      institutionName: args.profile.institutionName,
      lastSeenAt: snapshot.lastSeenAt,
      latestSequence: snapshot.latestSequence,
      macAddress: snapshot.macAddress || deviceId,
      mktStatus: snapshot.mktStatus,
      nickname: args.nickname?.trim() || deviceId,
      recordedAt: snapshot.recordedAt,
      rtcIso: snapshot.rtcIso,
      timeSource: snapshot.timeSource,
    });

    await upsertDeviceRuntimeConfig(deviceId, {
      activeRuntimeBaseUrl: snapshot.runtimeBaseUrl,
      activeTransport: "softap",
      lastPingAt: snapshot.receivedAt,
      lastRecoverAt: snapshot.receivedAt,
      lastRuntimeError: null,
      sessionStatus: "connected",
      softApPassword: password,
      softApRuntimeBaseUrl: snapshot.runtimeBaseUrl,
      softApSsid: ssid,
    });

    await saveDeviceConnectionSnapshot(deviceId, {
      currentTempC: snapshot.currentTempC,
      lastConnectionTestAt: snapshot.receivedAt,
      lastConnectionTestStatus: "success",
      lastSeenAt: snapshot.lastSeenAt,
      macAddress: snapshot.macAddress,
      mktStatus: snapshot.mktStatus,
      recordedAt: snapshot.recordedAt,
      rtcIso: snapshot.rtcIso,
      sdCardMounted: false,
      sequence: snapshot.latestSequence,
      timeSource: snapshot.timeSource,
    });

    await syncTelemetryHistoryAfterSnapshot({
      deviceId,
      snapshot,
      wifiBridge,
    }).catch((error) => {
      console.warn("Failed to sync quick-connect telemetry history.", {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return {
      deviceId,
      snapshot,
    };
  } finally {
    await wifiBridge.release().catch(() => undefined);
  }
}

export async function connectOrRecoverDevice(args: {
  deviceId: string;
  bleClient?: ColdGuardBleClient;
  wifiBridge?: ColdGuardWifiBridge;
}) {
  ensureEnrollmentNotInProgress();
  const device = await getDeviceById(args.deviceId);
  if (!device) {
    throw new Error("DEVICE_NOT_FOUND");
  }
  const config = await getDeviceRuntimeConfig(args.deviceId);

  await upsertDeviceRuntimeConfig(args.deviceId, {
    lastRuntimeError: null,
    sessionStatus: "connecting",
  });

  const wifiBridge = args.wifiBridge ?? createColdGuardWifiBridge();
  const preferFacilityWifiFirst = hasProvenFacilityWifiPath(config);

  const connectWithBleRecoveryFallback = async (errorMessage: string) => {
    const bleClient = args.bleClient ?? realBleClient;

    try {
      await upsertDeviceRuntimeConfig(args.deviceId, {
        lastRuntimeError: errorMessage,
        sessionStatus: "recovering",
      });
      return await connectViaSoftAp({
        bleClient,
        deviceId: args.deviceId,
        wifiBridge,
      });
    } catch (softApRecoveryError) {
      await upsertDeviceRuntimeConfig(args.deviceId, {
        activeRuntimeBaseUrl: null,
        activeTransport: "ble_fallback",
        lastRuntimeError: softApRecoveryError instanceof Error ? softApRecoveryError.message : "Runtime recovery failed.",
        sessionStatus: "failed",
      });
      throw softApRecoveryError;
    }
  };

  const connectWithFacilityFallback = async (facilityErrorMessage: string) => {
    try {
      return await connectViaFacilityWifi(args.deviceId);
    } catch (facilityError) {
      return await connectWithBleRecoveryFallback(
        facilityError instanceof Error ? facilityError.message : facilityErrorMessage,
      );
    }
  };

  if (preferFacilityWifiFirst) {
    try {
      return await connectViaFacilityWifi(args.deviceId);
    } catch (facilityError) {
      await upsertDeviceRuntimeConfig(args.deviceId, {
        lastRuntimeError: facilityError instanceof Error ? facilityError.message : "Facility Wi-Fi unavailable.",
        sessionStatus: "recovering",
      });
    }
  }

  try {
    return await connectViaStoredSoftAp({
      deviceId: args.deviceId,
      wifiBridge,
    });
  } catch (softApDirectError) {
    await upsertDeviceRuntimeConfig(args.deviceId, {
      lastRuntimeError:
        softApDirectError instanceof Error
          ? softApDirectError.message
          : "Stored SoftAP unavailable.",
      sessionStatus: "recovering",
    });

    if (preferFacilityWifiFirst) {
      return await connectWithBleRecoveryFallback("SoftAP recovery failed.");
    }

    return await connectWithFacilityFallback("Facility Wi-Fi unavailable.");
  }
}

export async function pingOrRecoverDevice(args: {
  deviceId: string;
  bleClient?: ColdGuardBleClient;
  wifiBridge?: ColdGuardWifiBridge;
}) {
  const config = await getDeviceRuntimeConfig(args.deviceId);
  // Prefer SoftAP base URL when active transport is softap; fall back to facility WiFi.
  const runtimeBaseUrl =
    config?.activeTransport === "softap"
      ? (config?.softApRuntimeBaseUrl ?? config?.activeRuntimeBaseUrl ?? null)
      : (config?.activeRuntimeBaseUrl ?? config?.facilityWifiRuntimeBaseUrl ?? null);
  const transport = config?.activeTransport ?? (config?.facilityWifiRuntimeBaseUrl ? "facility_wifi" : null);

  if (runtimeBaseUrl && transport && transport !== "ble_fallback") {
    try {
      const snapshot = await fetchAndBuildRuntimeSnapshot({
        localIp: null,
        runtimeBaseUrl,
        ssid: transport === "softap" ? (config?.softApSsid ?? null) : (config?.facilityWifiSsid ?? null),
        transport,
      });
      await upsertDeviceRuntimeConfig(args.deviceId, {
        activeRuntimeBaseUrl: snapshot.runtimeBaseUrl,
        activeTransport: snapshot.transport,
        lastPingAt: snapshot.receivedAt,
        lastRuntimeError: null,
        sessionStatus: "connected",
      });
      void syncTelemetryHistoryAfterSnapshot({
        deviceId: args.deviceId,
        snapshot,
        wifiBridge: args.wifiBridge,
      }).catch((error) => {
        console.warn("Failed to sync runtime telemetry history.", {
          deviceId: args.deviceId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return snapshot;
    } catch (error) {
      await upsertDeviceRuntimeConfig(args.deviceId, {
        lastRuntimeError: error instanceof Error ? error.message : "Runtime ping failed.",
        sessionStatus: "recovering",
      });
    }
  }

  return await connectOrRecoverDevice(args);
}

export async function provisionFacilityWifi(args: {
  deviceId: string;
  password: string;
  ssid: string;
  bleClient?: ColdGuardBleClient;
}) {
  ensureEnrollmentNotInProgress();
  const device = await getDeviceById(args.deviceId);
  if (!device) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  const bleClient = args.bleClient ?? realBleClient;
  const handshakeToken = await getRequiredClinicHandshakeToken();
  const actionTicket = await ensureDeviceActionTicket(args.deviceId, "wifi_provision");
  const provisioning = await bleClient.provisionWifi({
    actionTicket,
    deviceId: args.deviceId,
    handshakeToken,
    password: args.password,
    ssid: args.ssid,
  });

  await upsertDeviceRuntimeConfig(args.deviceId, {
    facilityWifiPassword: args.password,
    facilityWifiRuntimeBaseUrl: provisioning.runtimeBaseUrl,
    facilityWifiSsid: args.ssid,
    lastRuntimeError: null,
  });

  return provisioning;
}

export async function startDeviceMonitoring(
  deviceId: string,
  options?: { allowDuringEnrollment?: boolean },
): Promise<DeviceRuntimeConfig> {
  if (!options?.allowDuringEnrollment) {
    ensureEnrollmentNotInProgress();
  }
  if (Platform.OS !== "web") {
    const permissionStatus = await getLocalNotificationPermissionStatus();
    const nextPermissionStatus =
      permissionStatus === "undetermined" ? await requestLocalNotificationPermission() : permissionStatus;
    if (nextPermissionStatus !== "granted") {
      throw new Error(MONITORING_NOTIFICATION_PERMISSION_ERROR);
    }
  }

  await ensureMonitoringTransportPermissions();

  const [handshakeToken, connectActionTicket, profile, controllerClientId, config] = await Promise.all([
    getRequiredClinicHandshakeToken(),
    ensureDeviceActionTicket(deviceId, "connect"),
    getProfileSnapshot(),
    getOrCreateMonitoringClientId(),
    upsertDeviceRuntimeConfig(deviceId, {
      controlRole: "none",
      lastMonitorAt: Date.now(),
      lastMonitorError: null,
      monitoringMode: "foreground_service",
    }),
  ]);
  const facilityWifiRuntimeBaseUrl = config.facilityWifiRuntimeBaseUrl ?? null;
  const softApRuntimeBaseUrl =
    config.softApRuntimeBaseUrl ??
    (config.activeTransport === "softap" ? config.activeRuntimeBaseUrl : null);
  const monitoringTransport = hasProvenFacilityWifiPath(config)
    ? "facility_wifi"
    : config.activeTransport === "softap" && softApRuntimeBaseUrl
      ? "softap"
      : "ble_fallback";
  const controllerUserId = profile?.firebaseUid ?? "offline-user";

  const serviceStatuses = await startNativeMonitoringDevice({
    controllerClientId,
    controllerUserId,
    connectActionTicketJson: JSON.stringify(connectActionTicket),
    deviceId,
    facilityWifiRuntimeBaseUrl,
    handshakeToken,
    heartbeatIntervalMs: PRIMARY_LEASE_HEARTBEAT_INTERVAL_MS,
    leaseDurationMs: PRIMARY_LEASE_DURATION_MS,
    primaryLeaseSessionId: config.primaryLeaseSessionId,
    softApPassword: config.softApPassword,
    softApRuntimeBaseUrl,
    softApSsid: config.softApSsid,
    transport: monitoringTransport,
  });
  const serviceStatus = getMonitoringStatusForDevice(serviceStatuses, deviceId);
  if (!serviceStatus?.isRunning && serviceStatus?.error) {
    throw new Error(mapMonitoringStartupError(serviceStatus.error));
  }

  return await upsertDeviceRuntimeConfig(deviceId, {
    controlRole: normalizeMonitoringControlRole(serviceStatus?.controlRole),
    activeTransport: serviceStatus?.transport ?? config.activeTransport,
    lastMonitorAt: Date.now(),
    lastMonitorError: serviceStatus?.error ?? null,
    monitoringMode: serviceStatus?.isRunning ? "foreground_service" : "off",
    primaryControllerUserId: serviceStatus?.primaryControllerUserId ?? config.primaryControllerUserId,
    primaryLeaseExpiresAt: serviceStatus?.primaryLeaseExpiresAt ?? config.primaryLeaseExpiresAt,
    primaryLeaseSessionId: serviceStatus?.primaryLeaseSessionId ?? config.primaryLeaseSessionId,
  });
}

export async function stopDeviceMonitoring(deviceId: string): Promise<DeviceRuntimeConfig> {
  const serviceStatuses = await stopNativeMonitoringDevice(deviceId);
  const serviceStatus = getMonitoringStatusForDevice(serviceStatuses, deviceId);

  return await upsertDeviceRuntimeConfig(deviceId, {
    controlRole: "none",
    lastMonitorAt: Date.now(),
    lastMonitorError: serviceStatus?.error ?? null,
    monitoringMode: "off",
  });
}

export async function getDeviceRuntimeSession(deviceId: string): Promise<DeviceRuntimeConfig | null> {
  const [config, serviceStatuses] = await Promise.all([
    getDeviceRuntimeConfig(deviceId),
    getNativeMonitoringServiceStatuses(),
  ]);
  if (!config) {
    return null;
  }

  const serviceStatus = getMonitoringStatusForDevice(serviceStatuses, deviceId);

  if (serviceStatus?.isRunning) {
    return {
      ...config,
      activeTransport: serviceStatus.transport ?? config.activeTransport,
      controlRole: normalizeMonitoringControlRole(serviceStatus.controlRole) ?? config.controlRole,
      lastMonitorError: serviceStatus.error ?? config.lastMonitorError,
      monitoringMode: "foreground_service",
      primaryControllerUserId: serviceStatus.primaryControllerUserId ?? config.primaryControllerUserId,
      primaryLeaseExpiresAt: serviceStatus.primaryLeaseExpiresAt ?? config.primaryLeaseExpiresAt,
      primaryLeaseSessionId: serviceStatus.primaryLeaseSessionId ?? config.primaryLeaseSessionId,
    };
  }

  if (config.monitoringMode === "foreground_service") {
    return {
      ...config,
      lastMonitorError: serviceStatus?.error ?? config.lastMonitorError,
      monitoringMode: "off",
    };
  }

  return config;
}

export async function pollMonitoredDeviceRuntime(args: {
  deviceId: string;
  bleClient?: ColdGuardBleClient;
  wifiBridge?: ColdGuardWifiBridge;
}) {
  ensureEnrollmentNotInProgress();
  try {
    const snapshot = await pingOrRecoverDevice(args);
    await saveDeviceConnectionSnapshot(args.deviceId, {
      currentTempC: snapshot.currentTempC,
      lastConnectionTestAt: snapshot.receivedAt,
      lastConnectionTestStatus: "success",
      lastSeenAt: snapshot.lastSeenAt,
      macAddress: snapshot.macAddress,
      mktStatus: snapshot.mktStatus,
      recordedAt: snapshot.recordedAt,
      rtcIso: snapshot.rtcIso,
      sdCardMounted: false,
      sequence: snapshot.latestSequence,
      timeSource: snapshot.timeSource,
    });
    await upsertDeviceRuntimeConfig(args.deviceId, {
      lastMonitorAt: snapshot.receivedAt,
      lastMonitorError: null,
    });
    return snapshot;
  } catch (error) {
    await upsertDeviceRuntimeConfig(args.deviceId, {
      lastMonitorAt: Date.now(),
      lastMonitorError: error instanceof Error ? error.message : "Monitoring poll failed.",
    });
    throw error;
  }
}

export async function runColdGuardConnectionTest(args: {
  deviceId: string;
  bleClient?: ColdGuardBleClient;
  wifiBridge?: ColdGuardWifiBridge;
}) {
  ensureEnrollmentNotInProgress();
  const device = await getDeviceById(args.deviceId);
  if (!device) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  const testedAt = Date.now();
  await updateDeviceConnectionTestStatus({
    deviceId: args.deviceId,
    testedAt,
    status: "running",
  });

  try {
    const payload = await pingOrRecoverDevice(args);

    await saveDeviceConnectionSnapshot(args.deviceId, {
      currentTempC: payload.currentTempC,
      lastConnectionTestAt: payload.receivedAt,
      lastConnectionTestStatus: "success",
      lastSeenAt: payload.lastSeenAt,
      macAddress: payload.macAddress,
      mktStatus: payload.mktStatus,
      recordedAt: payload.recordedAt,
      rtcIso: payload.rtcIso,
      sdCardMounted: false,
      sequence: payload.latestSequence,
      timeSource: payload.timeSource,
    });

    await updateDeviceConnectionTestStatus({
      deviceId: args.deviceId,
      testedAt: payload.receivedAt,
      status: "success",
    });

    await syncDeviceConnectionAudit(
      {
        deviceId: args.deviceId,
        lastSeenAt: payload.lastSeenAt,
        status: "success",
        summary: payload.statusText,
        transport: payload.transport,
      },
      { queueOnFailure: true },
    ).catch(() => undefined);

    return payload;
  } catch (error) {
    await updateDeviceConnectionTestStatus({
      deviceId: args.deviceId,
      testedAt: Date.now(),
      status: "failed",
    });

    try {
      await recordDeviceConnectionTest({
        deviceId: args.deviceId,
        summary: error instanceof Error ? error.message : "Connection test failed.",
        status: "failed",
        transport: "runtime",
      });
    } catch {
      // Preserve the local failure state even if backend audit logging is unavailable.
    }

    throw error;
  }
}

export async function retryPendingDeviceConnectionAuditSync(args?: { deviceId?: string }) {
  const pendingJobs = await listPendingSyncJobs([DEVICE_CONNECTION_SYNC_JOB_TYPE]);

  for (const job of pendingJobs) {
    if (!isConnectionSyncJobPayload(job.payload)) {
      await deleteSyncJob(job.id);
      continue;
    }
    if (args?.deviceId && job.payload.deviceId !== args.deviceId) {
      continue;
    }

    await setSyncJobStatus(job.id, "processing");
    try {
      await syncDeviceConnectionAudit(job.payload, {
        existingJobId: job.id,
        queueOnFailure: false,
      });
    } catch {
      await setSyncJobStatus(job.id, "pending");
    }
  }
}

function normalizeConnectionLastSeenAt(payload: RemoteConnectionPayload, receivedAt: number) {
  if (typeof payload.lastSeenAgeMs === "number" && Number.isFinite(payload.lastSeenAgeMs) && payload.lastSeenAgeMs >= 0) {
    return receivedAt - payload.lastSeenAgeMs;
  }
  if (typeof payload.lastSeenAt === "number" && Number.isFinite(payload.lastSeenAt)) {
    return payload.lastSeenAt;
  }
  return receivedAt;
}

async function syncDeviceConnectionAudit(
  payload: ConnectionSyncJobPayload,
  options: {
    existingJobId?: string;
    queueOnFailure: boolean;
  },
) {
  await updateDeviceConnectionSyncState({
    deviceId: payload.deviceId,
    errorMessage: null,
    failureStage: "record_connection_test",
    status: "pending",
    updatedAt: Date.now(),
  });

  try {
    await recordDeviceConnectionTest(payload);
    await updateDeviceConnectionSyncState({
      deviceId: payload.deviceId,
      errorMessage: null,
      failureStage: null,
      status: "synced",
      updatedAt: Date.now(),
    });
    if (options.existingJobId) {
      await deleteSyncJob(options.existingJobId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Connection audit sync failed.";
    if (options.queueOnFailure) {
      await enqueueSyncJob(DEVICE_CONNECTION_SYNC_JOB_TYPE, payload);
    }
    await updateDeviceConnectionSyncState({
      deviceId: payload.deviceId,
      errorMessage,
      failureStage: "record_connection_test",
      status: "failed",
      updatedAt: Date.now(),
    });
    throw error;
  }
}

function isConnectionSyncJobPayload(payload: unknown): payload is ConnectionSyncJobPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<ConnectionSyncJobPayload>;
  return (
    typeof candidate.deviceId === "string" &&
    (candidate.lastSeenAt === undefined || typeof candidate.lastSeenAt === "number") &&
    (candidate.status === "success" || candidate.status === "failed") &&
    typeof candidate.summary === "string" &&
    typeof candidate.transport === "string"
  );
}

export async function assignColdGuardDevice(args: {
  deviceId: string;
  primaryStaffId: string | null;
  viewerStaffIds: string[];
}) {
  if (!args.primaryStaffId) {
    throw new Error("PRIMARY_ASSIGNEE_REQUIRED");
  }

  return await assignDeviceUsers({
    deviceId: args.deviceId,
    primaryStaffId: args.primaryStaffId,
    viewerStaffIds: args.viewerStaffIds.filter((staffId) => staffId !== args.primaryStaffId),
  });
}

export async function decommissionColdGuardDevice(args: {
  deviceId: string;
  profile: ProfileSnapshot;
  bleClient?: ColdGuardBleClient;
}) {
  if (args.profile.role !== "Supervisor") {
    throw new Error("DEVICE_MANAGEMENT_FORBIDDEN");
  }

  // Best-effort BLE wipe: if the device is unreachable, in blank state after a
  // re-flash, or out of range, we still want the backend and local records
  // cleaned up so the supervisor is not permanently stuck. Log the failure.
  try {
    const bleClient = args.bleClient ?? realBleClient;
    const handshakeToken = await getRequiredClinicHandshakeToken();
    const actionTicket = await ensureSupervisorActionTicket(args.profile, args.deviceId, "decommission");
    await bleClient.decommissionDevice({
      actionTicket,
      deviceId: args.deviceId,
      handshakeToken,
    });
  } catch (bleError) {
    console.warn(
      "[decommissionColdGuardDevice] BLE wipe skipped — device may be unreachable or in blank state.",
      { deviceId: args.deviceId, error: bleError instanceof Error ? bleError.message : String(bleError) },
    );
  }

  // Backend and local cleanup always run regardless of BLE outcome.
  await decommissionManagedDevice(args.deviceId);
  await deleteDeviceActionTicket("admin", args.deviceId, "decommission");
  await deleteDeviceActionTicket("device", args.deviceId, "connect");
  await deleteDeviceActionTicket("device", args.deviceId, "wifi_provision");
  await deleteConnectionGrant("admin", args.deviceId);
  await deleteConnectionGrant("device", args.deviceId);
  await deleteDeviceRuntimeConfig(args.deviceId);
}

async function getRequiredClinicHandshakeToken() {
  const handshakeToken = await getClinicHandshakeToken();
  if (!handshakeToken) {
    throw new Error("CLINIC_HANDSHAKE_TOKEN_MISSING");
  }
  return handshakeToken;
}

export async function bootstrapDefaultDeviceMonitoring(deviceId: string): Promise<DeviceRuntimeConfig> {
  await upsertDeviceRuntimeConfig(deviceId, {
    controlRole: "none",
    lastMonitorError: null,
    lastRuntimeError: null,
    monitoringMode: "foreground_service",
    sessionStatus: "connecting",
  });

  return await startDeviceMonitoring(deviceId, { allowDuringEnrollment: true });
}

async function ensureWifiBridgePermissions() {
  if (Platform.OS !== "android") {
    return;
  }

  if (!PermissionsAndroid?.requestMultiple || !PermissionsAndroid?.PERMISSIONS) {
    return;
  }

  const permissions =
    typeof Platform.Version === "number" && Platform.Version >= 33
      ? [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES ?? "android.permission.NEARBY_WIFI_DEVICES"]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION ?? "android.permission.ACCESS_FINE_LOCATION"];

  if (permissions.length === 0) {
    return;
  }

  const statuses = await PermissionsAndroid.requestMultiple(permissions);
  const denied = Object.values(statuses).some((status) => status !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied) {
    throw new Error("WIFI_PERMISSION_REQUIRED");
  }
}

async function ensureBleTransportPermissions() {
  if (Platform.OS !== "android") {
    return;
  }

  if (!PermissionsAndroid?.requestMultiple || !PermissionsAndroid?.PERMISSIONS) {
    return;
  }

  const permissions =
    typeof Platform.Version === "number" && Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT ?? "android.permission.BLUETOOTH_CONNECT",
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN ?? "android.permission.BLUETOOTH_SCAN",
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION ?? "android.permission.ACCESS_FINE_LOCATION"];

  if (permissions.length === 0) {
    return;
  }

  const statuses = await PermissionsAndroid.requestMultiple(permissions);
  const denied = Object.values(statuses).some((status) => status !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied) {
    throw new Error("BLE_PERMISSION_REQUIRED");
  }
}

async function ensureNotificationPermission() {
  if (Platform.OS === "web") {
    return;
  }

  const permissionStatus = await getLocalNotificationPermissionStatus();
  const nextPermissionStatus =
    permissionStatus === "undetermined" ? await requestLocalNotificationPermission() : permissionStatus;
  if (nextPermissionStatus !== "granted") {
    throw new Error(MONITORING_NOTIFICATION_PERMISSION_ERROR);
  }
}

async function ensureEnrollmentPermissions() {
  await ensureNotificationPermission();
  await ensureBleTransportPermissions();
  await ensureWifiBridgePermissions();
}

async function ensureMonitoringTransportPermissions() {
  await ensureBleTransportPermissions();
  await ensureWifiBridgePermissions();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapMonitoringStartupError(error: string) {
  if (error === "POST_NOTIFICATIONS_PERMISSION_REQUIRED") {
    return MONITORING_NOTIFICATION_PERMISSION_ERROR;
  }

  return error;
}
