import { useEffect, useMemo, useState } from "react";
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
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardContext() {
      if (bootstrapError) {
        if (isMounted) {
          setScreenError(bootstrapError);
          setIsLoading(false);
        }
        return;
      }

      if (!isReady) return;

      if (!user?.uid) {
        if (isMounted) {
          setProfile(null);
          setDevices([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setScreenError(null);

      try {
        const nextProfile = await ensureLocalProfileForUser({
          firebaseUid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });

        if (!isMounted) return;
        setProfile(nextProfile);

        if (!nextProfile?.institutionName) {
          setDevices([]);
          setIsLoading(false);
          return;
        }

        const nextDevices = await syncVisibleDevices(nextProfile);
        if (!isMounted) return;
        setDevices(nextDevices);
      } catch (error) {
        if (!isMounted) return;
        setScreenError(error instanceof Error ? error.message : "Dashboard data could not be loaded.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadDashboardContext();

    return () => {
      isMounted = false;
    };
  }, [bootstrapError, isReady, refreshNonce, user?.displayName, user?.email, user?.uid]);

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
    profile,
    refreshDevices: async () => {
      setRefreshNonce((current) => current + 1);
    },
    safeCount: counts.safeCount,
    warningCount: counts.warningCount,
  };
}
