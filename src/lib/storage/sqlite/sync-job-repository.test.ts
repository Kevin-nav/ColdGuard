import {
  deleteSyncJob,
  enqueueSyncJob,
  listPendingSyncJobs,
  setSyncJobStatus,
} from "./sync-job-repository";

const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetAllAsync: jest.Mock<any, any> = jest.fn(async () => []);

jest.mock("./client", () => ({
  initializeSQLite: jest.fn(async () => ({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("queues and lists sync jobs", async () => {
  const id = await enqueueSyncJob("acknowledge_incident", { incidentId: "incident-1" });

  mockGetAllAsync.mockResolvedValue([
    {
      id,
      job_type: "acknowledge_incident",
      payload_json: JSON.stringify({ incidentId: "incident-1" }),
      status: "pending",
      created_at: 1,
      updated_at: 1,
    },
  ]);

  await expect(listPendingSyncJobs()).resolves.toEqual([
    expect.objectContaining({
      id,
      jobType: "acknowledge_incident",
      payload: { incidentId: "incident-1" },
    }),
  ]);
});

test("updates sync job lifecycle", async () => {
  await setSyncJobStatus("job-1", "processing");
  await deleteSyncJob("job-1");

  expect(mockRunAsync).toHaveBeenCalledTimes(2);
});

test("returns a safe null payload when a sync job row is corrupted", async () => {
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  mockGetAllAsync.mockResolvedValue([
    {
      id: "job-1",
      job_type: "mark_notification_read",
      payload_json: "{not-valid-json",
      status: "pending",
      created_at: 1,
      updated_at: 1,
    },
  ]);

  await expect(listPendingSyncJobs()).resolves.toEqual([
    expect.objectContaining({
      id: "job-1",
      jobType: "mark_notification_read",
      payload: null,
    }),
  ]);
  expect(consoleErrorSpy).toHaveBeenCalled();

  consoleErrorSpy.mockRestore();
});
