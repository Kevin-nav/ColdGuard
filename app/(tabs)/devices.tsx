import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Text } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { DeviceCard } from "../../src/features/dashboard/components/device-card";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";

export default function DevicesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const { devices, error, isLoading, profile } = useDashboardContext();

  if (error) {
    return (
      <DashboardPage>
        <PanelCard>
          <Text style={styles.heading}>Devices</Text>
          <Text style={styles.helperText}>{error}</Text>
        </PanelCard>
      </DashboardPage>
    );
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <ActivityIndicator color={colors.primary} />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage scroll testID="devices-scroll-view">
      <DashboardSection
        description={
          profile?.role === "Supervisor"
            ? "Complete inventory of your facility's monitored equipment."
            : "Your assigned cold-chain devices in one focused view."
        }
        eyebrow="Device Workspace"
        title="Devices"
      >
        <PanelCard>
          <Text style={[styles.bodyText, { color: colors.textPrimary }]}>
            {profile?.role === "Supervisor"
              ? "Supervisor access: view all active facility units."
              : "Nurse access: viewing units assigned to you."}
          </Text>
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="All active and monitored units."
        eyebrow="Current Fleet"
        title={devices.length === 0 ? "No devices yet" : `${devices.length} active devices`}
      >
        {devices.length === 0 ? (
          <PanelCard>
            <Text style={styles.bodyText}>No ColdGuard devices available yet.</Text>
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
      </DashboardSection>
    </DashboardPage>
  );
}
