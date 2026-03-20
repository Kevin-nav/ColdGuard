import { createContext, useContext, useEffect, useState } from "react";
import { listMonitoredDeviceRuntimeConfigsForJsPolling } from "../../../lib/storage/sqlite/device-runtime-repository";
import { useAuthSession } from "../../auth/providers/auth-provider";
import { useDashboardBootstrap } from "../../dashboard/providers/dashboard-bootstrap";
import { ensureLocalProfileForUser } from "../../dashboard/services/profile-hydration";
import { pollMonitoredDeviceRuntime } from "../../devices/services/connection-service";
import { getNativeMonitoringServiceStatuses } from "../../devices/services/wifi-bridge";
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

type NotificationInstitutionContext = {
  institutionId: string;
  institutionName: string;
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthSession();
  const { isReady } = useDashboardBootstrap();
  const { isOnline } = useNetworkStatus();
  const [incidents, setIncidents] = useState<NotificationIncidentRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>("undetermined");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [institution, setInstitution] = useState<NotificationInstitutionContext | null>(null);

  useEffect(() => {
    configureLocalNotificationHandler();
    void getLocalNotificationPermissionStatus()
      .then(setPermissionStatus)
      .catch(() => setPermissionStatus("undetermined"));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      if (!isReady) {
        return;
      }

      if (!user?.uid) {
        if (!active) {
          return;
        }

        setIncidents([]);
        setPreferences(null);
        setInstitution(null);
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

        if (!active) {
          return;
        }

        if (!profile?.institutionName) {
          setInstitution(null);
          setIncidents([]);
          setPreferences(null);
          setError(null);
          setIsLoading(false);
          return;
        }

        const institutionContext = {
          institutionId: profile.institutionId,
          institutionName: profile.institutionName,
        };
        setInstitution(institutionContext);

        const [nextInbox, nextPreferences] = await Promise.all([
          syncNotificationInbox(institutionContext, { isOnline }),
          syncNotificationPreferences({ isOnline }),
        ]);

        if (!active) {
          return;
        }

        setIncidents(nextInbox.incidents);
        setPreferences(nextPreferences);
        setError(nextInbox.syncError);
        await mirrorNotificationsLocally(nextInbox.incidents, nextPreferences);
      } catch (nextError) {
        if (!active) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : "Notification inbox unavailable.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, [isOnline, isReady, user?.displayName, user?.email, user?.uid]);

  useEffect(() => {
    if (!institution || !isOnline) {
      return;
    }

    void flushPendingNotificationSyncJobs({ institution, isOnline });
  }, [institution, isOnline]);

  useEffect(() => {
    if (!institution || !isReady || !user?.uid) {
      return;
    }

    let active = true;

    async function pollMonitoredDevices() {
      try {
        const nativeStatuses = await getNativeMonitoringServiceStatuses().catch(() => ({}));
        const nativelyMonitoredDeviceIds = Object.values(nativeStatuses)
          .filter((status) => status.isRunning)
          .map((status) => status.deviceId);
        const monitored = await listMonitoredDeviceRuntimeConfigsForJsPolling(nativelyMonitoredDeviceIds);

        for (const runtime of monitored) {
          await pollMonitoredDeviceRuntime({ deviceId: runtime.deviceId }).catch(() => undefined);
        }

        const [nextInbox, nextPreferences] = await Promise.all([
          syncNotificationInbox(institution, { isOnline }),
          syncNotificationPreferences({ isOnline }),
        ]);

        if (!active) {
          return;
        }

        setIncidents(nextInbox.incidents);
        setPreferences(nextPreferences);
        setError(nextInbox.syncError);
        await mirrorNotificationsLocally(nextInbox.incidents, nextPreferences);
      } catch {
        // Monitoring is best-effort in the JS runtime.
      }
    }

    void pollMonitoredDevices();
    const interval = setInterval(() => {
      void pollMonitoredDevices();
    }, 60_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [institution, isOnline, isReady, user?.uid]);

  async function refresh() {
    if (!institution) {
      return;
    }

    try {
      const [nextInbox, nextPreferences] = await Promise.all([
        syncNotificationInbox(institution, { isOnline }),
        syncNotificationPreferences({ isOnline }),
      ]);
      setIncidents(nextInbox.incidents);
      setPreferences(nextPreferences);
      setError(nextInbox.syncError);
      await mirrorNotificationsLocally(nextInbox.incidents, nextPreferences);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to refresh notifications.");
    }
  }

  async function markRead(incidentId: string) {
    if (!institution) {
      return;
    }

    try {
      await markNotificationReadWithSync(incidentId, { isOnline });
      const nextInbox = await syncNotificationInbox(institution, { isOnline });
      setIncidents(nextInbox.incidents);
      setError(nextInbox.syncError);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to mark the incident as read.");
    }
  }

  async function archiveIncident(incidentId: string) {
    if (!institution) {
      return;
    }

    try {
      await archiveNotificationWithSync(incidentId, { isOnline });
      const nextInbox = await syncNotificationInbox(institution, { isOnline });
      setIncidents(nextInbox.incidents);
      setError(nextInbox.syncError);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to archive the incident.");
    }
  }

  async function acknowledgeIncident(incidentId: string) {
    if (!institution) {
      return;
    }

    try {
      const nextInbox = await acknowledgeIncidentWithSync(incidentId, institution, { isOnline });
      setIncidents(nextInbox.incidents);
      setError(nextInbox.syncError);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to acknowledge the incident.");
    }
  }

  async function resolveIncident(incidentId: string) {
    if (!institution) {
      return;
    }

    try {
      const nextInbox = await resolveIncidentWithSync(incidentId, institution, { isOnline });
      setIncidents(nextInbox.incidents);
      setError(nextInbox.syncError);
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
    const localIncident = incidents.find((incident) => incident.id === incidentId) ?? null;

    try {
      if (!institution) {
        return localIncident;
      }

      return await getIncidentDetail(incidentId, institution, { isOnline });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load incident details.");
      return localIncident;
    }
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
