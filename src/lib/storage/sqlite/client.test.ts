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
  mockGetAllAsync.mockImplementation(async (query: string) => {
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
        { name: "door_open" },
        { name: "last_seen_at" },
      ];
    }

    return [];
  });

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
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("UPDATE devices"));
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("SET institution_id ="));
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("FROM profile_cache"));
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("institution_name != ''"));
  expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("institution_name = ("));
});
