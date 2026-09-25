import { TabletNavigationPane as SharedNavigation } from '@indyzai/pos-ui-native';
import { usePathname, useRouter } from 'expo-router';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
import {
    tabletNavigationItems,
    visibleNavigationItems,
    isNavigationItemActive,
} from '../../navigation/routes';

export function TabletNavigationPane({ collapsed }: { collapsed: boolean }) {
    const { flags } = useFeatureToggles();
    const pathname = usePathname();
    const router = useRouter();
    return (
        <SharedNavigation
            collapsed={collapsed}
            items={visibleNavigationItems(tabletNavigationItems, flags)}
            isActive={(href) => isNavigationItemActive(pathname, href)}
            onNavigate={(href) => router.replace(href)}
        />
    );
}
