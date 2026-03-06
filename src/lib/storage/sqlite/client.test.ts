import { openDatabaseAsync } from "expo-sqlite";
import { initializeSQLite, resetSQLiteForTests } from "./client";
import { SQLITE_SCHEMA_STATEMENTS } from "./schema";

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetSQLiteForTests();
});

test("initializes sqlite and creates all required tables", async () => {
  const db = await initializeSQLite();

  expect(openDatabaseAsync).toHaveBeenCalledWith("coldguard.db");
  expect(db.execAsync).toHaveBeenCalledTimes(SQLITE_SCHEMA_STATEMENTS.length);
});
