import { BottomNavigation as SharedNavigation } from '@indyzai/pos-ui-native';
import { usePathname, useRouter } from 'expo-router';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
import {
    primaryNavigationItems,
    moreNavigationItems,
    reportNavigationItem,
    navigationItemsForRole,
    resolveStoreAccessRole,
    isNavigationItemActive,
} from '../../navigation/routes';
import { useAuthSession } from '@indyzai/pos-auth/session';

export function BottomNavigation() {
    const { flags } = useFeatureToggles();
    const pathname = usePathname();
    const router = useRouter();
    const { session } = useAuthSession();
    const role = resolveStoreAccessRole(session?.tenant.role, session?.user.role);
    return (
        <SharedNavigation
            primaryItems={navigationItemsForRole(primaryNavigationItems, role, flags)}
            moreItems={navigationItemsForRole(moreNavigationItems, role, flags)}
            trailingItem={flags.advancedReporting ? reportNavigationItem : undefined}
            isActive={(href) => isNavigationItemActive(pathname, href)}
            onNavigate={(href) => router.replace(href)}
        />
    );
}
