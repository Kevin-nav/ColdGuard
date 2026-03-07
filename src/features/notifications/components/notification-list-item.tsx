import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";
import { fontSize, fontWeight, spacing } from "../../../theme/tokens";
import { PanelCard } from "../../dashboard/components/panel-card";
import {
  formatNotificationTypeLabel,
  getNotificationSeverityColorKey,
  type NotificationIncidentRecord,
} from "../types";

export function NotificationListItem(props: {
  incident: NotificationIncidentRecord;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);
  const accentColor =
    getNotificationSeverityColorKey(props.incident.severity) === "danger"
      ? colors.danger
      : colors.warning;

  const content = (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
        <Ionicons
          color={accentColor}
          name={props.incident.severity === "critical" ? "alert-circle" : "warning"}
          size={20}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.metaRow}>
          <Text style={[shared.eyebrowText, { color: accentColor }]}>
            {formatNotificationTypeLabel(props.incident.incidentType)}
          </Text>
          {!props.incident.readAt ? (
            <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
          ) : null}
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{props.incident.title}</Text>
        <Text style={shared.bodyText}>{props.incident.body}</Text>
        <Text style={shared.helperText}>
          {props.incident.deviceNickname} - {formatStatusLabel(props.incident.status)}
        </Text>
      </View>
    </View>
  );

  if (props.onPress) {
    return (
      <PanelCard interactive onPress={props.onPress}>
        {content}
      </PanelCard>
    );
  }

  return <PanelCard>{content}</PanelCard>;
}

function formatStatusLabel(status: NotificationIncidentRecord["status"]) {
  switch (status) {
    case "acknowledged":
      return "Acknowledged";
    case "resolved":
      return "Resolved";
    default:
      return "Open";
  }
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 16,
    height: 36,
    justifyContent: "center",
    marginTop: 2,
    width: 36,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  unreadDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
});
