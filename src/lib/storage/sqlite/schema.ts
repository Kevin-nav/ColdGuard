export const SQLITE_SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS profile_cache (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      firebase_uid TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      staff_id TEXT,
      role TEXT NOT NULL,
      last_updated_at INTEGER NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY NOT NULL,
      institution_name TEXT NOT NULL,
      nickname TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      current_temp_c REAL NOT NULL,
      mkt_status TEXT NOT NULL,
      battery_level INTEGER NOT NULL,
      door_open INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY NOT NULL,
      institution_name TEXT NOT NULL,
      device_id TEXT NOT NULL,
      temp_c REAL NOT NULL,
      mkt_c REAL NOT NULL,
      door_open INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      session_id TEXT
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS sync_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      job_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,
];
