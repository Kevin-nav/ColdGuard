import { SQLiteDatabase, openDatabaseAsync } from "expo-sqlite";
import { SQLITE_SCHEMA_STATEMENTS } from "./schema";

let databasePromise: Promise<SQLiteDatabase> | null = null;

export async function getSQLiteDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync("coldguard.db");
  }

  return await databasePromise;
}

export async function initializeSQLite() {
  const database = await getSQLiteDatabase();

  for (const statement of SQLITE_SCHEMA_STATEMENTS) {
    await database.execAsync(statement);
  }

  return database;
}

export function resetSQLiteForTests() {
  databasePromise = null;
}
