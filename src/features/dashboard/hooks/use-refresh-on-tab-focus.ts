import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

export function useRefreshOnTabFocus(refresh: () => Promise<void>) {
  const hasHandledInitialFocus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Initial dashboard hydration already runs on mount; only later focuses should refresh.
      if (!hasHandledInitialFocus.current) {
        hasHandledInitialFocus.current = true;
        return;
      }

      void refresh();
    }, [refresh]),
  );
}
