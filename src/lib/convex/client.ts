import { ConvexReactClient } from "convex/react";
import { getEnv } from "../../config/env";

let convexClient: ConvexReactClient | null = null;

export function getConvexClient() {
  if (convexClient) return convexClient;
  const env = getEnv();
  convexClient = new ConvexReactClient(env.EXPO_PUBLIC_CONVEX_URL);
  return convexClient;
}
