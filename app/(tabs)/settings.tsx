import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { useNotificationPreferences } from "../../src/features/notifications/hooks/use-notification-preferences";
import { getFirebaseAuth } from "../../src/lib/firebase/client";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing } from "../../src/theme/tokens";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);
  const { error, isLoading, profile } = useDashboardContext();
  const { permissionStatus, preferences, requestPermissions, savePreferences } =
    useNotificationPreferences();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

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

  async function handleTogglePreference(
    key: "recoveryPushEnabled" | "warningLocalEnabled" | "warningPushEnabled",
  ) {
    if (!preferences || isSavingPrefs) return;

    setIsSavingPrefs(true);
    try {
      await savePreferences({
        warningPushEnabled:
          key === "warningPushEnabled" ? !preferences.warningPushEnabled : preferences.warningPushEnabled,
        warningLocalEnabled:
          key === "warningLocalEnabled" ? !preferences.warningLocalEnabled : preferences.warningLocalEnabled,
        recoveryPushEnabled:
          key === "recoveryPushEnabled" ? !preferences.recoveryPushEnabled : preferences.recoveryPushEnabled,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
      });
    } finally {
      setIsSavingPrefs(false);
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
        description="Control how warnings and recoveries reach this device."
        eyebrow="Notifications"
        title="Alert delivery"
      >
        <PanelCard>
          <Text style={styles.bodyText}>
            Push permission: {formatPermissionStatus(permissionStatus)}
          </Text>
          <Text style={styles.bodyText}>
            Critical safety alerts remain mandatory once system delivery is enabled.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermissions()}
            style={({ pressed }) => [
              styles.secondaryButton,
              localStyles.prefButton,
              pressed ? { backgroundColor: colors.surfaceMuted } : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Register this device for push</Text>
          </Pressable>

          <PreferenceRow
            isEnabled={preferences?.warningPushEnabled ?? false}
            isSaving={isSavingPrefs}
            label="Warning push alerts"
            onPress={() => void handleTogglePreference("warningPushEnabled")}
          />
          <PreferenceRow
            isEnabled={preferences?.warningLocalEnabled ?? false}
            isSaving={isSavingPrefs}
            label="Local warning alerts"
            onPress={() => void handleTogglePreference("warningLocalEnabled")}
          />
          <PreferenceRow
            isEnabled={preferences?.recoveryPushEnabled ?? false}
            isSaving={isSavingPrefs}
            label="Recovery push alerts"
            onPress={() => void handleTogglePreference("recoveryPushEnabled")}
          />
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Sign out of the current account securely."
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
    prefButton: {
      marginTop: spacing.md,
    },
    prefRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.md,
    },
  });
}

function PreferenceRow(props: {
  isEnabled: boolean;
  isSaving: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        localStyles.prefRow,
        pressed ? { opacity: 0.75 } : null,
      ]}
    >
      <Text style={styles.bodyText}>{props.label}</Text>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        {props.isSaving ? <ActivityIndicator color={colors.primary} size="small" /> : null}
        <Ionicons
          color={props.isEnabled ? colors.success : colors.textSecondary}
          name={props.isEnabled ? "checkmark-circle" : "ellipse-outline"}
          size={20}
        />
      </View>
    </Pressable>
  );
}

function formatPermissionStatus(status: string) {
  switch (status) {
    case "granted":
      return "Granted";
    case "denied":
      return "Denied";
    default:
      return "Not requested";
  }
}
