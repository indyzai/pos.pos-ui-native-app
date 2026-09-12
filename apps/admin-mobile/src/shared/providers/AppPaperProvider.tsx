import { useMemo, type ReactNode } from 'react';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { useAppTheme } from './ThemeProvider';

export function AppPaperProvider({ children }: { children: ReactNode }) {
    const { isDark, themeColors: c } = useAppTheme();
    const theme = useMemo(() => {
        const base = isDark ? MD3DarkTheme : MD3LightTheme;
        return {
            ...base,
            roundness: 3,
            colors: {
                ...base.colors,
                primary: c.primary,
                primaryContainer: c.primarySoft,
                background: c.background,
                surface: c.surface,
                surfaceVariant: c.surfaceMuted,
                onSurface: c.text,
                onSurfaceVariant: c.textSecondary,
                outline: c.outline,
                outlineVariant: c.outlineMuted,
                error: c.error,
                errorContainer: c.errorSoft,
            },
        };
    }, [c, isDark]);

    return <PaperProvider theme={theme}>{children}</PaperProvider>;
}
