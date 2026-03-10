import { initializeSQLite } from "./client";

export type CachedConnectionGrant = {
  expiresAt: number;
  payloadJson: string;
  scopeId: string;
  scopeType: "admin" | "device";
  updatedAt: number;
};

type ConnectionGrantRow = {
  expires_at: number;
  payload_json: string;
  scope_id: string;
  scope_type: "admin" | "device";
  updated_at: number;
};

export async function saveConnectionGrant(args: {
  expiresAt: number;
  payloadJson: string;
  scopeId: string;
  scopeType?: "admin" | "device";
}) {
  const database = await initializeSQLite();
  const scopeType = args.scopeType ?? "device";
  const updatedAt = Date.now();

  await database.runAsync(
    `
      INSERT OR REPLACE INTO connection_grants
      (scope_type, scope_id, payload_json, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    scopeType,
    args.scopeId,
    args.payloadJson,
    args.expiresAt,
    updatedAt,
  );

  return {
    expiresAt: args.expiresAt,
    payloadJson: args.payloadJson,
    scopeId: args.scopeId,
    scopeType,
    updatedAt,
  };
}

export async function getConnectionGrant(
  scopeType: "admin" | "device",
  scopeId: string,
): Promise<CachedConnectionGrant | null> {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<ConnectionGrantRow>(
    `
      SELECT scope_type, scope_id, payload_json, expires_at, updated_at
      FROM connection_grants
      WHERE scope_type = ? AND scope_id = ?
    `,
    scopeType,
    scopeId,
  );

  if (!row) return null;

  return {
    expiresAt: row.expires_at,
    payloadJson: row.payload_json,
    scopeId: row.scope_id,
    scopeType: row.scope_type,
    updatedAt: row.updated_at,
  };
}

export async function deleteConnectionGrant(scopeType: "admin" | "device", scopeId: string) {
  const database = await initializeSQLite();
  await database.runAsync("DELETE FROM connection_grants WHERE scope_type = ? AND scope_id = ?", scopeType, scopeId);
}
