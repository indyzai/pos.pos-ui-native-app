import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogOut, Menu, Moon, Repeat2, Settings, Sun, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { colors } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppPressable } from '../ui/AppPressable';
import { PosLogo } from '../branding/PosLogo';
import { authApi, type AuthTenant, type AuthUser } from '../../features/auth/authApi';

type Props = { title?: string; subtitle?: string; initials?: string; onMenuToggle?: () => void };

/** Shared POS app header with store identity, user badge, and appearance controls. */
export function AppHeader({ title = 'Indyz POS', subtitle = 'Counter 01', initials, onMenuToggle }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<AuthTenant | null>(null);
  const router = useRouter();
  const { mode, setMode, themeColors } = useAppTheme();
  useEffect(() => {
    void Promise.all([authApi.getStoredUser(), authApi.getSelectedTenant()]).then(([storedUser, tenant]) => {
      setUser(storedUser);
      setSelectedTenant(tenant);
    });
  }, []);

  const userInitials = useMemo(() => {
    if (initials) return initials;
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
    return (name || user?.email || 'User')
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [initials, user]);
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const role = selectedTenant?.role ?? user?.tenants?.[0]?.role ?? user?.role;
  const userRole = role ? `${role[0]?.toUpperCase()}${role.slice(1)}` : 'Team member';

  const handleLogout = async () => {
    setMenuOpen(false);
    await authApi.logout();
    router.replace('/login');
  };
  const handleDebugUser = async () => {
    const storedUser = await authApi.getStoredUser();
    Alert.alert('Debug user', storedUser ? JSON.stringify(storedUser, null, 2) : 'No stored user found.');
  };
  const handleSwitchBusiness = () => {
    const tenants = user?.tenants ?? [];
    if (tenants.length < 2) {
      Alert.alert('Switch business', 'There are no other businesses linked to this account.');
      return;
    }
    Alert.alert('Switch business', 'Choose the business you want to use.', [
      ...tenants.map((tenant) => ({
        text: tenant.name || 'Unnamed business',
        onPress: () => {
          void authApi.selectTenant(tenant.id).then(setSelectedTenant);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
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
          <Text style={[s.avatarText, { color: themeColors.primary }]}>{userInitials}</Text>
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
              <Text style={[s.menuName, { color: themeColors.text }]}>{userName}</Text>
              <Text style={[s.menuRole, { color: themeColors.textSecondary }]}>{userRole}</Text>
              <View style={[s.menuDivider, { backgroundColor: themeColors.outline }]} />
              <MenuOption
                icon={<UserRound size={17} color={themeColors.text} />}
                label="My profile"
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/profile');
                }}
              />
              <MenuOption
                icon={<UserRound size={17} color={themeColors.text} />}
                label="Debug user"
                onPress={() => void handleDebugUser()}
              />
              <MenuOption
                icon={<Repeat2 size={17} color={themeColors.text} />}
                label="Switch business"
                onPress={handleSwitchBusiness}
              />
              <MenuOption
                icon={<Settings size={17} color={themeColors.text} />}
                label="Settings"
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/settings');
                }}
              />
              <View style={[s.menuDivider, { backgroundColor: themeColors.outline }]} />
              <MenuOption
                icon={<LogOut size={17} color={themeColors.error} />}
                label="Sign out"
                destructive
                onPress={() => void handleLogout()}
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
  onPress,
}: {
  icon: ReactNode;
  label: string;
  destructive?: boolean;
  onPress?: () => void;
}) {
  const { themeColors } = useAppTheme();
  const color = destructive ? themeColors.error : themeColors.text;
  return (
    <AppPressable style={s.themeOption} onPress={onPress}>
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
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.14)',
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
