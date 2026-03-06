import { StyleSheet } from "react-native";
import {
  borderWidths,
  type ColorPalette,
  fontSize,
  fontWeight,
  layout,
  radii,
  shadows,
  spacing,
  typography,
} from "./tokens";

export function createSharedStyles(colors: ColorPalette) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.background,
      padding: layout.pageInset,
      justifyContent: "center",
    },
    scrollContent: {
      flexGrow: 1,
      gap: layout.sectionGap,
      padding: layout.pageInset,
      paddingTop: layout.pageTopInset,
      paddingBottom: spacing["3xl"],
    },
    sectionStack: {
      gap: layout.sectionGap,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.xl,
      gap: spacing.md,
      ...shadows.card,
    },
    heading: {
      color: colors.textPrimary,
      fontSize: fontSize["2xl"],
      fontWeight: fontWeight.extrabold,
      letterSpacing: 0.2,
    },
    subheading: {
      color: colors.textSecondary,
      ...typography.body,
    },
    bodyText: {
      color: colors.textSecondary,
      ...typography.caption,
    },
    input: {
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceMuted,
      fontSize: fontSize.body,
    },
    primaryButton: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 13,
      alignItems: "center",
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
    },
    secondaryButton: {
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    helperText: {
      marginTop: spacing.xs,
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    eyebrowText: {
      color: colors.textSecondary,
      ...typography.eyebrow,
    },
    sectionTitle: {
      color: colors.textPrimary,
      ...typography.sectionTitle,
    },
    sectionDescription: {
      color: colors.textSecondary,
      ...typography.body,
    },
    pill: {
      alignSelf: "flex-start",
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    pillText: {
      ...typography.meta,
      fontWeight: fontWeight.extrabold,
    },
    labelText: {
      color: colors.textSecondary,
      ...typography.meta,
      opacity: 0.75,
    },
    valueText: {
      color: colors.textPrimary,
      ...typography.bodyStrong,
    },
  });
}
