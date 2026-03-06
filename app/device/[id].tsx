import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { MetricRow } from "../../src/features/dashboard/components/metric-row";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing } from "../../src/theme/tokens";
import { Badge } from "../../src/features/dashboard/components/badge";
import { DeviceRecord } from "../../src/lib/storage/sqlite/device-repository";

function getStatusColor(status: DeviceRecord["mktStatus"], colors: ReturnType<typeof useTheme>["colors"]) {
  switch (status) {
    case "alert":
      return colors.danger;
    case "warning":
      return colors.warning;
    default:
      return colors.success;
  }
}

function getStatusIcon(status: DeviceRecord["mktStatus"]) {
  switch (status) {
    case "alert":
      return "alert-circle";
    case "warning":
      return "warning";
    default:
      return "checkmark-circle";
  }
}

function formatExactDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLastSeenRelative(lastSeenAt: number) {
  const minutes = Math.max(1, Math.round((Date.now() - lastSeenAt) / 60_000));
  if (minutes > 60) {
    const hours = Math.round(minutes / 60);
    if (hours > 24) {
      return `${Math.round(hours / 24)} days ago`;
    }
    return `${hours} hr ago`;
  }
  return `${minutes} min ago`;
}

export default function DeviceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const { devices, error, isLoading } = useDashboardContext();

  const device = devices.find((d) => d.id === id);

  if (isLoading) {
    return (
      <DashboardPage>
        <View style={localStyles.centerContent}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </DashboardPage>
    );
  }

  if (error || !device) {
    return (
      <DashboardPage>
        <DashboardSection title="Device Not Found" eyebrow="Error" description="Unable to locate device details.">
          <PanelCard>
            <Text style={styles.bodyText}>
              {error || "The requested device could not be found or you do not have permission to view it."}
            </Text>
            <TouchableOpacity 
              style={[localStyles.backButton, { backgroundColor: colors.surfaceMuted }]} 
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
              <Text style={[styles.bodyText, { color: colors.textPrimary }]}>Go Back</Text>
            </TouchableOpacity>
          </PanelCard>
        </DashboardSection>
      </DashboardPage>
    );
  }

  const statusColor = getStatusColor(device.mktStatus, colors);
  const statusIcon = getStatusIcon(device.mktStatus);

  return (
    <DashboardPage scroll>
      <View style={localStyles.headerRow}>
        <TouchableOpacity 
          style={localStyles.iconButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.heading, { flex: 1 }]} numberOfLines={1}>
          {device.nickname}
        </Text>
      </View>

      <DashboardSection title="Status Overview" eyebrow="Current State" description="Real-time device tracking and health indicators.">
        <PanelCard>
          <View style={localStyles.statusHeader}>
            <View style={localStyles.statusLabelGroup}>
              <Ionicons name="pulse" size={24} color={statusColor} />
              <Text style={[styles.subheading, { color: statusColor }]}>
                System Status
              </Text>
            </View>
            <Badge
              backgroundColor={statusColor}
              iconName={statusIcon}
              label={device.mktStatus.toUpperCase()}
              textColor={colors.textOnPrimary}
            />
          </View>
          <View style={localStyles.divider} />
          <View style={localStyles.metricsGrid}>
            <MetricRow 
              iconName="timer-outline" 
              label="Last Sync" 
              value={formatLastSeenRelative(device.lastSeenAt)} 
            />
            <MetricRow 
              iconName="calendar-outline" 
              label="Exact Time" 
              value={formatExactDate(device.lastSeenAt)} 
            />
          </View>
        </PanelCard>
      </DashboardSection>

      <DashboardSection title="Hardware Readings" eyebrow="Telemetry" description="Current sensor measurements.">
        <PanelCard>
          <View style={localStyles.metricsGrid}>
            <MetricRow 
              iconName="thermometer-outline" 
              label="Internal Temperature" 
              value={`${device.currentTempC.toFixed(2)} °C`} 
              valueColor={device.mktStatus === "alert" ? colors.danger : device.mktStatus === "warning" ? colors.warning : colors.success}
            />
            <View style={localStyles.divider} />
            <MetricRow 
              iconName="battery-half" 
              label="Battery Level" 
              value={`${device.batteryLevel}%`} 
              valueColor={device.batteryLevel < 20 ? colors.danger : undefined}
            />
            <View style={localStyles.divider} />
             <MetricRow
               iconName={device.doorOpen ? "lock-open-outline" : "lock-closed-outline"}
               label="Door Sensor"
               value={device.doorOpen ? "Door Open" : "Door Closed"}
               valueColor={device.doorOpen ? colors.warning : undefined}
             />
          </View>
        </PanelCard>
      </DashboardSection>

      <DashboardSection title="Device Details" eyebrow="Information" description="Specific hardware and facility allocation.">
        <PanelCard>
           <View style={localStyles.metricsGrid}>
            <MetricRow iconName="hardware-chip-outline" label="Device ID" value={device.id} />
             <View style={localStyles.divider} />
            <MetricRow iconName="barcode-outline" label="MAC Address" value={device.macAddress} />
            <View style={localStyles.divider} />
            <MetricRow iconName="business-outline" label="Facility" value={device.institutionName} />
          </View>
        </PanelCard>
      </DashboardSection>
    </DashboardPage>
  );
}

const localStyles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  statusLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(150, 150, 150, 0.1)",
    marginVertical: spacing.sm,
  },
  metricsGrid: {
    gap: spacing.sm,
  },
});
