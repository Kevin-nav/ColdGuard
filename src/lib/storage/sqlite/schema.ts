export const SQLITE_TABLE_DEFINITIONS = {
  profileCache: `
    CREATE TABLE IF NOT EXISTS profile_cache (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      firebase_uid TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      staff_id TEXT,
      role TEXT NOT NULL,
      last_updated_at INTEGER NOT NULL
    );
  `,
  devices: `
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      nickname TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      firmware_version TEXT NOT NULL DEFAULT '',
      protocol_version INTEGER NOT NULL DEFAULT 1,
      device_status TEXT NOT NULL DEFAULT 'enrolled',
      grant_version INTEGER NOT NULL DEFAULT 1,
      access_role TEXT NOT NULL DEFAULT 'viewer',
      primary_assignee_name TEXT,
      primary_assignee_staff_id TEXT,
      viewer_names_json TEXT NOT NULL DEFAULT '[]',
      current_temp_c REAL NOT NULL,
      mkt_status TEXT NOT NULL,
      battery_level INTEGER NOT NULL,
      door_open INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      last_connection_test_at INTEGER,
      last_connection_test_status TEXT
    );
  `,
  readings: `
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
  syncJobs: `
    CREATE TABLE IF NOT EXISTS sync_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      job_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,
  connectionGrants: `
    CREATE TABLE IF NOT EXISTS connection_grants (
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (scope_type, scope_id)
    );
  `,
  deviceActionTickets: `
    CREATE TABLE IF NOT EXISTS device_action_tickets (
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (scope_type, scope_id, action)
    );
  `,
  notificationCache: `
    CREATE TABLE IF NOT EXISTS notification_cache (
      incident_id TEXT PRIMARY KEY NOT NULL,
      institution_name TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_nickname TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      first_triggered_at INTEGER NOT NULL,
      last_triggered_at INTEGER NOT NULL,
      acknowledged_at INTEGER,
      resolved_at INTEGER,
      last_synced_at INTEGER NOT NULL
    );
  `,
  notificationStateCache: `
    CREATE TABLE IF NOT EXISTS notification_state_cache (
      incident_id TEXT PRIMARY KEY NOT NULL,
      read_at INTEGER,
      archived_at INTEGER,
      last_viewed_version INTEGER NOT NULL DEFAULT 0
    );
  `,
  notificationPreferencesCache: `
    CREATE TABLE IF NOT EXISTS notification_preferences_cache (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      warning_push_enabled INTEGER NOT NULL,
      warning_local_enabled INTEGER NOT NULL,
      recovery_push_enabled INTEGER NOT NULL,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      last_updated_at INTEGER NOT NULL
    );
  `,
  notificationPreferenceTypeCache: `
    CREATE TABLE IF NOT EXISTS notification_preference_type_cache (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      temperature_enabled INTEGER NOT NULL,
      door_open_enabled INTEGER NOT NULL,
      device_offline_enabled INTEGER NOT NULL,
      battery_low_enabled INTEGER NOT NULL
    );
  `,
} as const;

export const SQLITE_LEGACY_COLUMN_MIGRATIONS = {
  profile_cache: {
    institution_id: "ALTER TABLE profile_cache ADD COLUMN institution_id TEXT NOT NULL DEFAULT ''",
  },
  devices: {
    institution_id: "ALTER TABLE devices ADD COLUMN institution_id TEXT NOT NULL DEFAULT ''",
    firmware_version: "ALTER TABLE devices ADD COLUMN firmware_version TEXT NOT NULL DEFAULT ''",
    protocol_version: "ALTER TABLE devices ADD COLUMN protocol_version INTEGER NOT NULL DEFAULT 1",
    device_status: "ALTER TABLE devices ADD COLUMN device_status TEXT NOT NULL DEFAULT 'enrolled'",
    grant_version: "ALTER TABLE devices ADD COLUMN grant_version INTEGER NOT NULL DEFAULT 1",
    access_role: "ALTER TABLE devices ADD COLUMN access_role TEXT NOT NULL DEFAULT 'viewer'",
    primary_assignee_name: "ALTER TABLE devices ADD COLUMN primary_assignee_name TEXT",
    primary_assignee_staff_id: "ALTER TABLE devices ADD COLUMN primary_assignee_staff_id TEXT",
    viewer_names_json: "ALTER TABLE devices ADD COLUMN viewer_names_json TEXT NOT NULL DEFAULT '[]'",
    last_connection_test_at: "ALTER TABLE devices ADD COLUMN last_connection_test_at INTEGER",
    last_connection_test_status: "ALTER TABLE devices ADD COLUMN last_connection_test_status TEXT",
  },
  connection_grants: {
    expires_at: "ALTER TABLE connection_grants ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0",
    updated_at: "ALTER TABLE connection_grants ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
    payload_json: "ALTER TABLE connection_grants ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}'",
    scope_id: "ALTER TABLE connection_grants ADD COLUMN scope_id TEXT NOT NULL DEFAULT ''",
    scope_type: "ALTER TABLE connection_grants ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'device'",
  },
} as const;

export const SQLITE_SCHEMA_STATEMENTS = [
  SQLITE_TABLE_DEFINITIONS.profileCache,
  SQLITE_TABLE_DEFINITIONS.devices,
  SQLITE_TABLE_DEFINITIONS.readings,
  SQLITE_TABLE_DEFINITIONS.syncJobs,
  SQLITE_TABLE_DEFINITIONS.connectionGrants,
  SQLITE_TABLE_DEFINITIONS.deviceActionTickets,
  SQLITE_TABLE_DEFINITIONS.notificationCache,
  SQLITE_TABLE_DEFINITIONS.notificationStateCache,
  SQLITE_TABLE_DEFINITIONS.notificationPreferencesCache,
  SQLITE_TABLE_DEFINITIONS.notificationPreferenceTypeCache,
];
