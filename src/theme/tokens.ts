export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const layout = {
  pageInset: spacing.xl,
  pageTopInset: spacing.xl,
  sectionGap: spacing.lg,
  contentGap: spacing.md,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const borderWidths = {
  hairline: 1,
  emphasis: 2,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  body: 15,
  lg: 18,
  xl: 22,
  "2xl": 28,
} as const;

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

export const typography = {
  eyebrow: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: fontWeight.extrabold,
  },
  heroTitle: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.extrabold,
    lineHeight: 32,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: fontWeight.extrabold,
  },
  body: {
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  bodyStrong: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  caption: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  meta: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase" as const,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: "#1B2A4A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  elevated: {
    shadowColor: "#1B2A4A",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

export type ColorPalette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  primary: string;
  primaryPressed: string;
  primaryMuted: string;
  border: string;
  borderFocused: string;
  success: string;
  warning: string;
  danger: string;
  bannerBg: string;
  bannerText: string;
};

export const lightColors: ColorPalette = {
  background: "#F4F6F9",
  surface: "#FFFFFF",
  surfaceMuted: "#EDF0F5",
  textPrimary: "#1B2A4A",
  textSecondary: "#5A6B8A",
  textOnPrimary: "#FFFFFF",
  primary: "#3B6B9E",
  primaryPressed: "#2D5580",
  primaryMuted: "#E8EFF7",
  border: "#D2D9E5",
  borderFocused: "#3B6B9E",
  success: "#2E7D5B",
  warning: "#C27D1A",
  danger: "#B83232",
  bannerBg: "#1B2A4A",
  bannerText: "#E8EFF7",
};

export const darkColors: ColorPalette = {
  background: "#0F1724",
  surface: "#1A2537",
  surfaceMuted: "#15202F",
  textPrimary: "#E2E8F0",
  textSecondary: "#8899B0",
  textOnPrimary: "#FFFFFF",
  primary: "#5B9BD5",
  primaryPressed: "#4A87C0",
  primaryMuted: "#1C2D42",
  border: "#2A3A52",
  borderFocused: "#5B9BD5",
  success: "#3DA87A",
  warning: "#D4982E",
  danger: "#D45050",
  bannerBg: "#0B1220",
  bannerText: "#8899B0",
};
