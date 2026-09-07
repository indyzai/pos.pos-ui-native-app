import { StyleSheet, Text, View } from 'react-native';
import {
  ChartNoAxesCombined,
  Package,
  ReceiptText,
  Settings,
  UsersRound,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppPressable } from '../ui/AppPressable';
import { PosLogo } from '../branding/PosLogo';

const items = [
  { Icon: ReceiptText, label: 'Billing' },
  { Icon: ReceiptText, label: 'Orders' },
  { Icon: UsersRound, label: 'Customers' },
  { Icon: Package, label: 'Inventory' },
  { Icon: ChartNoAxesCombined, label: 'Reports' },
  { Icon: Settings, label: 'Settings' },
];
export function TabletNavigationPane({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { themeColors: c } = useAppTheme();
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
      {items.map(({ Icon, label }, index) => (
        <AppPressable key={label} style={[s.item, index === 0 && { backgroundColor: c.primarySoft }]}>
          <Icon size={18} color={index === 0 ? c.primary : c.textSecondary} strokeWidth={2.2} />
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
