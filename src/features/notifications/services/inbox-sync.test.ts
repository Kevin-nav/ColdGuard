import type { DeviceRecord } from "../../../lib/storage/sqlite/device-repository";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationIncidentRecord } from "../types";
import {
  __testing,
  acknowledgeIncidentWithSync,
  resolveIncidentWithSync,
  syncNotificationInbox,
  syncNotificationPreferences,
  updateNotificationPreferencesWithSync,
} from "./inbox-sync";

const mockQuery = jest.fn();
const mockMutation = jest.fn();
const mockGetDevicesForInstitution = jest.fn();
const mockArchiveNotification = jest.fn();
const mockGetNotificationById = jest.fn();
const mockGetNotificationPreferences = jest.fn();
const mockListNotificationStateForIncidentIds = jest.fn();
const mockListNotificationsForInstitution = jest.fn();
const mockMarkNotificationRead = jest.fn();
const mockReplaceNotificationCacheForInstitution = jest.fn();
const mockSaveNotificationCache = jest.fn();
const mockSaveNotificationPreferences = jest.fn();
const mockDeleteSyncJob = jest.fn();
const mockEnqueueSyncJob = jest.fn();
const mockListPendingSyncJobs = jest.fn();
const mockSetSyncJobStatus = jest.fn();

function buildRoutinePreferences(overrides: Partial<typeof DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType> = {}) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType,
    ...overrides,
  };
}

jest.mock("../../../lib/convex/client", () => ({
  getConvexClient: () => ({
    query: mockQuery,
    mutation: mockMutation,
  }),
}));

jest.mock("../../../lib/storage/sqlite/device-repository", () => ({
  getDevicesForInstitution: (...args: unknown[]) => mockGetDevicesForInstitution(...args),
}));

jest.mock("../../../lib/storage/sqlite/notification-repository", () => ({
  archiveNotification: (...args: unknown[]) => mockArchiveNotification(...args),
  getNotificationById: (...args: unknown[]) => mockGetNotificationById(...args),
  getNotificationPreferences: (...args: unknown[]) => mockGetNotificationPreferences(...args),
  listNotificationStateForIncidentIds: (...args: unknown[]) => mockListNotificationStateForIncidentIds(...args),
  listNotificationsForInstitution: (...args: unknown[]) => mockListNotificationsForInstitution(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
  replaceNotificationCacheForInstitution: (...args: unknown[]) => mockReplaceNotificationCacheForInstitution(...args),
  saveNotificationCache: (...args: unknown[]) => mockSaveNotificationCache(...args),
  saveNotificationPreferences: (...args: unknown[]) => mockSaveNotificationPreferences(...args),
}));

jest.mock("../../../lib/storage/sqlite/sync-job-repository", () => ({
  deleteSyncJob: (...args: unknown[]) => mockDeleteSyncJob(...args),
  enqueueSyncJob: (...args: unknown[]) => mockEnqueueSyncJob(...args),
  listPendingSyncJobs: (...args: unknown[]) => mockListPendingSyncJobs(...args),
  setSyncJobStatus: (...args: unknown[]) => mockSetSyncJobStatus(...args),
}));

function buildDevice(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: "device-1",
    institutionName: "Korle-Bu Teaching Hospital",
    nickname: "Cold Room Alpha",
    macAddress: "00:11:22:33:44:55",
    currentTempC: 12.4,
    mktStatus: "warning",
    batteryLevel: 80,
    doorOpen: false,
    lastSeenAt: Date.now(),
    ...overrides,
  };
}

function buildIncident(overrides: Partial<NotificationIncidentRecord> = {}): NotificationIncidentRecord {
  return {
    id: "incident-1",
    institutionName: "Korle-Bu Teaching Hospital",
    deviceId: "device-1",
    deviceNickname: "Cold Room Alpha",
    incidentType: "temperature",
    severity: "critical",
    status: "acknowledged",
    title: "Remote temperature incident",
    body: "Remote state wins.",
    firstTriggeredAt: 1_000,
    lastTriggeredAt: 2_000,
    acknowledgedAt: 2_100,
    resolvedAt: null,
    readAt: null,
    archivedAt: null,
    lastViewedVersion: 1,
    timeline: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListNotificationStateForIncidentIds.mockResolvedValue(new Map());
  mockListNotificationsForInstitution.mockResolvedValue([]);
  mockGetDevicesForInstitution.mockResolvedValue([]);
  mockReplaceNotificationCacheForInstitution.mockResolvedValue(undefined);
});

