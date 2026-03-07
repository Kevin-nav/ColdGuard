import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../theme/theme-provider";
import { spacing, typography } from "../../../theme/tokens";
import { PanelCard } from "./panel-card";

export function DashboardQuickActions(props: {
  actions: { description: string; icon?: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }[];
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {props.actions.map((action) => (
        <View key={action.label} style={styles.gridItem}>
          <PanelCard interactive onPress={action.onPress}>
            {action.icon ? (
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons color={colors.primary} name={action.icon} size={20} />
              </View>
            ) : null}
            <Text style={[styles.label, { color: colors.textPrimary }]}>{action.label}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{action.description}</Text>
          </PanelCard>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  gridItem: {
    flexBasis: "48%", // Roughly half width minus gap
    flexGrow: 1,
  },
  iconContainer: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: 40,
  },
  label: {
    ...typography.cardTitle,
    marginBottom: 2,
  },
  description: {
    ...typography.caption,
  },
});
