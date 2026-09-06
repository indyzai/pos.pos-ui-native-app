import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';
import { useBottomNavigation } from '../../contexts/BottomNavigationContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppPressable } from '../ui/AppPressable';

const leftItems = [
  { label: 'Billing', icon: '▦', active: true },
  { label: 'Orders', icon: '▤', active: false },
];
const rightItems = [
  { label: 'Reports', icon: '◔' },
  { label: 'More', icon: '☰' },
];

/** Global Material navigation shell. Modules populate its raised center action. */
export function BottomNavigation() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { centerItem } = useBottomNavigation();
  const { themeColors: c } = useAppTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  if (width >= 700 && width > height) return null;
  return (
    <View
      style={[
        s.bar,
        {
          height: 66 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: c.surface,
          borderTopColor: c.outline,
        },
      ]}
    >
      <View style={s.items}>
        {leftItems.map((item) => (
          <NavigationItem key={item.label} {...item} />
        ))}
        <View style={s.centerSpacer} />
        {rightItems.map((item) => (
          <NavigationItem
            key={item.label}
            {...item}
            onPress={item.label === 'More' ? () => setMoreOpen(true) : undefined}
          />
        ))}
      </View>
      {centerItem && (
        <AppPressable
          accessibilityLabel={centerItem.label}
          onPress={centerItem.onPress}
          style={s.centerAction}
        >
          <View style={[s.centerCircle, { backgroundColor: c.primarySoft, borderColor: c.background }]}>
            <Text style={[s.centerIcon, { color: c.primary }]}>{centerItem.icon}</Text>
            {(centerItem.badge ?? 0) > 0 && (
              <View style={[s.badge, { backgroundColor: c.error, borderColor: c.surface }]}>
                <Text style={s.badgeText}>{centerItem.badge}</Text>
              </View>
            )}
          </View>
          <Text style={[s.centerLabel, { color: c.primary }]}>{centerItem.label}</Text>
        </AppPressable>
      )}
      <MoreMenu visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </View>
  );
}

function NavigationItem({
  label,
  icon,
  active = false,
  onPress,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { themeColors: c } = useAppTheme();
  return (
    <AppPressable accessibilityLabel={label} onPress={onPress} style={s.item}>
      <View style={[s.iconWrap, active && { backgroundColor: c.primarySoft }]}>
        <Text style={[s.icon, { color: active ? c.primary : c.textSecondary }]}>{icon}</Text>
      </View>
      <Text style={[s.label, { color: active ? c.primary : c.textSecondary }]}>{label}</Text>
    </AppPressable>
  );
}

function MoreMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { themeColors: c } = useAppTheme();
  const items = [
    ['◉', 'Customers'],
    ['▣', 'Inventory'],
    ['⇄', 'Transfers'],
    ['₹', 'Expenses'],
    ['◷', 'Shifts'],
    ['⚙', 'Settings'],
  ];
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.menuOverlay}>
        <AppPressable style={s.menuBackdrop} onPress={onClose} />
        <View style={[s.menuSheet, { backgroundColor: c.surface }]}>
          <View style={[s.menuHandle, { backgroundColor: c.outline }]} />
          <View style={s.menuHeader}>
            <Text style={[s.menuTitle, { color: c.text }]}>More</Text>
            <AppPressable onPress={onClose} style={[s.menuClose, { backgroundColor: c.surfaceMuted }]}>
              <Text style={[s.menuCloseText, { color: c.textSecondary }]}>×</Text>
            </AppPressable>
          </View>
          <ScrollView contentContainerStyle={s.menuGrid} showsVerticalScrollIndicator={false}>
            {items.map(([icon, label]) => (
              <AppPressable key={label} style={[s.menuItem, { backgroundColor: c.surfaceMuted }]}>
                <View style={[s.menuIcon, { backgroundColor: c.primarySoft }]}>
                  <Text style={[s.menuIconText, { color: c.primary }]}>{icon}</Text>
                </View>
                <Text style={[s.menuLabel, { color: c.text }]}>{label}</Text>
              </AppPressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    paddingHorizontal: 8,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  items: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, height: 62, alignItems: 'center', justifyContent: 'center', gap: 3 },
  centerSpacer: { flex: 1 },
  iconWrap: { minWidth: 42, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  icon: { color: colors.textSecondary, fontSize: 19, fontWeight: '700' },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  activeText: { color: colors.primary, fontWeight: '900' },
  centerAction: {
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -36,
    width: 72,
    height: 70,
    alignItems: 'center',
    gap: 2,
  },
  centerCircle: {
    width: 75,
    height: 75,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 5,
    borderColor: colors.background,
  },
  centerIcon: { color: colors.primary, fontSize: 23 },
  centerLabel: { color: colors.primary, fontSize: 10, fontWeight: '900', marginTop: -8 },
  badge: {
    position: 'absolute',
    top: 1,
    right: 3,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  menuOverlay: { flex: 1, justifyContent: 'flex-end' },
  menuBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12, 14, 19, 0.32)' },
  menuSheet: {
    minHeight: 330,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  menuHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: colors.outline,
    marginBottom: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  menuTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  menuClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  menuCloseText: { color: colors.textSecondary, fontSize: 22, lineHeight: 24 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  menuItem: {
    width: '30%',
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  menuIconText: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  menuLabel: { color: colors.text, fontSize: 11, fontWeight: '800' },
});
