import {
  getNotificationById,
  getNotificationPreferences,
  getUnreadNotificationCount,
  listNotificationsForInstitution,
  markNotificationRead,
  saveNotificationCache,
  saveNotificationPreferences,
} from "./notification-repository";

const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetAllAsync: jest.Mock<any, any> = jest.fn(async () => []);
const mockGetFirstAsync: jest.Mock<any, any> = jest.fn(async () => null);

jest.mock("./client", () => ({
  initializeSQLite: jest.fn(async () => ({
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("loads notifications joined with local read state", async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      incident_id: "incident-1",
      institution_name: "Korle-Bu Teaching Hospital",
      device_id: "device-1",
      device_nickname: "Cold Room Alpha",
      incident_type: "temperature",
      severity: "critical",
      status: "open",
      title: "Temperature excursion",
      body: "Immediate intervention required.",
      first_triggered_at: 1000,
      last_triggered_at: 2000,
      acknowledged_at: null,
      resolved_at: null,
      read_at: null,
      archived_at: null,
      last_viewed_version: 0,
    },
  ]);

  await expect(listNotificationsForInstitution("Korle-Bu Teaching Hospital")).resolves.toEqual([
    expect.objectContaining({
      id: "incident-1",
      deviceNickname: "Cold Room Alpha",
      incidentType: "temperature",
      severity: "critical",
      status: "open",
      readAt: null,
    }),
  ]);
});

test("marks a notification as read using the existing state row", async () => {
  mockGetFirstAsync.mockResolvedValue({
    incident_id: "incident-1",
    institution_name: "Korle-Bu Teaching Hospital",
    device_id: "device-1",
    device_nickname: "Cold Room Alpha",
    incident_type: "temperature",
    severity: "critical",
    status: "open",
    title: "Temperature excursion",
    body: "Immediate intervention required.",
    first_triggered_at: 1000,
    last_triggered_at: 2000,
    acknowledged_at: null,
    resolved_at: null,
    read_at: null,
    archived_at: null,
    last_viewed_version: 0,
  });

  await markNotificationRead("incident-1");

  expect(mockRunAsync).toHaveBeenCalled();
});

test("saves and loads notification preferences", async () => {
  await saveNotificationPreferences({
    warningPushEnabled: true,
    warningLocalEnabled: false,
    recoveryPushEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "06:00",
  });

  mockGetFirstAsync.mockResolvedValue({
    warning_push_enabled: 1,
    warning_local_enabled: 0,
    recovery_push_enabled: 1,
    quiet_hours_start: "22:00",
    quiet_hours_end: "06:00",
    last_updated_at: 1234,
  });

  await expect(getNotificationPreferences()).resolves.toEqual({
    warningPushEnabled: true,
    warningLocalEnabled: false,
    recoveryPushEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "06:00",
    lastUpdatedAt: 1234,
  });
});

test("returns unread count from the joined cache tables", async () => {
  mockGetFirstAsync.mockResolvedValue({ unread_count: 3 });

  await expect(getUnreadNotificationCount("Korle-Bu Teaching Hospital")).resolves.toBe(3);
});

test("loads a single notification by id", async () => {
  mockGetFirstAsync.mockResolvedValue({
    incident_id: "incident-9",
    institution_name: "Korle-Bu Teaching Hospital",
    device_id: "device-7",
    device_nickname: "Outreach Carrier 7",
    incident_type: "door_open",
    severity: "warning",
    status: "acknowledged",
    title: "Door open",
    body: "Close the carrier lid.",
    first_triggered_at: 1000,
    last_triggered_at: 2000,
    acknowledged_at: 2100,
    resolved_at: null,
    read_at: 2200,
    archived_at: null,
    last_viewed_version: 1,
  });

  await expect(getNotificationById("incident-9")).resolves.toEqual(
    expect.objectContaining({
      id: "incident-9",
      status: "acknowledged",
      incidentType: "door_open",
    }),
  );
});

test("writes notification cache records", async () => {
  await saveNotificationCache([
    {
      id: "incident-1",
      institutionName: "Korle-Bu Teaching Hospital",
      deviceId: "device-1",
      deviceNickname: "Cold Room Alpha",
      incidentType: "temperature",
      severity: "critical",
      status: "open",
      title: "Temperature excursion",
      body: "Immediate intervention required.",
      firstTriggeredAt: 1000,
      lastTriggeredAt: 2000,
      acknowledgedAt: null,
      resolvedAt: null,
      readAt: null,
      archivedAt: null,
      lastViewedVersion: 0,
      timeline: [],
    },
  ]);

  expect(mockRunAsync).toHaveBeenCalled();
});
