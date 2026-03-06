import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";
import { spacing } from "../../../theme/tokens";

export function MetricRow(props: {
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <View style={styles.labelContainer}>
        {props.iconName ? (
          <Ionicons color={colors.textSecondary} name={props.iconName} size={16} />
        ) : null}
        <Text style={shared.labelText}>{props.label}</Text>
      </View>
      <Text style={[shared.valueText, props.valueColor ? { color: props.valueColor } : null]}>
        {props.value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
  },
  labelContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
});
