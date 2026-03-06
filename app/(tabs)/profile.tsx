import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/features/dashboard/components/badge";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { MetricRow } from "../../src/features/dashboard/components/metric-row";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { borderWidths, radii, spacing } from "../../src/theme/tokens";

export default function ProfileTabScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);
  const { error, isLoading, profile } = useDashboardContext();

  if (error) {
    return (
      <DashboardPage>
        <PanelCard>
          <Text style={styles.heading}>My Profile</Text>
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
    <DashboardPage scroll testID="profile-scroll-view">
      <DashboardSection
        description="Manage your personal account details."
        eyebrow="Personal"
        title="My Profile"
      >
        <PanelCard>
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
              <Text style={styles.subheading}>{profile.institutionName}</Text>
            </View>
          </View>

          <Badge backgroundColor={colors.primaryMuted} label={profile.role} textColor={colors.textPrimary} />
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Your account and institution information."
        eyebrow="Details"
        title="Account details"
      >
        <PanelCard>
          <MetricRow label="Email" value={profile.email} />
          <MetricRow label="Institution" value={profile.institutionName} />
          <MetricRow label="Role" value={profile.role} />
          {profile.staffId ? (
            <MetricRow label="Staff ID" value={profile.staffId} />
          ) : null}
        </PanelCard>
      </DashboardSection>
    </DashboardPage>
  );
}

function createLocalStyles() {
  return StyleSheet.create({
    identityHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
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
      gap: 2,
    },
  });
}
