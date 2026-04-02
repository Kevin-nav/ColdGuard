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
      battery_voltage_v REAL NOT NULL DEFAULT 0,
      current_ma REAL NOT NULL DEFAULT 0,
      power_mw REAL NOT NULL DEFAULT 0,
      battery_percent_estimate INTEGER NOT NULL DEFAULT 0,
      latest_sequence INTEGER NOT NULL DEFAULT 0,
      recorded_at INTEGER NOT NULL DEFAULT 0,
      rtc_iso TEXT,
      time_source TEXT NOT NULL DEFAULT 'unknown',
      sd_card_mounted INTEGER NOT NULL DEFAULT 0,
      shunt_voltage_mv REAL NOT NULL DEFAULT 0,
      last_seen_at INTEGER NOT NULL,
      last_connection_test_at INTEGER,
      last_connection_test_status TEXT,
      last_connection_sync_status TEXT NOT NULL DEFAULT 'idle',
      last_connection_sync_updated_at INTEGER,
      last_connection_sync_failure_stage TEXT,
      last_connection_sync_error TEXT
    );
  `,
  readings: `
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY NOT NULL,
      institution_name TEXT NOT NULL,
      device_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      rtc_iso TEXT,
      time_source TEXT NOT NULL DEFAULT 'unknown',
      current_temp_c REAL NOT NULL,
      battery_voltage_v REAL NOT NULL DEFAULT 0,
      shunt_voltage_mv REAL NOT NULL DEFAULT 0,
      current_ma REAL NOT NULL DEFAULT 0,
      power_mw REAL NOT NULL DEFAULT 0,
      battery_percent_estimate INTEGER NOT NULL DEFAULT 0,
      mkt_status TEXT NOT NULL,
      sd_card_mounted INTEGER NOT NULL DEFAULT 0
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
  deviceRuntimeConfig: `
    CREATE TABLE IF NOT EXISTS device_runtime_config (
      device_id TEXT PRIMARY KEY NOT NULL,
      active_transport TEXT,
      control_role TEXT NOT NULL DEFAULT 'none',
      session_status TEXT NOT NULL DEFAULT 'idle',
      monitoring_mode TEXT NOT NULL DEFAULT 'off',
      active_runtime_base_url TEXT,
      facility_wifi_ssid TEXT,
      facility_wifi_password TEXT,
      facility_wifi_runtime_base_url TEXT,
      softap_ssid TEXT,
      softap_password TEXT,
      softap_runtime_base_url TEXT,
      primary_controller_user_id TEXT,
      primary_lease_expires_at INTEGER,
      primary_lease_session_id TEXT,
      last_ping_at INTEGER,
      last_recover_at INTEGER,
      last_monitor_at INTEGER,
      last_runtime_error TEXT,
      last_monitor_error TEXT,
      telemetry_history_cursor INTEGER,
      telemetry_upload_cursor INTEGER,
      updated_at INTEGER NOT NULL
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
    last_connection_sync_status:
      "ALTER TABLE devices ADD COLUMN last_connection_sync_status TEXT NOT NULL DEFAULT 'idle'",
    last_connection_sync_updated_at: "ALTER TABLE devices ADD COLUMN last_connection_sync_updated_at INTEGER",
    last_connection_sync_failure_stage:
      "ALTER TABLE devices ADD COLUMN last_connection_sync_failure_stage TEXT",
    last_connection_sync_error: "ALTER TABLE devices ADD COLUMN last_connection_sync_error TEXT",
    battery_voltage_v: "ALTER TABLE devices ADD COLUMN battery_voltage_v REAL NOT NULL DEFAULT 0",
    current_ma: "ALTER TABLE devices ADD COLUMN current_ma REAL NOT NULL DEFAULT 0",
    power_mw: "ALTER TABLE devices ADD COLUMN power_mw REAL NOT NULL DEFAULT 0",
    battery_percent_estimate:
      "ALTER TABLE devices ADD COLUMN battery_percent_estimate INTEGER NOT NULL DEFAULT 0",
    latest_sequence: "ALTER TABLE devices ADD COLUMN latest_sequence INTEGER NOT NULL DEFAULT 0",
    recorded_at: "ALTER TABLE devices ADD COLUMN recorded_at INTEGER NOT NULL DEFAULT 0",
    rtc_iso: "ALTER TABLE devices ADD COLUMN rtc_iso TEXT",
    time_source: "ALTER TABLE devices ADD COLUMN time_source TEXT NOT NULL DEFAULT 'unknown'",
    sd_card_mounted: "ALTER TABLE devices ADD COLUMN sd_card_mounted INTEGER NOT NULL DEFAULT 0",
    shunt_voltage_mv: "ALTER TABLE devices ADD COLUMN shunt_voltage_mv REAL NOT NULL DEFAULT 0",
  },
  readings: {
    sequence: "ALTER TABLE readings ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0",
    rtc_iso: "ALTER TABLE readings ADD COLUMN rtc_iso TEXT",
    time_source: "ALTER TABLE readings ADD COLUMN time_source TEXT NOT NULL DEFAULT 'unknown'",
    current_temp_c: "ALTER TABLE readings ADD COLUMN current_temp_c REAL NOT NULL DEFAULT 0",
    battery_voltage_v: "ALTER TABLE readings ADD COLUMN battery_voltage_v REAL NOT NULL DEFAULT 0",
    shunt_voltage_mv: "ALTER TABLE readings ADD COLUMN shunt_voltage_mv REAL NOT NULL DEFAULT 0",
    current_ma: "ALTER TABLE readings ADD COLUMN current_ma REAL NOT NULL DEFAULT 0",
    power_mw: "ALTER TABLE readings ADD COLUMN power_mw REAL NOT NULL DEFAULT 0",
    battery_percent_estimate:
      "ALTER TABLE readings ADD COLUMN battery_percent_estimate INTEGER NOT NULL DEFAULT 0",
    mkt_status: "ALTER TABLE readings ADD COLUMN mkt_status TEXT NOT NULL DEFAULT 'safe'",
    sd_card_mounted: "ALTER TABLE readings ADD COLUMN sd_card_mounted INTEGER NOT NULL DEFAULT 0",
  },
  connection_grants: {
    expires_at: "ALTER TABLE connection_grants ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0",
    updated_at: "ALTER TABLE connection_grants ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
    payload_json: "ALTER TABLE connection_grants ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}'",
    scope_id: "ALTER TABLE connection_grants ADD COLUMN scope_id TEXT NOT NULL DEFAULT ''",
    scope_type: "ALTER TABLE connection_grants ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'device'",
  },
  device_runtime_config: {
    control_role: "ALTER TABLE device_runtime_config ADD COLUMN control_role TEXT NOT NULL DEFAULT 'none'",
    primary_controller_user_id:
      "ALTER TABLE device_runtime_config ADD COLUMN primary_controller_user_id TEXT",
    primary_lease_expires_at:
      "ALTER TABLE device_runtime_config ADD COLUMN primary_lease_expires_at INTEGER",
    primary_lease_session_id:
      "ALTER TABLE device_runtime_config ADD COLUMN primary_lease_session_id TEXT",
    telemetry_history_cursor:
      "ALTER TABLE device_runtime_config ADD COLUMN telemetry_history_cursor INTEGER",
    telemetry_upload_cursor:
      "ALTER TABLE device_runtime_config ADD COLUMN telemetry_upload_cursor INTEGER",
  },
} as const;

export const SQLITE_SCHEMA_STATEMENTS = [
  SQLITE_TABLE_DEFINITIONS.profileCache,
  SQLITE_TABLE_DEFINITIONS.devices,
  SQLITE_TABLE_DEFINITIONS.readings,
  SQLITE_TABLE_DEFINITIONS.syncJobs,
  SQLITE_TABLE_DEFINITIONS.connectionGrants,
  SQLITE_TABLE_DEFINITIONS.deviceActionTickets,
  SQLITE_TABLE_DEFINITIONS.deviceRuntimeConfig,
  SQLITE_TABLE_DEFINITIONS.notificationCache,
  SQLITE_TABLE_DEFINITIONS.notificationStateCache,
  SQLITE_TABLE_DEFINITIONS.notificationPreferencesCache,
  SQLITE_TABLE_DEFINITIONS.notificationPreferenceTypeCache,
];
