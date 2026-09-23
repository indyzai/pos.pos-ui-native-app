import { useMemo, type ReactNode } from 'react';
import {
    AuthSessionProvider as SharedAuthSessionProvider,
    getActiveAuthSession,
    useAuthSession,
    type AuthSession,
} from '@indyzai/pos-auth/session';
import { canAccessApp } from '../config/appAccess';
import { setUnauthorizedHandler } from '@indyzai/pos-api';
import { loadOrganizationDetails } from '../features/organization/organizationApi';
import { useAppTheme } from '@indyzai/pos-ui-native';
import { authApi } from './authApi';
import { createOrganizationCache } from '@indyzai/feature-organization/organizationCache';
const organizationCache = createOrganizationCache('admin');
import './ui';

export { getActiveAuthSession, useAuthSession };
export type { AuthSession };

export function AuthSessionProvider({ children }: { children: ReactNode }) {
    const { themeColors } = useAppTheme();
    const configuration = useMemo(
        () => ({
            authApi,
            setUnauthorizedHandler,
            loadOrganizationDetails,
            loadCachedOrganizationDetails: organizationCache.read,
            saveCachedOrganizationDetails: organizationCache.write,
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
