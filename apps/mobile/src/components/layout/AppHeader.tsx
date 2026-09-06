import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogOut, Menu, Moon, Repeat2, Sun, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { colors } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppPressable } from '../ui/AppPressable';
import { PosLogo } from '../branding/PosLogo';

type Props = { title?: string; subtitle?: string; initials?: string; onMenuToggle?: () => void };

/** Shared POS app header with store identity, user badge, and appearance controls. */
export function AppHeader({
  title = 'Indyz POS',
  subtitle = 'Counter 01',
  initials = 'SK',
  onMenuToggle,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mode, setMode, themeColors } = useAppTheme();
  return (
    <View style={[s.header, { backgroundColor: themeColors.surface, borderColor: themeColors.outline }]}>
      <View style={s.brand}>
        {onMenuToggle && (
          <AppPressable onPress={onMenuToggle} style={s.burger}>
            <Menu size={21} color={themeColors.textSecondary} />
          </AppPressable>
        )}
        <PosLogo size={36} />
        <View>
          <Text style={[s.title, { color: themeColors.text }]}>{title}</Text>
          <Text style={[s.subtitle, { color: themeColors.textSecondary }]}>
            {subtitle} <Text style={[s.online, { color: themeColors.success }]}>●</Text> Open
          </Text>
        </View>
      </View>
      <View style={s.headerActions}>
        <AppPressable
          onPress={() => setMode(mode === 'light' ? 'dark' : 'light')}
          style={[s.themeToggle, { backgroundColor: themeColors.primarySoft }]}
        >
          {mode === 'light' ? (
            <Sun size={14} color={themeColors.primary} />
          ) : (
            <Moon size={14} color={themeColors.primary} />
          )}
          <Text style={[s.toggleText, { color: themeColors.primary }]}>
            {mode === 'light' ? 'Light' : 'Dark'}
          </Text>
        </AppPressable>
        <AppPressable
          accessibilityLabel="Open user menu"
          onPress={() => setMenuOpen((open) => !open)}
          style={[s.avatar, { backgroundColor: themeColors.primarySoft }]}
        >
          <Text style={[s.avatarText, { color: themeColors.primary }]}>{initials}</Text>
        </AppPressable>
      </View>
      {menuOpen && (
        <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <View style={s.menuOverlay}>
            <Pressable style={s.menuBackdrop} onPress={() => setMenuOpen(false)} />
            <View
              style={[
                s.themeMenu,
                { backgroundColor: themeColors.surface, borderColor: themeColors.outline },
              ]}
            >
              <Text style={[s.menuName, { color: themeColors.text }]}>Selva Kumar</Text>
              <Text style={[s.menuRole, { color: themeColors.textSecondary }]}>Store manager</Text>
              <View style={[s.menuDivider, { backgroundColor: themeColors.outline }]} />
              <MenuOption icon={<UserRound size={17} color={themeColors.text} />} label="My profile" />
              <MenuOption icon={<Repeat2 size={17} color={themeColors.text} />} label="Switch business" />
              <View style={[s.menuDivider, { backgroundColor: themeColors.outline }]} />
              <MenuOption
                icon={<LogOut size={17} color={themeColors.error} />}
                label="Sign out"
                destructive
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function MenuOption({
  icon,
  label,
  destructive = false,
}: {
  icon: ReactNode;
  label: string;
  destructive?: boolean;
}) {
  const { themeColors } = useAppTheme();
  const color = destructive ? themeColors.error : themeColors.text;
  return (
    <AppPressable style={s.themeOption}>
      <View style={s.themeIcon}>{icon}</View>
      <Text style={[s.themeText, { color }]}>{label}</Text>
    </AppPressable>
  );
}

const s = StyleSheet.create({
  header: {
    position: 'relative',
    zIndex: 30,
    elevation: 10,
    height: 76,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  burger: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 11, marginTop: 2 },
  online: { fontSize: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeToggle: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  toggleText: { fontSize: 11, fontWeight: '900' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  themeMenu: {
    position: 'absolute',
    zIndex: 40,
    top: 82,
    right: 16,
    width: 210,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 20,
  },
  menuOverlay: { flex: 1 },
  menuBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  menuName: { fontSize: 14, fontWeight: '900', paddingHorizontal: 8, paddingTop: 6 },
  menuRole: { fontSize: 11, paddingHorizontal: 8, paddingTop: 2, paddingBottom: 6 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 6, marginHorizontal: 4 },
  menuTitle: { fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 6 },
  themeOption: {
    height: 38,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
  },
  themeIcon: { width: 18, alignItems: 'center' },
  themeText: { fontSize: 13, fontWeight: '800' },
});
