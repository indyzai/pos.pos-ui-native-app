import { StyleSheet, Text, View } from 'react-native';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAppTheme } from '../../providers/ThemeProvider';
import { AppPressable } from '../ui/AppPressable';
import { PosLogo } from '../branding/PosLogo';
import { isNavigationItemActive, tabletNavigationItems } from '../../navigation/routes';
export function TabletNavigationPane({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { themeColors: c } = useAppTheme();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <View
      style={[s.pane, collapsed && s.collapsed, { backgroundColor: c.surface, borderRightColor: c.outline }]}
    >
      <AppPressable onPress={onToggle} style={s.toggle}>
        <PosLogo size={collapsed ? 31 : 34} />
        {!collapsed && <Text style={[s.brand, { color: c.text }]}>INDYZ POS</Text>}
        {collapsed ? (
          <PanelLeftOpen size={19} color={c.textSecondary} />
        ) : (
          <PanelLeftClose size={19} color={c.textSecondary} />
        )}
      </AppPressable>
      {tabletNavigationItems.map(({ icon: Icon, label, href }) => {
        const active = isNavigationItemActive(pathname, href);
        return (
          <AppPressable
            key={label}
            onPress={() => router.replace(href)}
            style={[s.item, active && { backgroundColor: c.primarySoft }]}
          >
            <Icon size={18} color={active ? c.primary : c.textSecondary} strokeWidth={2.2} />
            {!collapsed && (
              <Text style={[s.label, { color: active ? c.primary : c.textSecondary }]}>{label}</Text>
            )}
          </AppPressable>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  pane: { width: 184, borderRightWidth: StyleSheet.hairlineWidth, padding: 18 },
  collapsed: { width: 72, paddingHorizontal: 10 },
  toggle: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brand: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  item: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  label: { fontSize: 13, fontWeight: '800' },
});
