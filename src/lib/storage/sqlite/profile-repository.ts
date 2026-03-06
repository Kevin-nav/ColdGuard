import { getSQLiteDatabase, initializeSQLite } from "./client";

export type ProfileSnapshot = {
  firebaseUid: string;
  displayName: string;
  email: string;
  institutionName: string;
  staffId: string | null;
  role: string;
  lastUpdatedAt: number;
};

type ProfileRow = {
  firebase_uid: string;
  display_name: string;
  email: string;
  institution_name: string;
  staff_id: string | null;
  role: string;
  last_updated_at: number;
};

export async function saveProfileSnapshot(snapshot: Omit<ProfileSnapshot, "lastUpdatedAt">) {
  const database = await initializeSQLite();
  const role = snapshot.role.trim() || "Nurse";
  const now = Date.now();

  await database.runAsync(
    `
      INSERT OR REPLACE INTO profile_cache
      (id, firebase_uid, display_name, email, institution_name, staff_id, role, last_updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `,
    snapshot.firebaseUid,
    snapshot.displayName,
    snapshot.email,
    snapshot.institutionName,
    snapshot.staffId,
    role,
    now,
  );

  return {
    ...snapshot,
    role,
    lastUpdatedAt: now,
  };
}

export async function getProfileSnapshot(): Promise<ProfileSnapshot | null> {
  const database = await initializeSQLite();
  const row = await database.getFirstAsync<ProfileRow>(`
    SELECT firebase_uid, display_name, email, institution_name, staff_id, role, last_updated_at
    FROM profile_cache
    WHERE id = 1
  `);

  if (!row) return null;

  return {
    firebaseUid: row.firebase_uid,
    displayName: row.display_name,
    email: row.email,
    institutionName: row.institution_name,
    staffId: row.staff_id ?? null,
    role: row.role || "Nurse",
    lastUpdatedAt: row.last_updated_at,
  };
}

export async function clearProfileSnapshot() {
  const database = await getSQLiteDatabase();
  await database.runAsync("DELETE FROM profile_cache WHERE id = 1");
}
