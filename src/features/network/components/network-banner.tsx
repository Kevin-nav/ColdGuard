import { StyleSheet, Text, View } from "react-native";
import { useNetworkStatus } from "../network-status";
import { useTheme } from "../../../theme/theme-provider";
import { spacing, fontSize, fontWeight } from "../../../theme/tokens";

export function NetworkBanner() {
  const { isOnline } = useNetworkStatus();
  const { colors } = useTheme();

  if (isOnline) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bannerBg, borderBottomColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.bannerText }]}>
        Offline mode: actions will retry automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
