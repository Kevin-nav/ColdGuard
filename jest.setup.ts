// Jest global setup for React Native tests.

jest.mock("expo-notifications", () => {
  const mockModule = {
    IosAuthorizationStatus: {
      AUTHORIZED: 2,
    },
    getPermissionsAsync: jest.fn(async () => ({
      canAskAgain: true,
      granted: false,
      ios: { status: 0 },
    })),
    getExpoPushTokenAsync: jest.fn(async () => ({
      data: "ExponentPushToken[test-token]",
    })),
    requestPermissionsAsync: jest.fn(async () => ({
      canAskAgain: true,
      granted: true,
      ios: { status: 2 },
    })),
    scheduleNotificationAsync: jest.fn(async () => "notification-id"),
    setNotificationHandler: jest.fn(),
  };

  return mockModule;
});
