import { TabletNavigationPane as SharedNavigation } from '@indyzai/pos-ui-native';
import { usePathname, useRouter } from 'expo-router';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
import {
  tabletNavigationItems,
  navigationItemsForRole,
  resolveStoreAccessRole,
  isNavigationItemActive,
} from '../../navigation/routes';
import { useAuthSession } from '@indyzai/pos-auth/session';

export function TabletNavigationPane({ collapsed }: { collapsed: boolean }) {
  const { flags } = useFeatureToggles();
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuthSession();
  const role = resolveStoreAccessRole(session?.tenant.role, session?.user.role);
  return (
    <SharedNavigation
      collapsed={collapsed}
      items={navigationItemsForRole(tabletNavigationItems, role, flags)}
      isActive={(href) => isNavigationItemActive(pathname, href)}
      onNavigate={(href) => router.replace(href)}
    />
  );
}
