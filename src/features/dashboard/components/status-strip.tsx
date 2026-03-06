import { StyleSheet, View } from "react-native";
import { useTheme } from "../../../theme/theme-provider";
import { spacing } from "../../../theme/tokens";
import { Badge } from "./badge";

export function StatusStrip(props: {
  alertCount: number;
  safeCount: number;
  warningCount: number;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.row} testID="status-strip">
      <Badge backgroundColor={colors.success} iconName="checkmark-circle" label={`${props.safeCount} safe`} textColor={colors.textOnPrimary} />
      <Badge
        backgroundColor={colors.warning}
        iconName="warning"
        label={`${props.warningCount} warning`}
        textColor={colors.textOnPrimary}
      />
      <Badge backgroundColor={colors.danger} iconName="alert-circle" label={`${props.alertCount} alert`} textColor={colors.textOnPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
