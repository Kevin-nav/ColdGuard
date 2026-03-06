import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardHero } from "../../src/features/dashboard/components/dashboard-hero";
import { DashboardQuickActions } from "../../src/features/dashboard/components/dashboard-quick-actions";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { DeviceCard } from "../../src/features/dashboard/components/device-card";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { StatusStrip } from "../../src/features/dashboard/components/status-strip";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing } from "../../src/theme/tokens";

export default function HomeScreen() {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);
  const { alertCount, devices, error, isLoading, profile, safeCount, warningCount } =
    useDashboardContext();

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

  const quickActions: React.ComponentProps<typeof DashboardQuickActions>["actions"] =
    profile.role === "Supervisor"
      ? [
          {
            description: "Monitor temperature and status of all facility refrigerators.",
            icon: "cube-outline",
            label: "Open devices",
            onPress: () => router.push("/(tabs)/devices"),
          },
          {
            description: "Manage facility staff access and roles.",
            icon: "people-outline",
            label: "Staff Management",
            onPress: () => router.push("/staff-management"),
          },
          {
            description: "View your account and facility information.",
            icon: "person-outline",
            label: "Open profile",
            onPress: () => router.push("/(tabs)/profile"),
          },
        ]
      : [
          {
            description: "View the status of your assigned cold-chain units.",
            icon: "cube-outline",
            label: "Open devices",
            onPress: () => router.push("/(tabs)/devices"),
          },
          {
            description: "View your account and facility information.",
            icon: "person-outline",
            label: "Open profile",
            onPress: () => router.push("/(tabs)/profile"),
          },
        ];

  return (
    <DashboardPage scroll testID="dashboard-scroll-view">
      <DashboardHero
        institutionName={profile.institutionName}
        name={profile.displayName}
        role={profile.role}
        title={profile.role === "Supervisor" ? "Institution Command" : "Cold-Chain Readiness"}
      />

      <DashboardSection
        description={
          profile.role === "Supervisor"
            ? "Overview of your facility's cold-chain status and staff management."
            : "Monitor your current cold-chain units and alerts."
        }
        eyebrow="Today"
        title="ColdGuard Dashboard"
      >
        <StatusStrip
          alertCount={alertCount}
          safeCount={safeCount}
          warningCount={warningCount}
        />
      </DashboardSection>

      <DashboardSection
        description="Quick access to your most important tasks."
        eyebrow="Navigation"
        title="Quick actions"
      >
        <DashboardQuickActions actions={quickActions} />
      </DashboardSection>

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

      {profile.role === "Supervisor" ? (
        <DashboardSection
          description="Supervisor tools and administrative actions."
          eyebrow="Supervisor"
          title="Management actions"
        >
          <PanelCard>
            <Text style={shared.bodyText}>Staff Management</Text>
            <Text style={shared.bodyText}>Review devices</Text>
            <Text style={shared.bodyText}>System Status</Text>
          </PanelCard>
        </DashboardSection>
      ) : null}
    </DashboardPage>
  );
}

const localStyles = StyleSheet.create({
  devicesSection: {
    gap: spacing.md,
  },
});
