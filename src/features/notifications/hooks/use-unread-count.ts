import { useNotificationContext } from "../providers/notification-provider";

export function useUnreadCount() {
  return useNotificationContext().unreadCount;
}
