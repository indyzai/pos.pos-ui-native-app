import type { ComponentType } from "react";

export type AuthThemeColors = Record<string, string>;
export type AuthUiConfiguration = {
    useTheme: () => {
        isDark: boolean;
        mode: string;
        setMode: (mode: "light" | "dark") => void;
        themeColors: AuthThemeColors;
    };
    showSnackbar: (title: string, message?: string) => void;
    Logo: ComponentType<{ size: number }>;
    loginTitle: string;
    loginSubtitle: string;
    signupTitle: string;
    signupSubtitle: string;
};

let configuration: AuthUiConfiguration | undefined;
export function configureAuthUi(value: AuthUiConfiguration): void {
    configuration = value;
}
export function getAuthUi(): AuthUiConfiguration {
    if (!configuration)
        throw new Error("Auth UI must be configured before rendering.");
    return configuration;
}
