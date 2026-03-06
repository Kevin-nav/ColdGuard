import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";
import { spacing } from "../../../theme/tokens";

export function SectionHeader(props: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={shared.eyebrowText}>{props.eyebrow}</Text>
      <Text style={shared.sectionTitle}>{props.title}</Text>
      <Text style={shared.sectionDescription}>{props.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
});
