import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { getFirebaseAuth } from "../../src/lib/firebase/client";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);
  const { error, isLoading, profile } = useDashboardContext();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      await signOut(getFirebaseAuth());
      router.replace("/(auth)/login");
    } finally {
      setIsSigningOut(false);
    }
  }

  if (error) {
    return (
      <DashboardPage>
        <PanelCard>
          <Text style={styles.heading}>Settings</Text>
          <Text style={styles.helperText}>{error}</Text>
        </PanelCard>
      </DashboardPage>
    );
  }

  if (isLoading || !profile) {
    return (
      <DashboardPage>
        <ActivityIndicator color={colors.primary} />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage scroll testID="settings-scroll-view">
      <DashboardSection
        description="Configure your app preferences and manage your session."
        eyebrow="Session"
        title="Settings"
      >
        <PanelCard>
          <Text style={styles.bodyText}>Signed in as {profile.displayName}</Text>
          <Text style={styles.bodyText}>
            Log out of your ColdGuard account securely.
          </Text>
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Minimal now, but intentionally separated from the dashboard."
        eyebrow="Account"
        title="Session controls"
      >
        <Pressable
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [
            styles.primaryButton,
            localStyles.signOutBtn,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: 1 },
            pressed ? { backgroundColor: colors.surface } : null,
            isSigningOut ? styles.buttonDisabled : null,
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <View style={localStyles.btnContent}>
              <Ionicons color={colors.danger} name="log-out-outline" size={20} />
              <Text style={[styles.primaryButtonText, { color: colors.danger, marginLeft: 8 }]}>Sign out</Text>
            </View>
          )}
        </Pressable>
      </DashboardSection>
    </DashboardPage>
  );
}

function createLocalStyles() {
  return StyleSheet.create({
    signOutBtn: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 0,
    },
    btnContent: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
    },
  });
}
