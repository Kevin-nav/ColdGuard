import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuthSession } from "../src/features/auth/providers/auth-provider";
import {
  buildEnrollmentRouteParams,
  loadPendingDeviceEnrollment,
} from "../src/features/devices/services/device-linking";
import { ensureLocalProfileForUser } from "../src/features/dashboard/services/profile-hydration";
import { getProfileSnapshot, type ProfileSnapshot } from "../src/lib/storage/sqlite/profile-repository";
import { useTheme } from "../src/theme/theme-provider";

type StartRoute =
  | "/(auth)/login"
  | "/(onboarding)/link-institution"
  | "/(tabs)/home"
  | {
      pathname: "/device/enroll";
      params: {
        claim: string;
        deviceId: string;
        payload: string;
        v: string;
      };
    };

export default function Index() {
  const { colors } = useTheme();
  const { isLoading, user } = useAuthSession();
  const [route, setRoute] = useState<StartRoute | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function resolveStartRoute() {
      if (isLoading) return;

      if (!user?.uid) {
        if (isMounted) setRoute("/(auth)/login");
        return;
      }

      let matchingCachedProfile: ProfileSnapshot | null = null;

      try {
        const cachedProfile = await getProfileSnapshot();
        matchingCachedProfile = cachedProfile?.firebaseUid === user.uid ? cachedProfile : null;
        const profile =
          matchingCachedProfile ??
          (await ensureLocalProfileForUser({
            firebaseUid: user.uid,
            email: user.email,
            displayName: user.displayName,
          }));

        if (!isMounted) return;
        if (!profile?.institutionName) {
          setRoute("/(onboarding)/link-institution");
          return;
        }

        const pendingEnrollment = await loadPendingDeviceEnrollment();
        setRoute(
          pendingEnrollment
            ? {
                pathname: "/device/enroll",
                params: buildEnrollmentRouteParams(pendingEnrollment),
              }
            : "/(tabs)/home",
        );
      } catch (error) {
        console.error("Failed to resolve start route.", error);
        if (!isMounted) return;
        setRoute(matchingCachedProfile?.institutionName ? "/(tabs)/home" : "/(onboarding)/link-institution");
        return;
      }
    }

    void resolveStartRoute();

    return () => {
      isMounted = false;
    };
  }, [isLoading, user]);

  if (!route) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.background,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={route} />;
}