test("merges local-derived incidents with cached remote incidents without duplicating matching signals", async () => {
  mockQuery.mockResolvedValue([
    {
      incidentId: "remote-incident-1",
      body: "Remote state wins.",
      deviceId: "device-1",
      deviceNickname: "Cold Room Alpha",
      firstTriggeredAt: 1_000,
      incidentType: "temperature",
      lastTriggeredAt: 2_000,
      severity: "critical",
      status: "acknowledged",
      title: "Remote temperature incident",
      userState: {
        archivedAt: null,
        lastViewedVersion: 1,
        readAt: null,
      },
    },
  ]);
  mockListNotificationsForInstitution.mockResolvedValue([buildIncident({ id: "remote-incident-1" })]);
  mockGetDevicesForInstitution.mockResolvedValue([buildDevice()]);

  const result = await syncNotificationInbox("Korle-Bu Teaching Hospital", { isOnline: true });

  expect(result.syncError).toBeNull();
  expect(result.incidents).toHaveLength(1);
  expect(result.incidents[0]).toEqual(
    expect.objectContaining({
      id: "remote-incident-1",
      status: "acknowledged",
      severity: "critical",
      title: "Remote temperature incident",
    }),
  );
  expect(mockReplaceNotificationCacheForInstitution).toHaveBeenCalledWith(
    "Korle-Bu Teaching Hospital",
    expect.arrayContaining([
      expect.objectContaining({
        id: "remote-incident-1",
        deviceId: "device-1",
        incidentType: "temperature",
      }),
    ]),
  );
});

test("returns merged cached and local incidents with a sync error when remote refresh fails", async () => {
  mockQuery.mockRejectedValue(new Error("Convex unavailable"));
  mockListNotificationsForInstitution.mockResolvedValue([
    buildIncident({
      id: "remote-incident-9",
      deviceId: "device-9",
      deviceNickname: "Remote Freezer 9",
      incidentType: "battery_low",
      severity: "warning",
      status: "open",
      title: "Remote battery warning",
    }),
  ]);
  mockGetDevicesForInstitution.mockResolvedValue([
    buildDevice({
      id: "device-1",
      nickname: "Cold Room Alpha",
      mktStatus: "warning",
    }),
  ]);

  const result = await syncNotificationInbox("Korle-Bu Teaching Hospital", { isOnline: true });

  expect(result.syncError).toBe("Convex unavailable");
  expect(result.incidents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "remote-incident-9", incidentType: "battery_low" }),
      expect.objectContaining({ id: "device-1:temperature", incidentType: "temperature" }),
    ]),
  );
});

test("applies local notification state to local-derived incidents without persisting synthetic cache rows", async () => {
  mockGetDevicesForInstitution.mockResolvedValue([buildDevice()]);
  mockListNotificationStateForIncidentIds.mockResolvedValue(
    new Map([
      [
        "device-1:temperature",
        {
          readAt: 3_000,
          archivedAt: null,
          lastViewedVersion: 4,
        },
      ],
    ]),
  );

  const result = await syncNotificationInbox("Korle-Bu Teaching Hospital", { isOnline: false });

  expect(result.syncError).toBeNull();
  expect(result.incidents).toEqual([
    expect.objectContaining({
      id: "device-1:temperature",
      readAt: 3_000,
      lastViewedVersion: 4,
    }),
  ]);
  expect(mockReplaceNotificationCacheForInstitution).not.toHaveBeenCalled();
  expect(mockSaveNotificationCache).not.toHaveBeenCalled();
});

test("acknowledges a local-only incident by saving a synthetic cache row", async () => {
  let cachedIncidents: NotificationIncidentRecord[] = [];
  mockGetDevicesForInstitution.mockResolvedValue([buildDevice()]);
  mockGetNotificationById.mockResolvedValue(null);
  mockSaveNotificationCache.mockImplementation(async (incidents: NotificationIncidentRecord[]) => {
    cachedIncidents = incidents;
  });
  mockListNotificationsForInstitution.mockImplementation(async () => cachedIncidents);

  const result = await acknowledgeIncidentWithSync("device-1:temperature", "Korle-Bu Teaching Hospital", {
    isOnline: false,
  });

  expect(mockSaveNotificationCache).toHaveBeenCalledWith([
    expect.objectContaining({
      id: "device-1:temperature",
      status: "acknowledged",
    }),
  ]);
  expect(result?.incidents).toEqual([
    expect.objectContaining({
      id: "device-1:temperature",
      status: "acknowledged",
    }),
  ]);
});

