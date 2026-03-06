import * as Network from "expo-network";
import { useEffect, useState } from "react";

export function shouldAttemptRetry(isOnline: boolean, attempts: number) {
  if (!isOnline) return false;
  return attempts < 5;
}

export function getRetryDelayMs(attempt: number) {
  const base = 600;
  const cappedAttempt = Math.min(attempt, 6);
  return base * Math.pow(2, cappedAttempt);
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!mounted) return;
        setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      } catch {
        if (!mounted) return;
        setIsOnline(false);
      }
    }

    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 7000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return { isOnline };
}
