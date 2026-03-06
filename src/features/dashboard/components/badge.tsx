import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";

export function Badge(props: {
  backgroundColor: string;
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  textColor: string;
}) {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);

  return (
    <View style={[shared.pill, styles.container, { backgroundColor: props.backgroundColor }]}>
      {props.iconName ? <Ionicons color={props.textColor} name={props.iconName} size={14} /> : null}
      <Text style={[shared.pillText, { color: props.textColor }]}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
});
