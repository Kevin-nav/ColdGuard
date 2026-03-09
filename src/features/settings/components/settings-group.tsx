import { ReactNode, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";
import { spacing } from "../../../theme/tokens";

interface SettingsGroupProps {
  children: ReactNode;
  description?: string;
  title?: string;
}

export function SettingsGroup({ children, description, title }: SettingsGroupProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);

  return (
    <View style={localStyles.container}>
      {title ? (
        <View style={localStyles.header}>
          <Text style={styles.eyebrowText}>{title}</Text>
        </View>
      ) : null}
      <View style={[localStyles.card, { backgroundColor: colors.surface }]}>
        {children}
      </View>
      {description ? (
        <View style={localStyles.footer}>
          <Text style={styles.bodyText}>{description}</Text>
        </View>
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
});
