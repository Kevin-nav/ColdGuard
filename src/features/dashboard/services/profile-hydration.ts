import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "../../../lib/convex/client";
import {
  clearProfileSnapshot,
  getProfileSnapshot,
  saveProfileSnapshot,
  type ProfileSnapshot,
} from "../../../lib/storage/sqlite/profile-repository";

export async function ensureLocalProfileForUser(args: {
  firebaseUid: string;
  email?: string | null;
  displayName?: string | null;
}): Promise<ProfileSnapshot | null> {
  const cached = await getProfileSnapshot();
  if (cached?.firebaseUid === args.firebaseUid && cached.institutionId.trim()) {
    return cached;
  }
  if (cached) {
    await clearProfileSnapshot();
  }

  const convex = getConvexClient();
  const linkedProfile = await convex.query((api as any).users.getLinkedProfileByFirebaseUid);

  if (!linkedProfile) {
    return null;
  }

  return await saveProfileSnapshot({
    firebaseUid: linkedProfile.firebaseUid,
    displayName: linkedProfile.displayName ?? args.displayName ?? "ColdGuard User",
    email: linkedProfile.email ?? args.email ?? "No email available",
    institutionId: linkedProfile.institutionId,
    institutionName: linkedProfile.institutionName,
    staffId: linkedProfile.staffId ?? null,
    role: linkedProfile.role ?? "Nurse",
  });
}
