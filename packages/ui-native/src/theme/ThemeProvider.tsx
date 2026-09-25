import {
    createContext,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { colors, darkColors, type ThemeColors } from "./tokens";

export type ThemeMode = "light" | "dark";
export type ThemeContextValue = {
    mode: ThemeMode;
    setMode: (mode: ThemeMode | null) => void;
    setPrimaryColor: (color: string | null) => void;
    isDark: boolean;
    themeColors: ThemeColors;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemScheme = useColorScheme();
    const [manualMode, setManualMode] = useState<ThemeMode | null>(null);
    const [primaryColor, setPrimaryColor] = useState<string | null>(null);
    const mode: ThemeMode =
        manualMode ?? (systemScheme === "dark" ? "dark" : "light");
    const value = useMemo(
        () => ({
            mode,
            setMode: setManualMode,
            setPrimaryColor,
            isDark: mode === "dark",
            themeColors: {
                ...(mode === "dark" ? darkColors : colors),
                ...(primaryColor && /^#[\da-f]{6}$/i.test(primaryColor)
                    ? {
                          primary: primaryColor,
                          primarySoft: `${primaryColor}25`,
                      }
                    : {}),
            },
        }),
        [mode, primaryColor],
    );
    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
}

export function useAppTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context)
        throw new Error("useAppTheme must be used within ThemeProvider");
    return context;
}
