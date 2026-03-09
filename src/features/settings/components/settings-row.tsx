import { ReactNode, useMemo } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";
import { spacing, borderWidths } from "../../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";

interface SettingsRowProps {
  action?: ReactNode;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBackgroundColor?: string;
  label: string;
  onPress?: () => void;
  showDivider?: boolean;
}

export function SettingsRow({
  action,
  description,
  icon,
  iconColor,
  iconBackgroundColor,
  label,
  onPress,
  showDivider = true,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);

  const defaultIconBg = colors.primaryMuted;
  const defaultIconColor = colors.primary;

  const rowContent = (
    <View style={localStyles.row}>
      {icon ? (
        <View style={[localStyles.iconContainer, { backgroundColor: iconBackgroundColor || defaultIconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor || defaultIconColor} />
        </View>
      ) : null}

      <View style={localStyles.centerContent}>
        <Text style={styles.valueText}>{label}</Text>
        {description ? <Text style={styles.bodyText}>{description}</Text> : null}
      </View>

      {action ? (
        <View style={localStyles.actionContainer}>
          {action}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={localStyles.wrapper}>
      {onPress ? (
        <Pressable
          style={({ pressed }) => [
            pressed && { backgroundColor: "rgba(0, 0, 0, 0.05)" },
          ]}
          onPress={onPress}
        >
          {rowContent}
        </Pressable>
      ) : (
        rowContent
      )}
      {showDivider ? (
        <View style={[localStyles.divider, { backgroundColor: colors.border }]} />
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconContainer: {
    alignItems: "center",
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    marginRight: spacing.md,
    width: 32,
  },
  centerContent: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
  },
  actionContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: spacing.md,
  },
  divider: {
    height: borderWidths.hairline,
    marginLeft: spacing.lg + 32 + spacing.md, // Align with text content
  },
});
