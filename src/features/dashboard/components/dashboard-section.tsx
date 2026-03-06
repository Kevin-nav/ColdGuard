import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../../../theme/tokens";
import { SectionHeader } from "./section-header";

export function DashboardSection(props: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        description={props.description}
        eyebrow={props.eyebrow}
        title={props.title}
      />
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
});
