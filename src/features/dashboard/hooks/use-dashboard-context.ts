import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "../../auth/providers/auth-provider";
import { getDevicesForInstitution, type DeviceRecord } from "../../../lib/storage/sqlite/device-repository";
import { getProfileSnapshot, type ProfileSnapshot } from "../../../lib/storage/sqlite/profile-repository";
import { useDashboardBootstrap } from "../providers/dashboard-bootstrap";
import { seedDashboardDataForInstitution } from "../services/dashboard-seed";
import { ensureLocalProfileForUser } from "../services/profile-hydration";

type DashboardContextState = {
  alertCount: number;
  devices: DeviceRecord[];
  error: string | null;
  isLoading: boolean;
  profile: ProfileSnapshot | null;
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
        const nextProfile =
          (await getProfileSnapshot()) ??
          (await ensureLocalProfileForUser({
            firebaseUid: user.uid,
            email: user.email,
            displayName: user.displayName,
          }));

        if (!isMounted) return;
        setProfile(nextProfile);

        if (!nextProfile?.institutionName) {
          setDevices([]);
          setIsLoading(false);
          return;
        }

        let nextDevices = await getDevicesForInstitution(nextProfile.institutionName);
        if (nextDevices.length === 0) {
          nextDevices = await seedDashboardDataForInstitution(nextProfile.institutionName);
        }

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
  }, [bootstrapError, isReady, user?.displayName, user?.email, user?.uid]);

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
    safeCount: counts.safeCount,
    warningCount: counts.warningCount,
  };
}