test("keeps a resolved local-only incident until a newer trigger reopens it", () => {
  const resolved = buildIncident({
    id: "device-1:temperature",
    status: "resolved",
    resolvedAt: 5_000,
  });
  const derivedBeforeResolution = buildIncident({
    id: "device-1:temperature",
    status: "open",
    lastTriggeredAt: 4_000,
    resolvedAt: null,
  });
  const derivedAfterResolution = buildIncident({
    id: "device-1:temperature",
    status: "open",
    lastTriggeredAt: 6_000,
    resolvedAt: null,
  });

  expect(__testing.mergeCachedLocalIncident(resolved, derivedBeforeResolution)).toEqual(
    expect.objectContaining({
      id: "device-1:temperature",
      status: "resolved",
    }),
  );
  expect(__testing.mergeCachedLocalIncident(resolved, derivedAfterResolution)).toEqual(
    expect.objectContaining({
      id: "device-1:temperature",
      status: "open",
      lastTriggeredAt: 6_000,
    }),
  );
});

test("resolves a local-only incident by saving a synthetic cache row", async () => {
  let cachedIncidents: NotificationIncidentRecord[] = [];
  mockGetDevicesForInstitution.mockResolvedValue([buildDevice()]);
  mockGetNotificationById.mockResolvedValue(null);
  mockSaveNotificationCache.mockImplementation(async (incidents: NotificationIncidentRecord[]) => {
    cachedIncidents = incidents;
  });
  mockListNotificationsForInstitution.mockImplementation(async () => cachedIncidents);

  const result = await resolveIncidentWithSync("device-1:temperature", "Korle-Bu Teaching Hospital", {
    isOnline: false,
  });

  expect(mockSaveNotificationCache).toHaveBeenCalledWith([
    expect.objectContaining({
      id: "device-1:temperature",
      status: "resolved",
    }),
  ]);
  expect(result?.incidents).toEqual([
    expect.objectContaining({
      id: "device-1:temperature",
      status: "resolved",
    }),
  ]);
});

test("normalizes null quiet hours before sending notification preference mutations", async () => {
  mockSaveNotificationPreferences.mockResolvedValue({
    warningPushEnabled: true,
    warningLocalEnabled: true,
    recoveryPushEnabled: true,
    nonCriticalByType: buildRoutinePreferences(),
    quietHoursStart: null,
    quietHoursEnd: null,
    lastUpdatedAt: 10,
  });

  await updateNotificationPreferencesWithSync(
    {
      warningPushEnabled: true,
      warningLocalEnabled: true,
      recoveryPushEnabled: true,
      nonCriticalByType: buildRoutinePreferences({
        battery_low: false,
      }),
      quietHoursStart: null,
      quietHoursEnd: null,
    },
    { isOnline: true },
  );

  expect(mockMutation).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      nonCriticalByType: buildRoutinePreferences({
        battery_low: false,
      }),
      quietHoursStart: undefined,
      quietHoursEnd: undefined,
    }),
  );
});

test("drops runtime-only notification preference fields before sending the mutation", async () => {
  mockSaveNotificationPreferences.mockResolvedValue({
    warningPushEnabled: true,
    warningLocalEnabled: true,
    recoveryPushEnabled: true,
    nonCriticalByType: buildRoutinePreferences({
      temperature: false,
    }),
    quietHoursStart: null,
    quietHoursEnd: null,
    lastUpdatedAt: 10,
  });
  mockMutation.mockResolvedValue(undefined);

  await updateNotificationPreferencesWithSync(
    {
      warningPushEnabled: true,
      warningLocalEnabled: true,
      recoveryPushEnabled: true,
      nonCriticalByType: buildRoutinePreferences({
        temperature: false,
      }),
      quietHoursStart: null,
      quietHoursEnd: null,
      lastUpdatedAt: 10,
    } as typeof DEFAULT_NOTIFICATION_PREFERENCES,
    { isOnline: true },
  );

  expect(mockMutation).toHaveBeenCalledTimes(1);
  expect(mockMutation.mock.calls[0]?.[1]).toEqual(
    expect.not.objectContaining({
      lastUpdatedAt: expect.anything(),
    }),
  );
});

