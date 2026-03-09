import * as Notifications from "expo-notifications";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationIncidentRecord } from "../types";
import { mirrorNotificationsLocally } from "./local-notifications";

function buildIncident(overrides: Partial<NotificationIncidentRecord> = {}): NotificationIncidentRecord {
  return {
    id: "incident-1",
    institutionName: "Korle-Bu Teaching Hospital",
    deviceId: "device-1",
    deviceNickname: "Cold Room Alpha",
    incidentType: "temperature",
    severity: "warning",
    status: "open",
    title: "Temperature warning",
    body: "Cold room drifting out of range.",
    firstTriggeredAt: 1_000,
    lastTriggeredAt: 2_000,
    acknowledgedAt: null,
    resolvedAt: null,
    readAt: null,
    archivedAt: null,
    lastViewedVersion: 0,
    timeline: [],
    ...overrides,
  };
}

function buildPreferences(
  overrides: Partial<Omit<typeof DEFAULT_NOTIFICATION_PREFERENCES, "lastUpdatedAt">> = {},
) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...overrides,
    nonCriticalByType: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.nonCriticalByType,
      ...overrides.nonCriticalByType,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("skips routine local notifications when that type is disabled", async () => {
  await mirrorNotificationsLocally(
    [buildIncident()],
    buildPreferences({
      nonCriticalByType: {
        temperature: false,
      },
    }),
  );

  expect(jest.mocked(Notifications.scheduleNotificationAsync)).not.toHaveBeenCalled();
});

test("still schedules critical local notifications even when routine local alerts are disabled", async () => {
  await mirrorNotificationsLocally(
    [
      buildIncident({
        id: "incident-2",
        severity: "critical",
        lastTriggeredAt: 3_000,
      }),
    ],
    buildPreferences({
      warningLocalEnabled: false,
      nonCriticalByType: {
        temperature: false,
      },
    }),
  );

  expect(jest.mocked(Notifications.scheduleNotificationAsync)).toHaveBeenCalledWith({
    content: expect.objectContaining({
      sound: "default",
      title: "Temperature warning",
    }),
    trigger: null,
  });
});
