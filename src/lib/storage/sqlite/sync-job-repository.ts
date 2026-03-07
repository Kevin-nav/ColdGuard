import { initializeSQLite } from "./client";

export type SyncJobStatus = "pending" | "processing";

export type SyncJobRecord<TPayload = unknown> = {
  createdAt: number;
  id: string;
  jobType: string;
  payload: TPayload;
  status: SyncJobStatus;
  updatedAt: number;
};

type SyncJobRow = {
  created_at: number;
  id: string;
  job_type: string;
  payload_json: string;
  status: SyncJobStatus;
  updated_at: number;
};

export async function enqueueSyncJob<TPayload>(jobType: string, payload: TPayload) {
  const database = await initializeSQLite();
  const now = Date.now();
  const id = `${jobType}-${now}-${Math.random().toString(16).slice(2, 10)}`;

  await database.runAsync(
    `
      INSERT INTO sync_jobs
      (id, job_type, payload_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    id,
    jobType,
    JSON.stringify(payload),
    "pending",
    now,
    now,
  );

  return id;
}

export async function listPendingSyncJobs(jobTypes?: string[]) {
  const database = await initializeSQLite();
  const rows = jobTypes?.length
    ? await database.getAllAsync<SyncJobRow>(
        `
          SELECT id, job_type, payload_json, status, created_at, updated_at
          FROM sync_jobs
          WHERE status = 'pending'
            AND job_type IN (${jobTypes.map(() => "?").join(", ")})
          ORDER BY created_at ASC
        `,
        ...jobTypes,
      )
    : await database.getAllAsync<SyncJobRow>(
        `
          SELECT id, job_type, payload_json, status, created_at, updated_at
          FROM sync_jobs
          WHERE status = 'pending'
          ORDER BY created_at ASC
        `,
      );

  return rows.map(mapSyncJobRow);
}

export async function setSyncJobStatus(jobId: string, status: SyncJobStatus) {
  const database = await initializeSQLite();
  await database.runAsync(
    `
      UPDATE sync_jobs
      SET status = ?, updated_at = ?
      WHERE id = ?
    `,
    status,
    Date.now(),
    jobId,
  );
}

export async function deleteSyncJob(jobId: string) {
  const database = await initializeSQLite();
  await database.runAsync("DELETE FROM sync_jobs WHERE id = ?", jobId);
}

function mapSyncJobRow(row: SyncJobRow): SyncJobRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    jobType: row.job_type,
    payload: JSON.parse(row.payload_json),
    status: row.status,
    updatedAt: row.updated_at,
  };
}
