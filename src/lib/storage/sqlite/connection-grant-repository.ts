import { initializeSQLite } from "./client";
import type { DeviceAction } from "../../../features/devices/types";

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

export type CachedDeviceActionTicketRecord = {
  action: DeviceAction;
  expiresAt: number;
  payloadJson: string;
  scopeId: string;
  scopeType: "admin" | "device";
  updatedAt: number;
};

type DeviceActionTicketRow = {
  action: DeviceAction;
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

export async function saveDeviceActionTicket(args: {
  action: DeviceAction;
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
      INSERT OR REPLACE INTO device_action_tickets
      (scope_type, scope_id, action, payload_json, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    scopeType,
    args.scopeId,
    args.action,
    args.payloadJson,
    args.expiresAt,
    updatedAt,
  );

  return {
    action: args.action,
    expiresAt: args.expiresAt,
    payloadJson: args.payloadJson,
    scopeId: args.scopeId,
    scopeType,
    updatedAt,
  };
}

export async function getDeviceActionTicket(
  scopeType: "admin" | "device",
  scopeId: string,
  action: DeviceAction,
): Promise<CachedDeviceActionTicketRecord | null> {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<DeviceActionTicketRow>(
    `
      SELECT scope_type, scope_id, action, payload_json, expires_at, updated_at
      FROM device_action_tickets
      WHERE scope_type = ? AND scope_id = ? AND action = ?
    `,
    scopeType,
    scopeId,
    action,
  );

  if (!row) return null;

  return {
    action: row.action,
    expiresAt: row.expires_at,
    payloadJson: row.payload_json,
    scopeId: row.scope_id,
    scopeType: row.scope_type,
    updatedAt: row.updated_at,
  };
}

export async function deleteDeviceActionTicket(
  scopeType: "admin" | "device",
  scopeId: string,
  action: DeviceAction,
) {
  const database = await initializeSQLite();
  await database.runAsync(
    "DELETE FROM device_action_tickets WHERE scope_type = ? AND scope_id = ? AND action = ?",
    scopeType,
    scopeId,
    action,
  );
}
