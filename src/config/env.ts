const requiredKeys = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_CONVEX_URL",
] as const;

export type AppEnv = Record<(typeof requiredKeys)[number], string>;

export function getEnv(source: Record<string, string | undefined> = process.env) {
  for (const key of requiredKeys) {
    if (!source[key] || source[key]?.trim() === "") {
      throw new Error(`Missing required env key: ${key}`);
    }
  }

  return source as AppEnv;
}
