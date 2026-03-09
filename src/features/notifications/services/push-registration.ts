import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "../../../lib/convex/client";
import { enqueueSyncJob } from "../../../lib/storage/sqlite/sync-job-repository";
import { type NotificationPermissionStatus } from "../types";

type PushRegistrationResult = {
  permissionStatus: NotificationPermissionStatus;
  token: string | null;
};

type ExpoConfigWithAndroidPush = NonNullable<typeof Constants.expoConfig> & {
  android?: {
    googleServicesFile?: string;
  };
};

function isPushTokenConflictError(error: unknown) {
  return error instanceof Error && error.message.includes("PUSH_TOKEN_CONFLICT");
}

function normalizePermissionStatus(status: Notifications.PermissionStatus): NotificationPermissionStatus {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function getNotificationPermissionSnapshot(): Promise<NotificationPermissionStatus> {
  const permission = await Notifications.getPermissionsAsync();
  return normalizePermissionStatus(permission.status);
}

function hasAndroidPushConfig() {
  if (!Constants.platform?.android) return true;

  const expoConfig = Constants.expoConfig as ExpoConfigWithAndroidPush | null;
  return Boolean(expoConfig?.android?.googleServicesFile);
}

export async function registerForPushNotificationsAsync() {
  let permission = await Notifications.getPermissionsAsync();

  if (permission.status !== "granted") {
    permission = await Notifications.requestPermissionsAsync();
  }

  const permissionStatus = normalizePermissionStatus(permission.status);
  if (permissionStatus !== "granted") {
    return {
      permissionStatus,
      token: null,
    } satisfies PushRegistrationResult;
  }

  if (!hasAndroidPushConfig()) {
    console.warn("Skipping Expo push token registration on Android because google-services.json is not configured.");
    return {
      permissionStatus,
      token: null,
    } satisfies PushRegistrationResult;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return {
      permissionStatus,
      token,
    } satisfies PushRegistrationResult;
  } catch (error) {
    console.warn("Failed to get Expo push token.", error);
    return {
      permissionStatus,
      token: null,
    } satisfies PushRegistrationResult;
  }
}

export async function syncPushRegistration() {
  const result = await registerForPushNotificationsAsync();
  const payload = {
    expoPushToken: result.token,
    platform: Constants.platform?.ios ? "ios" : Constants.platform?.android ? "android" : "unknown",
    appVersion: Constants.expoConfig?.version ?? "dev",
    permissionStatus: result.permissionStatus,
  };

  if (!result.token) {
    return result;
  }

  try {
    const convex = getConvexClient();
    await convex.mutation((api as any).notifications.registerPushDevice, payload);
  } catch (error) {
    if (isPushTokenConflictError(error)) {
      console.error("Push token registration was rejected due to an ownership conflict.", error);
      return result;
    }
    await enqueueSyncJob("register_push_device", payload);
  }

  return result;
}

export const __testing = {
  hasAndroidPushConfig,
};
