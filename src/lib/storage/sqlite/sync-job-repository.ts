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

function validateSyncJobPayloadValue(value: unknown, path: string, seen = new WeakSet<object>()) {
  if (value === undefined) {
    throw new Error(`Sync job payload contains undefined at ${path}.`);
  }

  if (typeof value === "function") {
    throw new Error(`Sync job payload contains a function at ${path}.`);
  }

  if (typeof value === "symbol") {
    throw new Error(`Sync job payload contains a symbol at ${path}.`);
  }

  if (typeof value === "bigint") {
    throw new Error(`Sync job payload contains a bigint at ${path}.`);
  }

  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    throw new Error(`Sync job payload contains a circular reference at ${path}.`);
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSyncJobPayloadValue(item, `${path}[${index}]`, seen));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    validateSyncJobPayloadValue(nestedValue, `${path}.${key}`, seen);
  }
}

function serializeSyncJobPayload(jobType: string, jobId: string, payload: unknown) {
  try {
    validateSyncJobPayloadValue(payload, "payload");
    const payloadJson = JSON.stringify(payload);

    if (payloadJson === undefined || payloadJson === "undefined") {
      throw new Error("Sync job payload did not serialize to valid JSON.");
    }

    return payloadJson;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown serialization error.";
    throw new Error(`Failed to serialize sync job payload for ${jobType} (${jobId}): ${detail}`);
  }
}

export async function enqueueSyncJob<TPayload>(jobType: string, payload: TPayload) {
  const database = await initializeSQLite();
  const now = Date.now();
  const id = `${jobType}-${now}-${Math.random().toString(16).slice(2, 10)}`;
  const payloadJson = serializeSyncJobPayload(jobType, id, payload);

  await database.runAsync(
    `
      INSERT INTO sync_jobs
      (id, job_type, payload_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    id,
    jobType,
    payloadJson,
    "pending",
    now,
    now,
  );

  return id;
}

export async function listPendingSyncJobs(jobTypes?: string[]) {
  const database = await initializeSQLite();
  if (Array.isArray(jobTypes) && jobTypes.length === 0) {
    return [];
  }
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
  let payload: unknown = null;

  try {
    payload = JSON.parse(row.payload_json);
  } catch (error) {
    console.error(`Failed to parse sync job payload for ${row.id}.`, error);
  }

  return {
    createdAt: row.created_at,
    id: row.id,
    jobType: row.job_type,
    payload,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
