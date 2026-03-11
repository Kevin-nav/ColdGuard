import { SQLiteDatabase, deleteDatabaseAsync, openDatabaseAsync } from "expo-sqlite";
import { SQLITE_LEGACY_COLUMN_MIGRATIONS, SQLITE_SCHEMA_STATEMENTS } from "./schema";

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

  await migrateLegacySQLiteSchema(database);

  return database;
}

type SQLiteTableInfoRow = {
  name: string;
};

async function migrateLegacySQLiteSchema(database: SQLiteDatabase) {
  await ensureLegacyColumns(database, "profile_cache", SQLITE_LEGACY_COLUMN_MIGRATIONS.profile_cache);
  await ensureLegacyColumns(database, "devices", SQLITE_LEGACY_COLUMN_MIGRATIONS.devices);
  await ensureLegacyColumns(database, "connection_grants", SQLITE_LEGACY_COLUMN_MIGRATIONS.connection_grants);
  await backfillLegacyDeviceInstitutionIds(database);
}

async function ensureLegacyColumns(
  database: SQLiteDatabase,
  tableName: string,
  columnMigrations: Record<string, string>,
) {
  const existingColumns = await database.getAllAsync<SQLiteTableInfoRow>(`PRAGMA table_info(${tableName})`);
  if (existingColumns.length === 0) {
    return;
  }

  const existingColumnNames = new Set(existingColumns.map((column) => column.name));
  for (const [columnName, migrationSql] of Object.entries(columnMigrations)) {
    if (!existingColumnNames.has(columnName)) {
      await database.execAsync(migrationSql);
    }
  }
}

async function backfillLegacyDeviceInstitutionIds(database: SQLiteDatabase) {
  await database.execAsync(`
    UPDATE devices
    SET institution_id = (
      SELECT institution_id
      FROM profile_cache
      WHERE id = 1
    )
    WHERE institution_id = ''
      AND EXISTS (
        SELECT 1
        FROM profile_cache
        WHERE id = 1
          AND institution_id != ''
      )
  `);
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
