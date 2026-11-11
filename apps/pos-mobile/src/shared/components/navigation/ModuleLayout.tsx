import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Submenu destinations are available in More and the tablet sidebar. */
export function ModuleLayout({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
