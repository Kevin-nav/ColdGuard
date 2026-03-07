import { createContext, useContext, useEffect, useState } from "react";
import { useAuthSession } from "../../auth/providers/auth-provider";
import { useDashboardBootstrap } from "../../dashboard/providers/dashboard-bootstrap";
import { ensureLocalProfileForUser } from "../../dashboard/services/profile-hydration";
import { useNetworkStatus } from "../../network/network-status";
import {
  type NotificationIncidentRecord,
  type NotificationPermissionStatus,
  type NotificationPreferences,
} from "../types";
import {
  acknowledgeIncidentWithSync,
  archiveNotificationWithSync,
  flushPendingNotificationSyncJobs,
  getIncidentDetail,
  markNotificationReadWithSync,
  resolveIncidentWithSync,
  syncNotificationInbox,
  syncNotificationPreferences,
  updateNotificationPreferencesWithSync,
} from "../services/inbox-sync";
import {
  configureLocalNotificationHandler,
  getLocalNotificationPermissionStatus,
  mirrorNotificationsLocally,
} from "../services/local-notifications";
import { syncPushRegistration } from "../services/push-registration";

type NotificationContextValue = {
  acknowledgeIncident: (incidentId: string) => Promise<void>;
  activeIncidents: NotificationIncidentRecord[];
  archiveIncident: (incidentId: string) => Promise<void>;
  error: string | null;
  getIncidentById: (incidentId: string) => Promise<NotificationIncidentRecord | null>;
  incidents: NotificationIncidentRecord[];
  isLoading: boolean;
  markRead: (incidentId: string) => Promise<void>;
  permissionStatus: NotificationPermissionStatus;
  preferences: NotificationPreferences | null;
  refresh: () => Promise<void>;
  requestPermissions: () => Promise<void>;
  resolvedIncidents: NotificationIncidentRecord[];
  resolveIncident: (incidentId: string) => Promise<void>;
  unreadCount: number;
  updatePreferences: (nextPreferences: Omit<NotificationPreferences, "lastUpdatedAt">) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue>({
  acknowledgeIncident: async () => undefined,
  activeIncidents: [],
  archiveIncident: async () => undefined,
  error: null,
  getIncidentById: async () => null,
  incidents: [],
  isLoading: false,
  markRead: async () => undefined,
  permissionStatus: "undetermined",
  preferences: null,
  refresh: async () => undefined,
  requestPermissions: async () => undefined,
  resolvedIncidents: [],
  resolveIncident: async () => undefined,
  unreadCount: 0,
  updatePreferences: async () => undefined,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthSession();
  const { isReady } = useDashboardBootstrap();
  const { isOnline } = useNetworkStatus();
  const [incidents, setIncidents] = useState<NotificationIncidentRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>("undetermined");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [institutionName, setInstitutionName] = useState<string | null>(null);

  useEffect(() => {
    configureLocalNotificationHandler();
    void getLocalNotificationPermissionStatus()
      .then(setPermissionStatus)
      .catch(() => setPermissionStatus("undetermined"));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      if (!isReady) return;

      if (!user?.uid) {
        if (!active) return;
        setIncidents([]);
        setPreferences(null);
        setInstitutionName(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const profile = await ensureLocalProfileForUser({
          firebaseUid: user.uid,
          displayName: user.displayName,
          email: user.email,
        });

        if (!active) return;

        if (!profile?.institutionName) {
          setInstitutionName(null);
          setIncidents([]);
          setPreferences(null);
          setIsLoading(false);
          return;
        }

        setInstitutionName(profile.institutionName);
        const [nextIncidents, nextPreferences] = await Promise.all([
          syncNotificationInbox(profile.institutionName, { isOnline }),
          syncNotificationPreferences({ isOnline }),
        ]);

        if (!active) return;

        setIncidents(nextIncidents);
        setPreferences(nextPreferences);
        await mirrorNotificationsLocally(nextIncidents, nextPreferences);
      } catch (nextError) {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Notification inbox unavailable.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, [isOnline, isReady, user?.displayName, user?.email, user?.uid]);

  useEffect(() => {
    if (!institutionName || !isOnline) return;
    void flushPendingNotificationSyncJobs({ institutionName, isOnline });
  }, [institutionName, isOnline]);

  async function refresh() {
    if (!institutionName) return;
    try {
      const [nextIncidents, nextPreferences] = await Promise.all([
        syncNotificationInbox(institutionName, { isOnline }),
        syncNotificationPreferences({ isOnline }),
      ]);
      setIncidents(nextIncidents);
      setPreferences(nextPreferences);
      await mirrorNotificationsLocally(nextIncidents, nextPreferences);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to refresh notifications.");
    }
  }

  async function markRead(incidentId: string) {
    if (!institutionName) return;
    try {
      await markNotificationReadWithSync(incidentId, { isOnline });
      setIncidents(await syncNotificationInbox(institutionName, { isOnline }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to mark the incident as read.");
    }
  }

  async function archiveIncident(incidentId: string) {
    if (!institutionName) return;
    try {
      await archiveNotificationWithSync(incidentId, { isOnline });
      setIncidents(await syncNotificationInbox(institutionName, { isOnline }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to archive the incident.");
    }
  }

  async function acknowledgeIncident(incidentId: string) {
    if (!institutionName) return;
    try {
      const nextIncidents = await acknowledgeIncidentWithSync(incidentId, institutionName, { isOnline });
      setIncidents(nextIncidents);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to acknowledge the incident.");
    }
  }

  async function resolveIncident(incidentId: string) {
    if (!institutionName) return;
    try {
      const nextIncidents = await resolveIncidentWithSync(incidentId, institutionName, { isOnline });
      setIncidents(nextIncidents);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to resolve the incident.");
    }
  }

  async function updatePreferences(nextPreferences: Omit<NotificationPreferences, "lastUpdatedAt">) {
    try {
      const saved = await updateNotificationPreferencesWithSync(nextPreferences, { isOnline });
      setPreferences(saved);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update notification preferences.");
    }
  }

  async function requestPermissions() {
    try {
      const result = await syncPushRegistration();
      setPermissionStatus(result.permissionStatus);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update notification permissions.");
    }
  }

  async function getIncidentById(incidentId: string) {
    if (!institutionName) {
      return incidents.find((incident) => incident.id === incidentId) ?? null;
    }

    return await getIncidentDetail(incidentId, institutionName, { isOnline });
  }

  const value = {
    acknowledgeIncident,
    activeIncidents: incidents.filter((incident) => incident.status !== "resolved" && !incident.archivedAt),
    archiveIncident,
    error,
    getIncidentById,
    incidents,
    isLoading,
    markRead,
    permissionStatus,
    preferences,
    refresh,
    requestPermissions,
    resolvedIncidents: incidents.filter((incident) => incident.status === "resolved" && !incident.archivedAt),
    resolveIncident,
    unreadCount: incidents.filter((incident) => !incident.readAt && !incident.archivedAt).length,
    updatePreferences,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationContext() {
  return useContext(NotificationContext);
}
