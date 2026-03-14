import { internalMutation } from "./_generated/server";
import { normalizeUserRole } from "./roles";

export const normalizeStoredRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    let institutionCredentialUpdates = 0;
    let userUpdates = 0;

    const institutionCredentials = await ctx.db.query("institutionCredentials").collect();
    for (const credential of institutionCredentials) {
      const normalizedRole = normalizeUserRole(credential.role);
      if (credential.role !== normalizedRole) {
        await ctx.db.patch(credential._id, {
          role: normalizedRole,
        });
        institutionCredentialUpdates += 1;
      }
    }

    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      const normalizedRole = normalizeUserRole(user.role);
      if (user.role !== normalizedRole) {
        await ctx.db.patch(user._id, {
          role: normalizedRole,
        });
        userUpdates += 1;
      }
    }

    return {
      institutionCredentialUpdates,
      userUpdates,
    };
  },
});
