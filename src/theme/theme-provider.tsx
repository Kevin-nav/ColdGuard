import { createContext, useContext, useMemo } from "react";
import { type ColorPalette, lightColors } from "./tokens";

type ThemeContextValue = {
    colors: ColorPalette;
    isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
    colors: lightColors,
    isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const value = useMemo<ThemeContextValue>(
        () => ({
            colors: lightColors,
            isDark: false,
        }),
        [],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    return useContext(ThemeContext);
}
