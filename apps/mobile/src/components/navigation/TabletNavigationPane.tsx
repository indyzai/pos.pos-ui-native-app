import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppPressable } from '../ui/AppPressable';

const items = [
  ['▦', 'Billing'],
  ['▤', 'Orders'],
  ['◉', 'Customers'],
  ['▣', 'Inventory'],
  ['◔', 'Reports'],
  ['⚙', 'Settings'],
];
export function TabletNavigationPane({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { themeColors: c } = useAppTheme();
  return (
    <View
      style={[s.pane, collapsed && s.collapsed, { backgroundColor: c.surface, borderRightColor: c.outline }]}
    >
      <AppPressable onPress={onToggle} style={s.toggle}>
        <Text style={[s.brand, { color: c.primary }]}>{collapsed ? 'i' : 'indyz'}</Text>
        <Text style={[s.toggleIcon, { color: c.textSecondary }]}>{collapsed ? '›' : '‹'}</Text>
      </AppPressable>
      {items.map(([icon, label], index) => (
        <AppPressable key={label} style={[s.item, index === 0 && { backgroundColor: c.primarySoft }]}>
          <Text style={[s.icon, { color: index === 0 ? c.primary : c.textSecondary }]}>{icon}</Text>
          {!collapsed && (
            <Text style={[s.label, { color: index === 0 ? c.primary : c.textSecondary }]}>{label}</Text>
          )}
        </AppPressable>
      ))}
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
  brand: { fontSize: 21, fontWeight: '900', fontStyle: 'italic' },
  toggleIcon: { fontSize: 22 },
  item: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  icon: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800' },
});
