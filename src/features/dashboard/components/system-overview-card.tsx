import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../theme/theme-provider";
import { radii, spacing, typography, borderWidths } from "../../../theme/tokens";
import { PanelCard } from "./panel-card";

export function SystemOverviewCard(props: {
  alertCount: number;
  safeCount: number;
  warningCount: number;
  onPress?: () => void;
}) {
  const { colors } = useTheme();

  let statusColor = colors.success;
  let statusIcon: keyof typeof Ionicons.glyphMap = "shield-checkmark-outline";
  let statusText = "All systems normal";
  let statusDescription = "Your cold-chain units are operating within safe parameters.";

  if (props.alertCount > 0) {
    statusColor = colors.danger;
    statusIcon = "alert-circle-outline";
    statusText = "Critical attention required";
    statusDescription = `${props.alertCount} unit(s) are outside safe parameters and need immediate intervention.`;
  } else if (props.warningCount > 0) {
    statusColor = colors.warning;
    statusIcon = "warning-outline";
    statusText = "Warnings detected";
    statusDescription = `${props.warningCount} unit(s) have warnings that should be reviewed.`;
  } else if (props.safeCount === 0) {
    statusColor = colors.textSecondary;
    statusIcon = "cube-outline";
    statusText = "No units active";
    statusDescription = "There are no active cold-chain units reporting data.";
  }

  const hasIssues = props.alertCount > 0 || props.warningCount > 0;
  const isInteractive = !!props.onPress && hasIssues;

  const content = (
    <>
      <View style={styles.container}>
        <Ionicons color={statusColor} name={statusIcon} size={42} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{statusText}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{statusDescription}</Text>
        </View>
      </View>
      
      {(props.alertCount > 0 || props.warningCount > 0 || props.safeCount > 0) && (
        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.danger }]}>{props.alertCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Alerts</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{props.warningCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Warnings</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.success }]}>{props.safeCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Safe</Text>
          </View>
        </View>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <PanelCard interactive onPress={props.onPress!}>
        {content}
      </PanelCard>
    );
  }

  return <PanelCard>{content}</PanelCard>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.cardTitle,
    fontSize: 18,
  },
  description: {
    ...typography.body,
  },
  statsRow: {
    borderTopWidth: borderWidths.hairline,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  stat: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
