import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { DeviceCard } from "../../src/features/dashboard/components/device-card";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { SystemOverviewCard } from "../../src/features/dashboard/components/system-overview-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { NotificationListItem } from "../../src/features/notifications/components/notification-list-item";
import { useNotificationInbox } from "../../src/features/notifications/hooks/use-notification-inbox";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing } from "../../src/theme/tokens";
import { AnimatedEntry } from "../../src/components/animated-entry";

export default function HomeScreen() {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);
  const { alertCount, devices, error, isLoading, profile, safeCount, warningCount } =
    useDashboardContext();
  const { activeIncidents, markRead } = useNotificationInbox();

  if (error) {
    return (
      <DashboardPage>
        <PanelCard>
          <Text style={shared.heading}>ColdGuard Dashboard</Text>
          <Text style={shared.helperText}>{error}</Text>
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
    <DashboardPage scroll testID="dashboard-scroll-view">
      <AnimatedEntry delay={0}>
        <View style={localStyles.greetingContainer}>
          <Text style={shared.heading}>Welcome back, {profile.displayName.split(" ")[0]}</Text>
          <Text style={shared.subheading}>{profile.institutionName}</Text>
        </View>
      </AnimatedEntry>

      <AnimatedEntry delay={100}>
        <SystemOverviewCard
          alertCount={alertCount}
          safeCount={safeCount}
          warningCount={warningCount}
          onPress={() => router.push("/(tabs)/devices")}
        />
      </AnimatedEntry>

      {activeIncidents.length > 0 && (
        <AnimatedEntry delay={100}>
          <DashboardSection
            description="The highest-priority incidents that currently need staff attention."
            eyebrow="Incidents"
            title="Recent incidents"
          >
            {activeIncidents.slice(0, 3).map((incident) => (
              <NotificationListItem
                incident={incident}
                key={incident.id}
                onPress={() => {
                  void markRead(incident.id);
                  router.push(`/incident/${incident.id}`);
                }}
              />
            ))}
          </DashboardSection>
        </AnimatedEntry>
      )}

      <AnimatedEntry delay={activeIncidents.length > 0 ? 200 : 100}>
        <DashboardSection
          description="Recently active or flagged units."
          eyebrow="Devices"
          title={profile.role === "Supervisor" ? "Fleet snapshot" : "Assigned devices"}
        >
          <View style={localStyles.devicesSection}>
            {devices.length === 0 ? (
              <PanelCard>
                <Text style={shared.helperText}>No ColdGuard devices available yet.</Text>
              </PanelCard>
            ) : (
              devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onPress={() => router.push(`/device/${device.id}`)}
                />
              ))
            )}
          </View>
        </DashboardSection>
      </AnimatedEntry>
    </DashboardPage>
  );
}

const localStyles = StyleSheet.create({
  greetingContainer: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  devicesSection: {
    gap: spacing.md,
  },
});
