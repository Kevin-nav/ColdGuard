import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { useNotificationPreferences } from "../../src/features/notifications/hooks/use-notification-preferences";
import { type NotificationIncidentType, type NotificationPreferences } from "../../src/features/notifications/types";
import { getFirebaseAuth } from "../../src/lib/firebase/client";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing } from "../../src/theme/tokens";

const ROUTINE_ALERT_OPTIONS: Array<{
  description: string;
  title: string;
  type: NotificationIncidentType;
}> = [
  {
    type: "temperature",
    title: "Temperature",
    description: "Warnings when a unit is drifting outside the safe range.",
  },
  {
    type: "door_open",
    title: "Door open",
    description: "Alerts when a unit door has been left open longer than expected.",
  },
  {
    type: "device_offline",
    title: "Device offline",
    description: "Alerts when a device has not checked in recently.",
  },
  {
    type: "battery_low",
    title: "Low battery",
    description: "Warnings when a device may need charging or power.",
  },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);
  const { error, isLoading, profile } = useDashboardContext();
  const { permissionStatus, preferences, requestPermissions, savePreferences } =
    useNotificationPreferences();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activePreference, setActivePreference] = useState<NotificationIncidentType | null>(null);

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

  async function handleToggleRoutineAlert(type: NotificationIncidentType, nextValue: boolean) {
    if (!preferences || activePreference) return;

    setActivePreference(type);
    try {
      await savePreferences({
        warningPushEnabled: preferences.warningPushEnabled,
        warningLocalEnabled: preferences.warningLocalEnabled,
        recoveryPushEnabled: preferences.recoveryPushEnabled,
        nonCriticalByType: {
          ...preferences.nonCriticalByType,
          [type]: nextValue,
        },
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
      });
    } finally {
      setActivePreference(null);
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
    <DashboardPage contentContainerStyle={localStyles.pageContent} scroll testID="settings-scroll-view">
      <DashboardSection
        description="Choose which routine alerts this device should interrupt you about."
        eyebrow="Preferences"
        title="Alert settings"
      >
        <PanelCard>
          <View style={localStyles.heroRow}>
            <View style={localStyles.heroCopy}>
              <Text style={styles.valueText}>Critical alerts are always on.</Text>
              <Text style={styles.bodyText}>
                Routine alerts can be adjusted below, but serious cold-chain risks will still come through.
              </Text>
            </View>
            <View style={[localStyles.heroBadge, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons color={colors.primary} name="shield-checkmark-outline" size={20} />
            </View>
          </View>
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Check whether this phone can show alerts and refresh its registration."
        eyebrow="Status"
        title="Notification status"
      >
        <PanelCard>
          <SettingSummaryRow label="Phone notifications" value={formatPermissionStatus(permissionStatus)} />
          <View style={localStyles.divider} />
          <SettingSummaryRow label="Signed in" value={profile.displayName} />
          <Text style={styles.bodyText}>
            If phone notifications are off, ColdGuard will still keep incidents in Notifications for review.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermissions()}
            style={({ pressed }) => [
              styles.secondaryButton,
              localStyles.actionButton,
              pressed ? { backgroundColor: colors.surfaceMuted } : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Enable phone notifications</Text>
          </Pressable>
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Turning one off stops the interruption, but the incident will still appear in Notifications."
        eyebrow="Routine alerts"
        title="What should interrupt you"
      >
        <PanelCard>
          {ROUTINE_ALERT_OPTIONS.map((option, index) => (
            <View key={option.type}>
              {index > 0 ? <View style={localStyles.divider} /> : null}
              <RoutineAlertRow
                description={option.description}
                isEnabled={preferences?.nonCriticalByType[option.type] ?? true}
                isSaving={activePreference === option.type}
                onValueChange={(nextValue) => void handleToggleRoutineAlert(option.type, nextValue)}
                title={option.title}
              />
            </View>
          ))}
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Quiet hours only affect routine alerts. Critical alerts still come through."
        eyebrow="Quiet hours"
        title="Routine quiet hours"
      >
        <PanelCard>
          <SettingSummaryRow
            label="Current setting"
            value={formatQuietHours(preferences)}
          />
          <Text style={styles.bodyText}>
            Quiet hours are kept on your account and apply only to routine alerts sent to you.
          </Text>
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Manage the current session on this device."
        eyebrow="Account"
        title="Session"
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
    pageContent: {
      paddingTop: spacing["3xl"],
    },
    heroRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.lg,
    },
    heroCopy: {
      flex: 1,
      gap: spacing.sm,
    },
    heroBadge: {
      alignItems: "center",
      borderRadius: 18,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    actionButton: {
      marginTop: spacing.md,
    },
    summaryRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    summaryCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    valueChip: {
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    divider: {
      backgroundColor: "rgba(150, 150, 150, 0.12)",
      height: 1,
      marginVertical: spacing.md,
    },
    routineRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    routineCopy: {
      flex: 1,
      gap: spacing.sm,
    },
    routineMetaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    metaChip: {
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    switchWrap: {
      alignItems: "center",
      minWidth: 56,
    },
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

function SettingSummaryRow(props: {
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);

  return (
    <View style={localStyles.summaryRow}>
      <View style={localStyles.summaryCopy}>
        <Text style={styles.valueText}>{props.label}</Text>
      </View>
      <View style={[localStyles.valueChip, { backgroundColor: colors.primaryMuted }]}>
        <Text style={[styles.labelText, { color: colors.primary, opacity: 1 }]}>{props.value}</Text>
      </View>
    </View>
  );
}

function RoutineAlertRow(props: {
  description: string;
  isEnabled: boolean;
  isSaving: boolean;
  onValueChange: (nextValue: boolean) => void;
  title: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);

  return (
    <View style={localStyles.routineRow}>
      <View style={localStyles.routineCopy}>
        <Text style={styles.valueText}>{props.title}</Text>
        <Text style={styles.bodyText}>{props.description}</Text>
        <View style={localStyles.routineMetaRow}>
          <View style={[localStyles.metaChip, { backgroundColor: colors.primaryMuted }]}>
            <Text style={[styles.labelText, { color: colors.primary, opacity: 1 }]}>
              Routine alerts {props.isEnabled ? "on" : "off"}
            </Text>
          </View>
        </View>
      </View>
      <View style={localStyles.switchWrap}>
        {props.isSaving ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Switch
            accessibilityLabel={`${props.title} routine alerts`}
            ios_backgroundColor={colors.border}
            onValueChange={props.onValueChange}
            thumbColor={props.isEnabled ? colors.textOnPrimary : colors.surface}
            trackColor={{ false: colors.border, true: colors.primary }}
            value={props.isEnabled}
          />
        )}
      </View>
    </View>
  );
}

function formatQuietHours(preferences: NotificationPreferences | null) {
  if (!preferences?.quietHoursStart || !preferences.quietHoursEnd) {
    return "Off";
  }

  return `${preferences.quietHoursStart} to ${preferences.quietHoursEnd}`;
}

function formatPermissionStatus(status: string) {
  switch (status) {
    case "granted":
      return "Allowed";
    case "denied":
      return "Blocked";
    default:
      return "Not set";
  }
}
