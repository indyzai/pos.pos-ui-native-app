import { BottomNavigation as SharedNavigation } from '@indyzai/pos-ui-native';
import { usePathname, useRouter } from 'expo-router';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
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
  return (
    <SharedNavigation
      primaryItems={visibleNavigationItems(primaryNavigationItems, flags)}
      moreItems={visibleNavigationItems(moreNavigationItems, flags)}
      trailingItem={orderNavigationItem}
      isActive={(href) => isNavigationItemActive(pathname, href)}
      onNavigate={(href) => router.replace(href)}
    />
  );
}
