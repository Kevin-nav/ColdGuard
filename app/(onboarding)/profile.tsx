import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/features/auth/providers/auth-provider";
import {
  getProfileSnapshot,
  type ProfileSnapshot,
} from "../../src/lib/storage/sqlite/profile-repository";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing } from "../../src/theme/tokens";

export default function OnboardingProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);
  const { user } = useAuthSession();
  const [cachedProfile, setCachedProfile] = useState<ProfileSnapshot | null>(null);
  const params = useLocalSearchParams<{
    displayName?: string;
    institutionName?: string;
    role?: string;
    staffId?: string;
  }>();

  useEffect(() => {
    void getProfileSnapshot().then(setCachedProfile);
  }, []);

  const displayName =
    (typeof params.displayName === "string" && params.displayName.trim()) ||
    cachedProfile?.displayName ||
    user?.displayName?.trim() ||
    "ColdGuard User";
  const email = user?.email?.trim() || "No email available";
  const firebaseUid = user?.uid ?? "Unavailable";
  const institutionName =
    (typeof params.institutionName === "string" && params.institutionName) ||
    cachedProfile?.institutionName ||
    "Unknown institution";
  const role =
    (typeof params.role === "string" && params.role.trim()) || cachedProfile?.role || "Nurse";
  const staffId =
    (typeof params.staffId === "string" && params.staffId) || cachedProfile?.staffId || "";
  const isSupervisor = role === "Supervisor";
  const accentColor = isSupervisor ? colors.warning : colors.success;
  const badgeBackground = isSupervisor ? "#FFF4DE" : "#E8F5EE";

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={localStyles.hero}>
          <View style={[localStyles.avatar, { borderColor: accentColor }]}>
            <Text style={[localStyles.avatarText, { color: accentColor }]}>
              {displayName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("") || "CG"}
            </Text>
          </View>
          <View style={localStyles.heroText}>
            <Text style={styles.heading}>Profile confirmed</Text>
            <Text style={styles.subheading}>
              Review your account details before continuing to the dashboard.
            </Text>
          </View>
        </View>

        <View
          style={[
            localStyles.roleBadge,
            { backgroundColor: badgeBackground, borderColor: accentColor },
          ]}
        >
          <Text style={[localStyles.roleBadgeText, { color: accentColor }]}>{role}</Text>
        </View>

        <View
          style={[
            localStyles.identityCard,
            { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Text style={[localStyles.identityName, { color: colors.textPrimary }]}>
            {displayName}
          </Text>
          <Text style={[localStyles.identityInstitution, { color: colors.textSecondary }]}>
            {institutionName}
          </Text>
        </View>

        <View style={[localStyles.rbacNote, { backgroundColor: colors.primaryMuted }]}>
          <Text style={[localStyles.rbacNoteTitle, { color: colors.textPrimary }]}>
            Access scope
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            {isSupervisor
              ? "Supervisor access will include nurse management and broader device visibility for this institution."
              : "Nurse access will stay scoped to your own assigned workflows and permitted device views."}
          </Text>
        </View>

        <View style={localStyles.profileSection}>
          <ProfileRow label="Role" value={role} textColor={colors.textPrimary} />
          <ProfileRow label="Name" value={displayName} textColor={colors.textPrimary} />
          <ProfileRow label="Email" value={email} textColor={colors.textPrimary} />
          <ProfileRow label="Firebase UID" value={firebaseUid} textColor={colors.textPrimary} />
          <ProfileRow label="Institution" value={institutionName} textColor={colors.textPrimary} />
          {staffId ? <ProfileRow label="Staff ID" value={staffId} textColor={colors.textPrimary} /> : null}
        </View>

        <Pressable
          onPress={() => router.replace("/(tabs)/home")}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? { backgroundColor: colors.primaryPressed } : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>Continue to Dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileRow(props: { label: string; value: string; textColor: string }) {
  return (
    <View style={profileStyles.row}>
      <Text style={[profileStyles.label, { color: props.textColor }]}>{props.label}</Text>
      <Text style={[profileStyles.value, { color: props.textColor }]}>{props.value}</Text>
    </View>
  );
}

function createLocalStyles() {
  return StyleSheet.create({
    hero: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    heroText: {
      flex: 1,
      gap: 2,
    },
    avatar: {
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 2,
      height: 60,
      justifyContent: "center",
      width: 60,
    },
    avatarText: {
      fontSize: 22,
      fontWeight: "800",
    },
    roleBadge: {
      alignSelf: "flex-start",
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    identityCard: {
      borderRadius: 16,
      borderWidth: 1,
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    identityName: {
      fontSize: 22,
      fontWeight: "800",
      lineHeight: 28,
    },
    identityInstitution: {
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
    },
    rbacNote: {
      borderRadius: 14,
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    rbacNoteTitle: {
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    profileSection: {
      gap: 12,
    },
  });
}

const profileStyles = StyleSheet.create({
  row: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.7,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
});
