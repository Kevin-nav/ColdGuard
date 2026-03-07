import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { DashboardPage } from "../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../src/features/dashboard/components/dashboard-section";
import { PanelCard } from "../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../src/features/dashboard/hooks/use-dashboard-context";
import { createSharedStyles } from "../src/theme/shared-styles";
import { useTheme } from "../src/theme/theme-provider";

export default function StaffManagementScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const { error, isLoading, profile } = useDashboardContext();

  if (error) {
    return (
      <DashboardPage>
        <PanelCard>
          <Text style={styles.heading}>Staff Management</Text>
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

  if (profile.role !== "Supervisor") {
    return (
      <DashboardPage>
        <PanelCard>
          <Text style={styles.heading}>Staff Management</Text>
          <Text style={styles.helperText}>
            Staff management is available to supervisors only.
          </Text>
        </PanelCard>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage scroll testID="staff-management-scroll-view">
      <DashboardSection
        description="A dedicated destination for team operations, kept separate from the personal profile experience."
        eyebrow="Supervisor"
        title="Staff Management"
      >
        <PanelCard>
          <Text style={styles.bodyText}>Institution: {profile.institutionName}</Text>
          <Text style={styles.bodyText}>Staff roster, invitations, and role changes can expand here.</Text>
          <Text style={styles.bodyText}>This route exists now so supervisor workflows have a clear home.</Text>
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="The dashboard launches this workspace; this screen carries the dedicated team-management responsibilities."
        eyebrow="Next actions"
        title="Supervisor tools"
      >
        <Pressable
          onPress={() => router.replace("/(tabs)/home")}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed ? { backgroundColor: colors.primaryMuted } : null,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Back to dashboard</Text>
        </Pressable>
      </DashboardSection>
    </DashboardPage>
  );
}
