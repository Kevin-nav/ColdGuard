import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useUnreadCount } from "../../notifications/hooks/use-unread-count";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../theme/theme-provider";
import { borderWidths, spacing, typography } from "../../../theme/tokens";

export function TopNav() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadCount();

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
        <View style={styles.brandRow}>
          <Image
            source={require("../../../../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.textPrimary }]}>ColdGuard</Text>
        </View>

        <Pressable
          accessibilityLabel="Open notifications"
          accessibilityRole="button"
          onPress={() => router.push("/notifications")}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
          ]}
          testID="top-nav-notifications-button"
        >
          <Ionicons color={colors.textPrimary} name="notifications-outline" size={22} />
          {unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.danger }]} testID="notifications-unread-badge">
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
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
    justifyContent: "space-between",
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 40,
    justifyContent: "center",
    position: "relative",
    width: 40,
  },
  logo: {
    height: 32,
    width: 32,
  },
  badge: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: -2,
    top: -2,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  title: {
    ...typography.heroTitle,
    fontSize: 22, // Slightly smaller than hero title for nav bar
  },
});
