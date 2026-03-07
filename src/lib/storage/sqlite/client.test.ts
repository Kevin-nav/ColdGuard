import { deleteDatabaseAsync, openDatabaseAsync } from "expo-sqlite";
import { getSQLiteDatabase, initializeSQLite, resetSQLiteForTests } from "./client";
import { SQLITE_SCHEMA_STATEMENTS } from "./schema";

const mockCloseAsync = jest.fn(async () => undefined);

jest.mock("expo-sqlite", () => ({
  deleteDatabaseAsync: jest.fn(async () => undefined),
  openDatabaseAsync: jest.fn(async () => ({
    closeAsync: mockCloseAsync,
    execAsync: jest.fn(async () => undefined),
  })),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSQLiteForTests();
});

test("initializes sqlite and creates all required tables", async () => {
  const db = await initializeSQLite();

  expect(openDatabaseAsync).toHaveBeenCalledWith("coldguard.db");
  expect(db.execAsync).toHaveBeenCalledTimes(SQLITE_SCHEMA_STATEMENTS.length);
});

test("resets the cached promise when opening sqlite fails", async () => {
  jest.mocked(openDatabaseAsync).mockRejectedValueOnce(new Error("open failed"));

  await expect(getSQLiteDatabase()).rejects.toThrow("open failed");

  jest.mocked(openDatabaseAsync).mockResolvedValueOnce({
    closeAsync: mockCloseAsync,
    execAsync: jest.fn(async () => undefined),
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
