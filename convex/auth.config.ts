import type { AuthConfig } from "convex/server";

const projectId = "coldguard-c132f";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: `https://securetoken.google.com/${projectId}`,
      jwks: "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      algorithm: "RS256",
      applicationID: projectId,
    },
  ],
} satisfies AuthConfig;
