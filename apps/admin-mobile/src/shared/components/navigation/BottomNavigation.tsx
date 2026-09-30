import { BottomNavigation as SharedNavigation } from '@indyzai/pos-ui-native';
import { usePathname, useRouter } from 'expo-router';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
import { useAuthSession } from '../../../auth/AuthSessionContext';
import {
  primaryNavigationItems,
  moreNavigationItems,
  orderNavigationItem,
  visibleNavigationItems,
  isNavigationItemActive,
} from '../../navigation/routes';

export function BottomNavigation() {
  const { flags } = useFeatureToggles();
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuthSession();
  const roleArgs = [session?.tenant.role, session?.user.role] as const;
  return (
    <SharedNavigation
      primaryItems={visibleNavigationItems(primaryNavigationItems, flags, ...roleArgs)}
      moreItems={visibleNavigationItems(moreNavigationItems, flags, ...roleArgs)}
      trailingItem={visibleNavigationItems([orderNavigationItem], flags, ...roleArgs)[0]}
      isActive={(href) => isNavigationItemActive(pathname, href)}
      onNavigate={(href) => router.replace(href)}
    />
  );
}
