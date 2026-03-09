const mockExpoConstants = {
  easConfig: null,
  expoConfig: {
    version: "1.0.0",
    android: {},
  },
  platform: {
    android: {},
  },
};

jest.mock("expo-constants", () => ({
  __esModule: true,
  get default() {
    return mockExpoConstants;
  },
}));

jest.mock("../../../lib/convex/client", () => ({
  getConvexClient: () => ({
    mutation: jest.fn(),
  }),
}));

jest.mock("../../../lib/storage/sqlite/sync-job-repository", () => ({
  enqueueSyncJob: jest.fn(),
}));

import * as Notifications from "expo-notifications";
import { registerForPushNotificationsAsync } from "./push-registration";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockExpoConstants.platform = { android: {} };
  mockExpoConstants.expoConfig = {
    version: "1.0.0",
    android: {},
  };
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
    canAskAgain: true,
    granted: true,
    ios: { status: Notifications.IosAuthorizationStatus.AUTHORIZED },
    status: "granted",
  } as any);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
    canAskAgain: true,
    granted: true,
    ios: { status: Notifications.IosAuthorizationStatus.AUTHORIZED },
    status: "granted",
  } as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("skips Android Expo push token fetch when google-services is not configured", async () => {
  const getExpoPushTokenAsync = jest.mocked(Notifications.getExpoPushTokenAsync);

  await expect(registerForPushNotificationsAsync()).resolves.toEqual({
    permissionStatus: "granted",
    token: null,
  });

  expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
});

test("fetches an Expo push token when Android push config is present", async () => {
  mockExpoConstants.expoConfig = {
    version: "1.0.0",
    android: {
      googleServicesFile: "./google-services.json",
    },
  };

  await expect(registerForPushNotificationsAsync()).resolves.toEqual({
    permissionStatus: "granted",
    token: "ExponentPushToken[test-token]",
  });

  expect(jest.mocked(Notifications.getExpoPushTokenAsync)).toHaveBeenCalledTimes(1);
});
