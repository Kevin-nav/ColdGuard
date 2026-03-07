import { SQLiteDatabase, deleteDatabaseAsync, openDatabaseAsync } from "expo-sqlite";
import { SQLITE_SCHEMA_STATEMENTS } from "./schema";

const SQLITE_DATABASE_NAME = "coldguard.db";

let databasePromise: Promise<SQLiteDatabase> | null = null;

export async function getSQLiteDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(SQLITE_DATABASE_NAME).catch((error) => {
      databasePromise = null;
      throw error;
    });
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

function isMissingDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("enoent") || message.includes("no such file");
}

export async function resetSQLiteForTests() {
  const pendingDatabase = databasePromise;
  databasePromise = null;

  try {
    const database = pendingDatabase ? await pendingDatabase.catch(() => null) : null;
    await database?.closeAsync?.();
  } catch (error) {
    console.error("Failed to close SQLite database during test reset.", error);
  }

  try {
    await deleteDatabaseAsync(SQLITE_DATABASE_NAME);
  } catch (error) {
    if (isMissingDatabaseError(error)) return;
    console.error("Failed to delete SQLite database during test reset.", error);
  }
}
