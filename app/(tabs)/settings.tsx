import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { useNotificationPreferences } from "../../src/features/notifications/hooks/use-notification-preferences";
import { type NotificationIncidentType, type NotificationPreferences } from "../../src/features/notifications/types";
import { SettingsGroup } from "../../src/features/settings/components/settings-group";
import { SettingsRow } from "../../src/features/settings/components/settings-row";
import { getFirebaseAuth } from "../../src/lib/firebase/client";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing, radii, borderWidths } from "../../src/theme/tokens";

const ROUTINE_ALERT_OPTIONS: {
  description: string;
  title: string;
  type: NotificationIncidentType;
}[] = [
  {
    type: "temperature",
    title: "Temperature",
    description: "Warnings when a unit drifts outside safe range.",
  },
  {
    type: "door_open",
    title: "Door open",
    description: "Alerts when a unit door is left open.",
  },
  {
    type: "device_offline",
    title: "Device offline",
    description: "Alerts when a device hasn't checked in.",
  },
  {
    type: "battery_low",
    title: "Low battery",
    description: "Warnings when a device needs power.",
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
        ...preferences,
        nonCriticalByType: {
          ...preferences.nonCriticalByType,
          [type]: nextValue,
        },
      });
    } finally {
      setActivePreference(null);
    }
  }

  if (error) {
    return (
      <DashboardPage>
        <SettingsGroup>
          <SettingsRow
            icon="warning"
            iconColor={colors.danger}
            iconBackgroundColor={colors.surfaceMuted}
            label="Error loading settings"
            description={error}
            showDivider={false}
          />
        </SettingsGroup>
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
      
      {/* Profile Section */}
      <SettingsGroup title="PROFILE">
        <View style={localStyles.identityHeader}>
          <View style={[localStyles.avatar, { borderColor: colors.primary }]}>
            <Text style={[localStyles.avatarText, { color: colors.primary }]}>
              {profile.displayName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("") || "CG"}
            </Text>
          </View>
          <View style={localStyles.identityCopy}>
            <Text style={styles.heading}>{profile.displayName}</Text>
            <View style={[localStyles.roleBadge, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[localStyles.roleBadgeText, { color: colors.primary }]}>{profile.role}</Text>
            </View>
          </View>
        </View>
        <View style={[localStyles.divider, { backgroundColor: colors.border }]} />
        <SettingsRow
          icon="mail"
          label="Email"
          description={profile.email}
          showDivider={true}
        />
        <SettingsRow
          icon="business"
          label="Institution"
          description={profile.institutionName}
          showDivider={!!profile.staffId}
        />
        {profile.staffId ? (
          <SettingsRow
            icon="id-card"
            label="Staff ID"
            description={profile.staffId}
            showDivider={false}
          />
        ) : null}
      </SettingsGroup>

      {/* Notifications Section */}
      <SettingsGroup title="NOTIFICATIONS" description="If phone notifications are off, ColdGuard will still keep incidents in Notifications for review in the app.">
        <SettingsRow
          icon="notifications"
          label="Phone Notifications"
          description={formatPermissionStatus(permissionStatus)}
          action={
            <Text style={[styles.labelText, { color: colors.primary }]}>
              {permissionStatus === "granted" ? "Manage in OS" : "Enable"}
            </Text>
          }
          onPress={() => void requestPermissions()}
          showDivider={false}
        />
      </SettingsGroup>

      {/* Routine Alerts Section */}
      <SettingsGroup title="ROUTINE ALERTS" description="Critical alerts are always on. Turning a routine alert off stops the interruption, but the incident will still appear in the app.">
        {ROUTINE_ALERT_OPTIONS.map((option, index) => {
          const isEnabled = preferences?.nonCriticalByType[option.type] ?? true;
          const isSaving = activePreference === option.type;
          
          return (
            <SettingsRow
              key={option.type}
              icon={getIconForAlertType(option.type)}
              label={option.title}
              description={option.description}
              showDivider={index < ROUTINE_ALERT_OPTIONS.length - 1}
              action={
                isSaving ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Switch
                    accessibilityLabel={`${option.title} routine alerts`}
                    ios_backgroundColor={colors.border}
                    onValueChange={(nextValue) => void handleToggleRoutineAlert(option.type, nextValue)}
                    thumbColor={isEnabled ? colors.textOnPrimary : colors.surface}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    value={isEnabled}
                  />
                )
              }
            />
          );
        })}
      </SettingsGroup>

      {/* Quiet Hours Section */}
      <SettingsGroup title="QUIET HOURS" description="Quiet hours are kept on your account and apply only to routine alerts sent to you.">
        <SettingsRow
          icon="moon"
          iconColor={colors.warning}
          iconBackgroundColor={`${colors.warning}22`}
          label="Current Routine Quiet Hours"
          description={formatQuietHours(preferences)}
          showDivider={false}
        />
      </SettingsGroup>

      {/* Facility Management Section */}
      {profile.role === "Supervisor" && (
        <SettingsGroup title="FACILITY MANAGEMENT" description="Manage facility staff access and roles.">
          <SettingsRow
            icon="people"
            iconColor={colors.primary}
            iconBackgroundColor={colors.primaryMuted}
            label="Staff Management"
            description="Add, remove, or edit staff members"
            action={<Ionicons color={colors.textSecondary} name="chevron-forward" size={20} />}
            onPress={() => router.push("/staff-management" as any)}
            showDivider={false}
          />
        </SettingsGroup>
      )}

      {/* Session Section */}
      <SettingsGroup title="SESSION">
        <SettingsRow
          icon="log-out"
          iconColor={colors.danger}
          iconBackgroundColor={`${colors.danger}22`}
          label="Sign out"
          description={profile.displayName}
          action={isSigningOut ? <ActivityIndicator color={colors.danger} size="small" /> : undefined}
          onPress={() => void handleSignOut()}
          showDivider={false}
        />
      </SettingsGroup>

      <View style={localStyles.bottomSpacing} />
    </DashboardPage>
  );
}

function getIconForAlertType(type: NotificationIncidentType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "temperature": return "thermometer";
    case "door_open": return "warning-outline";
    case "device_offline": return "wifi";
    case "battery_low": return "battery-dead";
    default: return "alert-circle";
  }
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

function createLocalStyles() {
  return StyleSheet.create({
    pageContent: {
      paddingTop: spacing.xl,
    },
    identityHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.lg,
      padding: spacing.lg,
    },
    avatar: {
      alignItems: "center",
      borderRadius: radii.pill,
      borderWidth: borderWidths.emphasis,
      height: 64,
      justifyContent: "center",
      width: 64,
    },
    avatarText: {
      fontSize: 22,
      fontWeight: "800",
    },
    identityCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    roleBadge: {
      alignSelf: "flex-start",
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "700",
    },
    divider: {
      height: borderWidths.hairline,
      marginLeft: spacing.lg + 64 + spacing.lg, // Align with text
    },
    bottomSpacing: {
      height: spacing["3xl"],
    },
  });
}
