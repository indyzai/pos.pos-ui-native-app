import { useMemo, type ReactNode } from 'react';
import {
    AuthSessionProvider as SharedAuthSessionProvider,
    getActiveAuthSession,
    useAuthSession,
    type AuthSession,
} from '@indyzai/pos-auth/session';
import { canAccessApp } from '../config/appAccess';
import { setUnauthorizedHandler } from '../core/api/baseApi';
import { loadOrganizationDetails } from '../features/organization/organizationApi';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { authApi } from './authApi';

export { getActiveAuthSession, useAuthSession };
export type { AuthSession };

export function AuthSessionProvider({ children }: { children: ReactNode }) {
    const { themeColors } = useAppTheme();
    const configuration = useMemo(
        () => ({
            authApi,
            setUnauthorizedHandler,
            loadOrganizationDetails,
            canAccessApp,
            accessDeniedMessage: 'Use the POS app for cashier and manager accounts.',
            loaderColors: {
                background: themeColors.background,
                primary: themeColors.primary,
                textSecondary: themeColors.textSecondary,
            },
        }),
        [themeColors],
    );
    return <SharedAuthSessionProvider configuration={configuration}>{children}</SharedAuthSessionProvider>;
}
