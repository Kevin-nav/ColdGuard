import { deleteDatabaseAsync, openDatabaseAsync } from "expo-sqlite";
import { getSQLiteDatabase, initializeSQLite, resetSQLiteForTests } from "./client";
import { SQLITE_SCHEMA_STATEMENTS } from "./schema";

const mockCloseAsync = jest.fn(async () => undefined);
const mockExecAsync = jest.fn(async () => undefined);
const mockGetAllAsync = jest.fn(async () => []);

jest.mock("expo-sqlite", () => ({
  deleteDatabaseAsync: jest.fn(async () => undefined),
  openDatabaseAsync: jest.fn(async () => ({
    closeAsync: mockCloseAsync,
    execAsync: mockExecAsync,
    getAllAsync: mockGetAllAsync,
  })),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSQLiteForTests();
});

test("initializes sqlite and creates all required tables", async () => {
  const db = await initializeSQLite();

  expect(openDatabaseAsync).toHaveBeenCalledWith("coldguard.db");
  expect(db.execAsync).toHaveBeenCalledTimes(SQLITE_SCHEMA_STATEMENTS.length + 1);
});

test("reuses a single sqlite initialization across concurrent callers", async () => {
  const [first, second] = await Promise.all([initializeSQLite(), initializeSQLite()]);

  expect(first).toBe(second);
  expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  expect(mockExecAsync).toHaveBeenCalledTimes(SQLITE_SCHEMA_STATEMENTS.length + 1);
});

test("resets the cached promise when opening sqlite fails", async () => {
  jest.mocked(openDatabaseAsync).mockRejectedValueOnce(new Error("open failed"));

  await expect(getSQLiteDatabase()).rejects.toThrow("open failed");

  jest.mocked(openDatabaseAsync).mockResolvedValueOnce({
    closeAsync: mockCloseAsync,
    execAsync: mockExecAsync,
    getAllAsync: mockGetAllAsync,
  } as any);

  await expect(getSQLiteDatabase()).resolves.toBeTruthy();
  expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
});

test("deletes the on-disk database and closes open connections during reset", async () => {
  await initializeSQLite();
  mockCloseAsync.mockClear();

  await resetSQLiteForTests();

  expect(mockCloseAsync).toHaveBeenCalledTimes(1);
  expect(deleteDatabaseAsync).toHaveBeenCalledWith("coldguard.db");
});

test("ignores missing-database delete errors during reset", async () => {
  jest.mocked(deleteDatabaseAsync).mockRejectedValueOnce(new Error("ENOENT: no such file or directory"));

  await expect(resetSQLiteForTests()).resolves.toBeUndefined();
});

test("migrates legacy sqlite tables without dropping cached data", async () => {
  mockGetAllAsync.mockImplementation((async (query: string) => {
    if (query.includes("profile_cache")) {
      return [
        { name: "id" },
        { name: "firebase_uid" },
        { name: "display_name" },
        { name: "email" },
        { name: "institution_name" },
        { name: "staff_id" },
        { name: "role" },
        { name: "last_updated_at" },
      ];
    }

    if (query.includes("devices")) {
      return [
        { name: "id" },
        { name: "institution_name" },
        { name: "nickname" },
        { name: "mac_address" },
        { name: "current_temp_c" },
        { name: "mkt_status" },
        { name: "battery_level" },
        { name: "battery_voltage_v" },
        { name: "current_ma" },
        { name: "power_mw" },
        { name: "battery_percent_estimate" },
        { name: "latest_sequence" },
        { name: "recorded_at" },
        { name: "rtc_iso" },
        { name: "time_source" },
        { name: "sd_card_mounted" },
        { name: "shunt_voltage_mv" },
        { name: "last_seen_at" },
      ];
    }

    if (query.includes("readings")) {
      return [
        { name: "id" },
        { name: "institution_name" },
        { name: "device_id" },
        { name: "recorded_at" },
      ];
    }

    if (query.includes("device_runtime_config")) {
      return [
        { name: "device_id" },
        { name: "active_transport" },
        { name: "session_status" },
        { name: "monitoring_mode" },
        { name: "active_runtime_base_url" },
        { name: "facility_wifi_ssid" },
        { name: "facility_wifi_password" },
        { name: "facility_wifi_runtime_base_url" },
        { name: "softap_ssid" },
        { name: "softap_password" },
        { name: "softap_runtime_base_url" },
        { name: "last_ping_at" },
        { name: "last_recover_at" },
        { name: "last_monitor_at" },
        { name: "last_runtime_error" },
        { name: "last_monitor_error" },
        { name: "updated_at" },
      ];
    }

    return [];
  }) as any);

  await initializeSQLite();

  expect(mockExecAsync).not.toHaveBeenCalledWith(expect.stringContaining("DROP TABLE IF EXISTS"));
  expect(mockExecAsync).toHaveBeenCalledWith(
    "ALTER TABLE profile_cache ADD COLUMN institution_id TEXT NOT NULL DEFAULT ''",
  );
  expect(mockExecAsync).toHaveBeenCalledWith(
    "ALTER TABLE devices ADD COLUMN firmware_version TEXT NOT NULL DEFAULT ''",
  );
  expect(mockExecAsync).toHaveBeenCalledWith(
    "ALTER TABLE devices ADD COLUMN last_connection_test_status TEXT",
  );
  expect(mockExecAsync).toHaveBeenCalledWith(
    "ALTER TABLE devices ADD COLUMN last_connection_sync_status TEXT NOT NULL DEFAULT 'idle'",
  );
  expect(mockExecAsync).toHaveBeenCalledWith(
    "ALTER TABLE readings ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0",
  );
  expect(mockExecAsync).toHaveBeenCalledWith(
    "ALTER TABLE device_runtime_config ADD COLUMN telemetry_history_cursor INTEGER",
  );
  expect(mockExecAsync).toHaveBeenCalledWith(
    "ALTER TABLE device_runtime_config ADD COLUMN telemetry_upload_cursor INTEGER",
  );
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("UPDATE devices"));
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("SET institution_id ="));
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("FROM profile_cache"));
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("institution_name != ''"));
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("institution_name = ("));
});
