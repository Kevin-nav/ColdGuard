import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "../../../lib/convex/client";

type UserBootstrapPayload = {
  email: string | null;
  displayName: string | null;
};

export function makeUserBootstrapPayload(email?: string | null, displayName?: string | null): UserBootstrapPayload {
  return {
    email: email ?? null,
    displayName: displayName ?? null,
  };
}

export async function bootstrapUserInConvex(args: {
  email?: string | null;
  displayName?: string | null;
}) {
  const convex = getConvexClient();
  return await convex.mutation((api as any).users.upsertByFirebaseUid, {
    email: args.email ?? undefined,
    displayName: args.displayName ?? undefined,
  });
}