test("preserves local routine preferences when the remote preference payload is still on the legacy shape", async () => {
  mockGetNotificationPreferences.mockResolvedValue({
    warningPushEnabled: true,
    warningLocalEnabled: true,
    recoveryPushEnabled: true,
    nonCriticalByType: buildRoutinePreferences({
      temperature: false,
    }),
    quietHoursStart: null,
    quietHoursEnd: null,
    lastUpdatedAt: 10,
  });
  mockQuery.mockResolvedValue({
    warningPushEnabled: true,
    warningLocalEnabled: true,
    recoveryPushEnabled: true,
    quietHoursStart: null,
    quietHoursEnd: null,
  });
  mockSaveNotificationPreferences.mockResolvedValue({
    warningPushEnabled: true,
    warningLocalEnabled: true,
    recoveryPushEnabled: true,
    nonCriticalByType: buildRoutinePreferences({
      temperature: false,
    }),
    quietHoursStart: null,
    quietHoursEnd: null,
    lastUpdatedAt: 11,
  });

  const result = await syncNotificationPreferences({ isOnline: true });

  expect(mockSaveNotificationPreferences).toHaveBeenCalledWith(
    expect.objectContaining({
      nonCriticalByType: expect.objectContaining({
        temperature: false,
      }),
    }),
  );
  expect(result.nonCriticalByType.temperature).toBe(false);
});

test("does not treat unrelated validator failures as the legacy notification preference schema", () => {
  expect(
    __testing.isLegacyNotificationPreferenceValidatorError(
      new Error(
        "ArgumentValidationError: Object contains extra field `lastUpdatedAt` that is not in the validator.\n\nValidator: v.object({nonCriticalByType: v.object({temperature: v.boolean()})})",
      ),
    ),
  ).toBe(false);
});

test("falls back to the legacy mutation payload when the live validator rejects nonCriticalByType", async () => {
  mockSaveNotificationPreferences.mockResolvedValue({
    warningPushEnabled: true,
    warningLocalEnabled: true,
    recoveryPushEnabled: true,
    nonCriticalByType: buildRoutinePreferences({
      temperature: false,
    }),
    quietHoursStart: null,
    quietHoursEnd: null,
    lastUpdatedAt: 10,
  });
  mockMutation
    .mockRejectedValueOnce(
      new Error(
        "ArgumentValidationError: Object contains extra field `nonCriticalByType` that is not in the validator.",
      ),
    )
    .mockResolvedValueOnce(undefined);

  await updateNotificationPreferencesWithSync(
    {
      warningPushEnabled: true,
      warningLocalEnabled: true,
      recoveryPushEnabled: true,
      nonCriticalByType: buildRoutinePreferences({
        temperature: false,
      }),
      quietHoursStart: null,
      quietHoursEnd: null,
    },
    { isOnline: true },
  );

  expect(mockMutation).toHaveBeenNthCalledWith(
    1,
    expect.anything(),
    expect.objectContaining({
      nonCriticalByType: expect.objectContaining({
        temperature: false,
      }),
    }),
  );
  expect(mockMutation).toHaveBeenNthCalledWith(
    2,
    expect.anything(),
    expect.not.objectContaining({
      nonCriticalByType: expect.anything(),
    }),
  );
});

test("exports safe default routine preferences for every notification type", () => {
  expect(DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType).toEqual({
    temperature: true,
    door_open: true,
    device_offline: true,
    battery_low: true,
  });
});

test("exposes a helper that converts null quiet hours to undefined", () => {
  expect(
    __testing.normalizeNotificationPreferencePayload({
      warningPushEnabled: true,
      warningLocalEnabled: true,
      recoveryPushEnabled: true,
      nonCriticalByType: buildRoutinePreferences({
        temperature: false,
      }),
      quietHoursStart: null,
      quietHoursEnd: null,
    }),
  ).toEqual({
    warningPushEnabled: true,
    warningLocalEnabled: true,
    recoveryPushEnabled: true,
    nonCriticalByType: buildRoutinePreferences({
      temperature: false,
    }),
    quietHoursStart: undefined,
    quietHoursEnd: undefined,
  });
});

test("detects the legacy notification preference validator error shape", () => {
  expect(
    __testing.isLegacyNotificationPreferenceValidatorError(
      new Error(
        "ArgumentValidationError: Object contains extra field `nonCriticalByType` that is not in the validator.",
      ),
    ),
  ).toBe(true);
  expect(__testing.isLegacyNotificationPreferenceValidatorError(new Error("something else"))).toBe(false);
});
