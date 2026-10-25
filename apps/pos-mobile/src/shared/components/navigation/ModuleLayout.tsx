import type { ReactNode } from 'react';
import { View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useFeatureToggles } from '@indyzai/feature-flags/react';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { ModuleTabs } from '@indyzai/pos-ui-native';
import {
  moreNavigationItems,
  isNavigationItemActive,
  navigationItemsForRole,
  resolveStoreAccessRole,
} from '../../navigation/routes';
export function ModuleLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { flags } = useFeatureToggles();
  const { session } = useAuthSession();
  const items = navigationItemsForRole(
    moreNavigationItems,
    resolveStoreAccessRole(session?.tenant.role, session?.user.role),
    flags,
  );
  const module = items.find((item) =>
    item.children?.some((tab) => isNavigationItemActive(pathname, tab.href)),
  );
  return (
    <View style={{ flex: 1 }}>
      {module?.children && (
        <ModuleTabs
          title={module.label}
          items={module.children}
          isActive={(href) => isNavigationItemActive(pathname, href)}
          onNavigate={(href) => router.replace(href)}
        />
      )}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
