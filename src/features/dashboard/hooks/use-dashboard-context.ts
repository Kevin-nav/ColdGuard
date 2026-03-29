import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthSession } from "../../auth/providers/auth-provider";
import { type DeviceRecord } from "../../../lib/storage/sqlite/device-repository";
import { type ProfileSnapshot } from "../../../lib/storage/sqlite/profile-repository";
import { useDashboardBootstrap } from "../providers/dashboard-bootstrap";
import { ensureLocalProfileForUser } from "../services/profile-hydration";
import { syncVisibleDevices } from "../../devices/services/device-directory";

type DashboardContextState = {
  alertCount: number;
  devices: DeviceRecord[];
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  profile: ProfileSnapshot | null;
  refreshDevices: () => Promise<void>;
  safeCount: number;
  warningCount: number;
};

export function useDashboardContext(): DashboardContextState {
  const { error: bootstrapError, isReady } = useDashboardBootstrap();
  const { user } = useAuthSession();
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardContext = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (bootstrapError) {
        setScreenError(bootstrapError);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (!isReady) return;

      if (!user?.uid) {
        setProfile(null);
        setDevices([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (mode === "refresh") {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setScreenError(null);

      try {
        const nextProfile = await ensureLocalProfileForUser({
          firebaseUid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });

        setProfile(nextProfile);

        if (!nextProfile?.institutionName) {
          setDevices([]);
          return;
        }

        const nextDevices = await syncVisibleDevices(nextProfile);
        setDevices(nextDevices);
      } catch (error) {
        setScreenError(error instanceof Error ? error.message : "Dashboard data could not be loaded.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [bootstrapError, isReady, user?.displayName, user?.email, user?.uid],
  );

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      await loadDashboardContext("initial");
      if (!isMounted) {
        return;
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadDashboardContext]);

  const counts = useMemo(
    () => ({
      alertCount: devices.filter((device) => device.mktStatus === "alert").length,
      safeCount: devices.filter((device) => device.mktStatus === "safe").length,
      warningCount: devices.filter((device) => device.mktStatus === "warning").length,
    }),
    [devices],
  );

  return {
    alertCount: counts.alertCount,
    devices,
    error: screenError,
    isLoading,
    isRefreshing,
    profile,
    refreshDevices: async () => await loadDashboardContext("refresh"),
    safeCount: counts.safeCount,
    warningCount: counts.warningCount,
  };
}
