import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { ProfileSnapshot } from "../../../lib/storage/sqlite/profile-repository";
import { useTheme } from "../../../theme/theme-provider";
import { borderWidths, radii, spacing, typography } from "../../../theme/tokens";
import { PanelCard } from "./panel-card";

export function ProfileSummaryCard(props: {
  profile: ProfileSnapshot;
  onPressProfile: () => void;
}) {
  const { colors } = useTheme();
  const accentColor = props.profile.role === "Supervisor" ? colors.warning : colors.success;

  return (
    <PanelCard interactive onPress={props.onPressProfile} testID="profile-summary-card">
      <View style={styles.header}>
        <View style={[styles.avatar, { borderColor: accentColor }]}>
          <Text style={[styles.avatarText, { color: accentColor }]}>
            {props.profile.displayName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("") || "CG"}
          </Text>
        </View>
        <View style={styles.copy}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{props.profile.displayName}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{props.profile.institutionName}</Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>Personal profile only</Text>
        </View>
        <Ionicons color={colors.textSecondary} name="chevron-forward" size={20} />
      </View>
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  avatar: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: borderWidths.emphasis,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.cardTitle,
  },
  meta: {
    ...typography.caption,
  },
  helper: {
    ...typography.meta,
    letterSpacing: 0.4,
    opacity: 0.75,
  },
});
