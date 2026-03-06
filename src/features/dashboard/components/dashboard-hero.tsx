import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../theme/theme-provider";
import { radii, spacing, typography } from "../../../theme/tokens";
import { Badge } from "./badge";
import { PanelCard } from "./panel-card";

export function DashboardHero(props: { institutionName: string; name: string; role: string; title: string }) {
  const { colors } = useTheme();

  return (
    <PanelCard>
      <View style={styles.hero}>
        {/* Subtle background icon for visual flair */}
        <Ionicons
          color={colors.primary}
          name={props.role === "Supervisor" ? "shield-checkmark" : "medkit"}
          size={120}
          style={styles.bgIcon}
        />
        <View style={[styles.accentPanel, { backgroundColor: colors.primary }]} />
        <View style={styles.copy}>
          <View style={styles.topRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Welcome back, {props.name.split(" ")[0]}</Text>
            <Badge
              backgroundColor={colors.primaryMuted}
              iconName={props.role === "Supervisor" ? "shield" : "medical"}
              label={props.role}
              textColor={colors.textPrimary}
            />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{props.title}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{props.institutionName}</Text>
        </View>
      </View>
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    gap: spacing.md,
    overflow: "hidden", // In case the icon spills out
    position: "relative",
  },
  bgIcon: {
    bottom: -20,
    opacity: 0.05,
    position: "absolute",
    right: -20,
    zIndex: 0,
  },
  accentPanel: {
    borderRadius: radii.lg,
    minHeight: 104,
    width: 16,
    zIndex: 1,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
    zIndex: 1,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  label: {
    ...typography.eyebrow,
  },
  title: {
    ...typography.heroTitle,
  },
  meta: {
    ...typography.body,
    fontWeight: "600",
  },
});
