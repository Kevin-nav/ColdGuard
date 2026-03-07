import { useNotificationContext } from "../providers/notification-provider";

export function useNotificationPreferences() {
  const {
    permissionStatus,
    preferences,
    requestPermissions,
    updatePreferences,
  } = useNotificationContext();

  return {
    isSaving: false,
    permissionStatus,
    preferences,
    requestPermissions,
    savePreferences: updatePreferences,
  };
}
