import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { type ColorPalette, darkColors, lightColors } from "./tokens";

type ThemeContextValue = {
    colors: ColorPalette;
    isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
    colors: lightColors,
    isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const scheme = useColorScheme();
    const isDark = scheme === "dark";

    const value = useMemo<ThemeContextValue>(
        () => ({
            colors: isDark ? darkColors : lightColors,
            isDark,
        }),
        [isDark],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    return useContext(ThemeContext);
}
