import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { DashboardPage } from "../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../src/features/dashboard/components/dashboard-section";
import { PanelCard } from "../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../src/features/dashboard/hooks/use-dashboard-context";
import { NotificationListItem } from "../src/features/notifications/components/notification-list-item";
import { useNotificationInbox } from "../src/features/notifications/hooks/use-notification-inbox";
import { createSharedStyles } from "../src/theme/shared-styles";
import { useTheme } from "../src/theme/theme-provider";
import { spacing } from "../src/theme/tokens";

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);
  const { error: dashboardError, isLoading: dashboardLoading, profile } = useDashboardContext();
  const inbox = useNotificationInbox();

  if (dashboardError) {
    return (
      <DashboardPage>
        <PanelCard>
          <Text style={shared.heading}>Notifications</Text>
          <Text style={shared.helperText}>{dashboardError}</Text>
        </PanelCard>
      </DashboardPage>
    );
  }

  if (dashboardLoading || !profile || inbox.isLoading) {
    return (
      <DashboardPage>
        <ActivityIndicator color={colors.primary} />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage scroll testID="notifications-scroll-view">
      <DashboardSection
        description="Active incidents needing action across your institution."
        eyebrow="Inbox"
        title="Notifications"
      >
        {inbox.activeIncidents.length === 0 ? (
          <PanelCard>
            <Text style={shared.bodyText}>No active incidents right now.</Text>
          </PanelCard>
        ) : (
          <View style={styles.stack}>
            {inbox.activeIncidents.map((incident) => (
              <NotificationListItem
                key={incident.id}
                incident={incident}
                onPress={() => router.push(`/incident/${incident.id}`)}
              />
            ))}
          </View>
        )}
      </DashboardSection>

      <DashboardSection
        description="Resolved activity that remains available for audit and review."
        eyebrow="History"
        title="Resolved recently"
      >
        {inbox.resolvedIncidents.length === 0 ? (
          <PanelCard>
            <Text style={shared.bodyText}>No resolved incidents yet.</Text>
          </PanelCard>
        ) : (
          <View style={styles.stack}>
            {inbox.resolvedIncidents.map((incident) => (
              <NotificationListItem
                key={incident.id}
                incident={incident}
                onPress={() => router.push(`/incident/${incident.id}`)}
              />
            ))}
          </View>
        )}
      </DashboardSection>
    </DashboardPage>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
});
