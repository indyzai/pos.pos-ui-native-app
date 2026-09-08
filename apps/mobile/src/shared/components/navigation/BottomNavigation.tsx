import { useState } from 'react';
import { Menu, X, type LucideIcon } from 'lucide-react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../config/theme';
import { useBottomNavigation } from '../../providers/BottomNavigationProvider';
import { useAppTheme } from '../../providers/ThemeProvider';
import { AppPressable } from '../ui/AppPressable';
import {
  isNavigationItemActive,
  moreNavigationItems,
  primaryNavigationItems,
  reportNavigationItem,
} from '../../navigation/routes';

/** Global Material navigation shell. Modules populate its raised center action. */
export function BottomNavigation() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { centerItem } = useBottomNavigation();
  const { themeColors: c } = useAppTheme();
  const pathname = usePathname();
  const router = useRouter();
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
        {primaryNavigationItems.map((item) => (
          <NavigationItem
            key={item.label}
            {...item}
            active={isNavigationItemActive(pathname, item.href)}
            onPress={() => router.replace(item.href)}
          />
        ))}
        <View style={s.centerSpacer} />
        <NavigationItem
          {...reportNavigationItem}
          active={isNavigationItemActive(pathname, reportNavigationItem.href)}
          onPress={() => router.replace(reportNavigationItem.href)}
        />
        <NavigationItem
          label="More"
          icon={Menu}
          active={moreOpen || moreNavigationItems.some((item) => isNavigationItemActive(pathname, item.href))}
          onPress={() => setMoreOpen(true)}
        />
      </View>
      {centerItem && (
        <AppPressable
          accessibilityLabel={centerItem.label}
          onPress={centerItem.onPress}
          style={s.centerAction}
        >
          <View style={[s.centerCircle, { backgroundColor: c.primarySoft, borderColor: c.background }]}>
            <centerItem.icon size={27} color={c.primary} strokeWidth={2} />
            <Text style={[s.centerLabel, { color: c.primary }]}>{centerItem.label}</Text>
            {(centerItem.badge ?? 0) > 0 && (
              <View style={[s.badge, { backgroundColor: c.error, borderColor: c.surface }]}>
                <Text style={s.badgeText}>{centerItem.badge}</Text>
              </View>
            )}
          </View>
        </AppPressable>
      )}
      <MoreMenu visible={moreOpen} onClose={() => setMoreOpen(false)} bottomOffset={66 + insets.bottom} />
    </View>
  );
}

function NavigationItem({
  label,
  icon: Icon,
  active = false,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  href?: Href;
  active?: boolean;
  onPress?: () => void;
}) {
  const { themeColors: c } = useAppTheme();
  return (
    <AppPressable accessibilityLabel={label} onPress={onPress} style={s.item}>
      <View style={[s.iconWrap, active && { backgroundColor: c.primarySoft }]}>
        <Icon size={21} color={active ? c.primary : c.textSecondary} strokeWidth={active ? 2.4 : 2} />
        <Text style={[s.label, { color: active ? c.primary : c.textSecondary }]}>{label}</Text>
      </View>
    </AppPressable>
  );
}

function MoreMenu({
  visible,
  onClose,
  bottomOffset,
}: {
  visible: boolean;
  onClose: () => void;
  bottomOffset: number;
}) {
  const router = useRouter();
  const { themeColors: c } = useAppTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.menuOverlay}>
        <AppPressable style={s.menuBackdrop} onPress={onClose} />
        <View style={[s.menuSheet, { backgroundColor: c.surface, marginBottom: bottomOffset }]}>
          <View style={[s.menuHandle, { backgroundColor: c.outline }]} />
          <View style={s.menuHeader}>
            <Text style={[s.menuTitle, { color: c.text }]}>More</Text>
            <AppPressable
              accessibilityLabel="Close more menu"
              onPress={onClose}
              style={[s.menuClose, { backgroundColor: c.surfaceMuted }]}
            >
              <X size={20} color={c.textSecondary} />
            </AppPressable>
          </View>
          <ScrollView contentContainerStyle={s.menuGrid} showsVerticalScrollIndicator={false}>
            {moreNavigationItems.map(({ icon: Icon, label, href }) => (
              <AppPressable
                key={label}
                onPress={() => {
                  onClose();
                  router.replace(href);
                }}
                style={[s.menuItem, { backgroundColor: c.surfaceMuted }]}
              >
                <View style={[s.menuIcon, { backgroundColor: c.primarySoft }]}>
                  <Icon size={20} color={c.primary} strokeWidth={2} />
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
    boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.06)',
  },
  items: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, height: 62, alignItems: 'center', justifyContent: 'center', gap: 3 },
  centerSpacer: { flex: 1 },
  iconWrap: {
    minWidth: 56,
    height: 50,
    paddingHorizontal: 8,
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconWrapActive: { backgroundColor: colors.primarySoft },
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
  centerLabel: { color: colors.primary, fontSize: 10, fontWeight: '900', marginTop: 3 },
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
  menuLabel: { color: colors.text, fontSize: 11, fontWeight: '800' },
});
