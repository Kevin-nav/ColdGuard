import { renderHook, waitFor } from "@testing-library/react-native";
import { shouldAttemptRetry, useNetworkStatus } from "./network-status";

const mockGetNetworkStateAsync = jest.fn();
const mockAddNetworkStateListener = jest.fn();

jest.mock("expo-network", () => ({
  addNetworkStateListener: (...args: unknown[]) => mockAddNetworkStateListener(...args),
  getNetworkStateAsync: (...args: unknown[]) => mockGetNetworkStateAsync(...args),
}));

test("retry disabled when offline", () => {
  expect(shouldAttemptRetry(false, 1)).toBe(false);
});

test("subscribes to network changes instead of polling", async () => {
  const remove = jest.fn();
  mockGetNetworkStateAsync.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
  mockAddNetworkStateListener.mockImplementation((listener: (state: { isConnected: boolean; isInternetReachable: boolean | null }) => void) => {
    listener({
      isConnected: false,
      isInternetReachable: false,
    });
    return { remove };
  });

  const { result, unmount } = renderHook(() => useNetworkStatus());

  await waitFor(() => expect(result.current.isOnline).toBe(false));
  expect(mockAddNetworkStateListener).toHaveBeenCalledTimes(1);

  unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
