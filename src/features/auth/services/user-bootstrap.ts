import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "../../../lib/convex/client";

type UserBootstrapPayload = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

export function makeUserBootstrapPayload(firebaseUid: string, email?: string | null): UserBootstrapPayload {
  return {
    firebaseUid,
    email: email ?? null,
    displayName: null,
  };
}

export async function bootstrapUserInConvex(args: {
  firebaseUid: string;
  email?: string | null;
  displayName?: string | null;
}) {
  const convex = getConvexClient();
  return await convex.mutation((api as any).users.upsertByFirebaseUid, {
    firebaseUid: args.firebaseUid,
    email: args.email ?? undefined,
    displayName: args.displayName ?? undefined,
  });
}
