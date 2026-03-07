import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../theme/theme-provider";
import { borderWidths, spacing, typography } from "../../../theme/tokens";

export function TopNav() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: Math.max(insets.top, spacing.lg),
        },
      ]}
    >
      <View style={styles.content}>
        <Image
          source={require("../../../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: colors.textPrimary }]}>ColdGuard</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: borderWidths.hairline,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  logo: {
    height: 32,
    width: 32,
  },
  title: {
    ...typography.heroTitle,
    fontSize: 22, // Slightly smaller than hero title for nav bar
  },
});
