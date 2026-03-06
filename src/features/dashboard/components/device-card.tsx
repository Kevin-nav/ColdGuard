import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DeviceRecord } from "../../../lib/storage/sqlite/device-repository";
import { useTheme } from "../../../theme/theme-provider";
import { spacing, typography } from "../../../theme/tokens";
import { Badge } from "./badge";
import { MetricRow } from "./metric-row";
import { PanelCard } from "./panel-card";

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

export function DeviceCard(props: { device: DeviceRecord; onPress?: () => void }) {
  const { colors } = useTheme();
  const statusColor = getStatusColor(props.device.mktStatus, colors);
  const statusIcon = getStatusIcon(props.device.mktStatus);

  const cardContent = (
    <PanelCard>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons color={colors.textPrimary} name="cube-outline" size={20} />
          <Text style={[styles.name, { color: colors.textPrimary }]}>{props.device.nickname}</Text>
        </View>
        <Badge
          backgroundColor={statusColor}
          iconName={statusIcon}
          label={props.device.mktStatus.toUpperCase()}
          textColor={colors.textOnPrimary}
        />
      </View>
      <View style={styles.metrics}>
        <MetricRow iconName="thermometer-outline" label="Temp" value={`${props.device.currentTempC.toFixed(1)} C`} />
        <MetricRow iconName="battery-half" label="Battery" value={`${props.device.batteryLevel}%`} />
        <MetricRow
          iconName={props.device.doorOpen ? "lock-open-outline" : "lock-closed-outline"}
          label="Door"
          value={props.device.doorOpen ? "Open" : "Closed"}
          valueColor={props.device.doorOpen ? colors.warning : undefined}
        />
      </View>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        Last seen {formatLastSeen(props.device.lastSeenAt)}
      </Text>
    </PanelCard>
  );

  if (props.onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={props.onPress}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
}

function formatLastSeen(lastSeenAt: number) {
  const minutes = Math.max(1, Math.round((Date.now() - lastSeenAt) / 60_000));
  return `${minutes} min ago`;
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    ...typography.cardTitle,
  },
  metrics: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  meta: {
    ...typography.meta,
    letterSpacing: 0.4,
  },
});
