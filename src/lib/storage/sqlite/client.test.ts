jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
  })),
}));

const { openDatabaseAsync } = require("expo-sqlite");
const { initializeSQLite, resetSQLiteForTests } = require("./client");
const { SQLITE_SCHEMA_STATEMENTS } = require("./schema");

beforeEach(() => {
  jest.clearAllMocks();
  resetSQLiteForTests();
});

test("initializes sqlite and creates all required tables", async () => {
  const db = await initializeSQLite();

  expect(openDatabaseAsync).toHaveBeenCalledWith("coldguard.db");
  expect(db.execAsync).toHaveBeenCalledTimes(SQLITE_SCHEMA_STATEMENTS.length);
});
