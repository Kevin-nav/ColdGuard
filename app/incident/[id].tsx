import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/features/dashboard/components/badge";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { MetricRow } from "../../src/features/dashboard/components/metric-row";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { IncidentActionBar } from "../../src/features/notifications/components/incident-action-bar";
import { useNotificationInbox } from "../../src/features/notifications/hooks/use-notification-inbox";
import {
  formatNotificationTypeLabel,
  getNotificationSeverityColorKey,
  type NotificationIncidentRecord,
} from "../../src/features/notifications/types";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing } from "../../src/theme/tokens";

function formatExactDate(timestamp: number | null) {
  if (!timestamp) return "Not recorded";
  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);
  const { isLoading: dashboardLoading } = useDashboardContext();
  const inbox = useNotificationInbox();
  const { acknowledgeIncident, getIncidentById, incidents, isLoading, markRead, resolveIncident } = inbox;
  const [incident, setIncident] = useState<NotificationIncidentRecord | null>(null);

  useEffect(() => {
    let active = true;

    async function loadIncident() {
      if (!id) return;
      const cached = incidents.find((entry) => entry.id === id) ?? (await getIncidentById(id));
      if (!active || !cached) return;
      setIncident(cached);
      await markRead(cached.id);
    }

    void loadIncident();

    return () => {
      active = false;
    };
  }, [getIncidentById, id, incidents, markRead]);

  if (dashboardLoading || isLoading) {
    return (
      <DashboardPage>
        <ActivityIndicator color={colors.primary} />
      </DashboardPage>
    );
  }

  if (!incident) {
    return (
      <DashboardPage>
        <DashboardSection
          description="This incident may have been cleared or is not available on this device yet."
          eyebrow="Notifications"
          title="Incident not found"
        >
          <PanelCard>
            <Text style={shared.bodyText}>Unable to locate the requested incident.</Text>
          </PanelCard>
        </DashboardSection>
      </DashboardPage>
    );
  }

  const severityColorKey = getNotificationSeverityColorKey(incident.severity);

  return (
    <DashboardPage scroll contentContainerStyle={styles.pageContent} testID="incident-detail-scroll-view">
      <DashboardSection
        description={incident.body}
        eyebrow="Incident"
        title={incident.title}
      >
        <PanelCard>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={shared.valueText}>{incident.deviceNickname}</Text>
              <Text style={shared.bodyText}>{formatNotificationTypeLabel(incident.incidentType)}</Text>
            </View>
            <Badge
              backgroundColor={colors[severityColorKey]}
              label={incident.severity.toUpperCase()}
              textColor={colors.textOnPrimary}
            />
          </View>
          <IncidentActionBar
            incident={incident}
            onAcknowledge={async () => {
              await acknowledgeIncident(incident.id);
              setIncident((current) =>
                current
                  ? {
                      ...current,
                      status: "acknowledged",
                      acknowledgedAt: Date.now(),
                    }
                  : current,
              );
            }}
            onResolve={async () => {
              await resolveIncident(incident.id);
              setIncident((current) =>
                current
                  ? {
                      ...current,
                      status: "resolved",
                      resolvedAt: Date.now(),
                    }
                  : current,
              );
            }}
          />
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Current device and incident metadata."
        eyebrow="Context"
        title="Operational context"
      >
        <PanelCard>
          <MetricRow label="Status" value={incident.status} />
          <View style={styles.divider} />
          <MetricRow label="Triggered" value={formatExactDate(incident.firstTriggeredAt)} />
          <View style={styles.divider} />
          <MetricRow label="Last update" value={formatExactDate(incident.lastTriggeredAt)} />
          <View style={styles.divider} />
          <MetricRow label="Acknowledged" value={formatExactDate(incident.acknowledgedAt)} />
          <View style={styles.divider} />
          <MetricRow label="Resolved" value={formatExactDate(incident.resolvedAt)} />
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Incident events captured on this device."
        eyebrow="Timeline"
        title="Event history"
      >
        <PanelCard>
          <View style={styles.timeline}>
            {incident.timeline.map((event) => (
              <View key={event.id} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: colors[severityColorKey] }]} />
                <View style={styles.timelineCopy}>
                  <Text style={shared.valueText}>{event.summary}</Text>
                  <Text style={shared.bodyText}>{formatExactDate(event.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        </PanelCard>
      </DashboardSection>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/device/${incident.deviceId}`)}
        style={({ pressed }) => [
          shared.primaryButton,
          pressed ? { backgroundColor: colors.primaryPressed } : null,
        ]}
      >
        <Text style={shared.primaryButtonText}>Open device</Text>
      </Pressable>
    </DashboardPage>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    paddingTop: spacing["3xl"],
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  divider: {
    backgroundColor: "rgba(150, 150, 150, 0.12)",
    height: 1,
    marginVertical: spacing.sm,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  timelineDot: {
    borderRadius: 999,
    height: 10,
    marginTop: 6,
    width: 10,
  },
  timelineCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
