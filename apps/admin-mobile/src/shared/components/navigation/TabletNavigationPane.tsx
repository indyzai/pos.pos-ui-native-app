import { TabletNavigationPane as SharedNavigation } from '@indyzai/pos-ui-native';
import { usePathname, useRouter } from 'expo-router';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
import { useAuthSession } from '../../../auth/AuthSessionContext';
import {
  tabletNavigationItems,
  visibleNavigationItems,
  isNavigationItemActive,
} from '../../navigation/routes';

export function TabletNavigationPane({ collapsed }: { collapsed: boolean }) {
  const { flags } = useFeatureToggles();
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuthSession();
  return (
    <SharedNavigation
      collapsed={collapsed}
      items={visibleNavigationItems(tabletNavigationItems, flags, session?.tenant.role, session?.user.role)}
      isActive={(href) => isNavigationItemActive(pathname, href)}
      onNavigate={(href) => router.replace(href)}
    />
  );
}
