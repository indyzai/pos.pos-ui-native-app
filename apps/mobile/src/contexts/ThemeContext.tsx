import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { colors, darkColors, type ThemeColors } from '../constants/theme';

type ThemeMode = 'light' | 'dark';
type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  themeColors: ThemeColors;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const value = useMemo(
    () => ({ mode, setMode, isDark: mode === 'dark', themeColors: mode === 'dark' ? darkColors : colors }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used within ThemeProvider');
  return context;
}
