import { useMemo } from "react";
import { getNotificationSortTime } from "../types";
import { useNotificationContext } from "../providers/notification-provider";

export function useNotificationInbox() {
  const state = useNotificationContext();

  return useMemo(
    () => ({
      ...state,
      activeIncidents: [...state.activeIncidents].sort(
        (a, b) => getNotificationSortTime(b) - getNotificationSortTime(a),
      ),
      resolvedIncidents: [...state.resolvedIncidents].sort(
        (a, b) => getNotificationSortTime(b) - getNotificationSortTime(a),
      ),
    }),
    [state],
  );
}
