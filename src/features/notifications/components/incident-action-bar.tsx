import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";
import { spacing } from "../../../theme/tokens";
import { type NotificationIncidentRecord } from "../types";

export function IncidentActionBar(props: {
  incident: NotificationIncidentRecord;
  onAcknowledge: () => Promise<void>;
  onResolve: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);
  const [activeAction, setActiveAction] = useState<"acknowledge" | "resolve" | null>(null);

  async function runAction(kind: "acknowledge" | "resolve", action: () => Promise<void>) {
    setActiveAction(kind);
    try {
      await action();
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <View style={styles.actionsRow}>
      {props.incident.status === "open" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void runAction("acknowledge", props.onAcknowledge)}
          style={({ pressed }) => [
            shared.secondaryButton,
            styles.actionButton,
            pressed ? { backgroundColor: colors.surfaceMuted } : null,
          ]}
        >
          {activeAction === "acknowledge" ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={shared.secondaryButtonText}>Acknowledge</Text>
          )}
        </Pressable>
      ) : null}
      {props.incident.status !== "resolved" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void runAction("resolve", props.onResolve)}
          style={({ pressed }) => [
            shared.primaryButton,
            styles.actionButton,
            pressed ? { backgroundColor: colors.primaryPressed } : null,
          ]}
        >
          {activeAction === "resolve" ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={shared.primaryButtonText}>Resolve</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    marginTop: 0,
  },
});
