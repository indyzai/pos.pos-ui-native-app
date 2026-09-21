import type { LucideIcon } from 'lucide-react-native';
import { ModulePlaceholder as SharedModulePlaceholder } from '@indyzai/pos-ui-native/placeholder';
import { BottomNavigation } from '../navigation/BottomNavigation';

export function ModulePlaceholder({ title, icon }: { title: string; icon: LucideIcon }) {
  return <SharedModulePlaceholder title={title} icon={icon} bottomNavigation={BottomNavigation} />;
}
