import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Repeat2,
  Settings,
  Store,
  Sun,
  UserRound,
  UnlockKeyhole,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native';
import { AppPressable } from '../AppPressable';
import { AdminLogo, PosLogo } from '../branding/PosLogo';
import { useAppTheme } from '../theme/ThemeProvider';

export type AppHeaderStorageState = {
  status: 'initializing' | 'ready' | 'error';
  error?: string | null;
  retry: () => void | Promise<void>;
};

export type AppHeaderRefreshJob = {
  id: string;
  text: string;
  cancel: () => void | Promise<void>;
};

export type SharedAppHeaderProps = {
  variant?: 'pos' | 'admin';
  title?: string;
  businessName?: string | null;
  branchName: string;
  counterName: string;
  isCounterOpen: boolean;
  userInitials: string;
  userName: string;
  userRole: string;
  isOnline: boolean;
  pendingQueueCount: number;
  storage: AppHeaderStorageState;
  refreshJob?: AppHeaderRefreshJob | null;
  onCounterPress: () => void;
  onProfile: () => void;
  onDebugUser: () => void;
  onSwitchBusiness: () => void;
  onSettings: () => void;
  onLogout: () => void | Promise<void>;
  onMenuToggle?: () => void;
  navigationCollapsed?: boolean;
  children?: ReactNode;
};

/** Shared responsive header used by both POS applications. */
export function AppHeader({
  variant = 'pos',
  title = 'IndyzAI POS',
  businessName,
  branchName,
  counterName,
  isCounterOpen,
  userInitials,
  userName,
  userRole,
  isOnline,
  pendingQueueCount,
  storage,
  refreshJob,
  onCounterPress,
  onProfile,
  onDebugUser,
  onSwitchBusiness,
  onSettings,
  onLogout,
  onMenuToggle,
  navigationCollapsed = false,
  children,
}: SharedAppHeaderProps) {
  const { width } = useWindowDimensions();
  const isPhone = width < 600;
  const showActionLabels = width >= 768;
  const [menuOpen, setMenuOpen] = useState(false);
  const { isDark, mode, setMode, themeColors } = useAppTheme();
  const Logo = variant === 'admin' ? AdminLogo : PosLogo;
  const counterColors = isCounterOpen
    ? { bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5', border: isDark ? '#059669' : '#10B981', text: isDark ? '#34D399' : '#047857' }
    : { bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2', border: isDark ? '#DC2626' : '#EF4444', text: isDark ? '#F87171' : '#B91C1C' };
  const storageColors = refreshJob
    ? { bg: themeColors.surfaceMuted, border: themeColors.primary, text: themeColors.primary }
    : storage.status === 'error'
      ? { bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2', border: themeColors.error, text: themeColors.error }
      : !isOnline
        ? { bg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB', border: isDark ? '#D97706' : '#F59E0B', text: isDark ? '#FBBF24' : '#B45309' }
        : { bg: isDark ? 'rgba(139, 92, 246, 0.16)' : '#F5F3FF', border: isDark ? '#8B5CF6' : '#7C3AED', text: isDark ? '#C4B5FD' : '#6D28D9' };

  const closeThen = (action: () => void | Promise<void>) => () => {
    setMenuOpen(false);
    void action();
  };

  return (
    <View style={[s.header, isPhone && s.phoneHeader, { backgroundColor: themeColors.surface, borderColor: themeColors.outline, boxShadow: isDark ? '0px 3px 10px rgba(0, 0, 0, 0.24)' : 'none' }]}>
      <View style={s.brand}>
        {onMenuToggle && (
          <AppPressable accessibilityLabel={navigationCollapsed ? 'Expand navigation' : 'Collapse navigation'} onPress={onMenuToggle} style={[s.burger, isPhone && s.phoneControl]}>
            <Menu size={isPhone ? 19 : 21} color={themeColors.textSecondary} />
            <View style={[s.navigationState, { backgroundColor: themeColors.primary }]}>
              {navigationCollapsed ? <ChevronRight size={9} color="#fff" strokeWidth={3} /> : <ChevronLeft size={9} color="#fff" strokeWidth={3} />}
            </View>
          </AppPressable>
        )}
        <View style={[s.logoFrame, isPhone && s.phoneLogoFrame]}><Logo size={isPhone ? 28 : 34} /></View>
        <View style={[s.brandCopy, isPhone ? s.phoneBrandCopy : s.desktopBrandCopy]}>
          {isPhone ? (
            <Text numberOfLines={1} style={[s.title, s.phoneTitle, { color: themeColors.text }]}>{businessName || title}</Text>
          ) : (
            <View style={s.titleRow}>
              <Text numberOfLines={1} style={[s.title, { color: themeColors.text }]}>{title}</Text>
              {Boolean(businessName) && (
                <View style={[s.businessTag, { backgroundColor: themeColors.primarySoft, borderColor: `${themeColors.primary}28` }]}>
                  <Building2 size={10} color={themeColors.primary} strokeWidth={2.4} />
                  <Text numberOfLines={1} style={[s.businessTagText, { color: themeColors.primary }]}>{businessName}</Text>
                </View>
              )}
            </View>
          )}
          <View style={s.branchRow}>
            <Store size={isPhone ? 11 : 12} color={themeColors.textSecondary} strokeWidth={2.2} />
            <Text numberOfLines={1} style={[s.branchText, isPhone && s.phoneBranchText, { color: themeColors.textSecondary }]}>{branchName}</Text>
            {!isPhone && <Text style={[s.dotSeparator, { color: themeColors.outline }]}>·</Text>}
            <AppPressable accessibilityLabel={isCounterOpen ? `View ${counterName} session` : `Open ${counterName} session`} onPress={onCounterPress} style={[s.counterStatus, isPhone && s.phoneCounterStatus, { backgroundColor: counterColors.bg, borderColor: counterColors.border }]}>
              {isCounterOpen ? <UnlockKeyhole size={isPhone ? 10 : 12} color={counterColors.text} strokeWidth={2.5} /> : <LockKeyhole size={isPhone ? 10 : 12} color={counterColors.text} strokeWidth={2.5} />}
              <Text numberOfLines={1} style={[s.counterStatusText, { color: counterColors.text }]}>{isPhone ? (isCounterOpen ? 'Open' : 'Closed') : `${counterName} · ${isCounterOpen ? 'Open' : 'Closed'}`}</Text>
            </AppPressable>
          </View>
        </View>
      </View>
      <View style={s.headerActions}>
        <AppPressable
          accessibilityLabel={refreshJob ? `Cancel ${refreshJob.text}, job ${refreshJob.id}` : storage.status === 'error' ? storage.error || 'Retry local storage' : `${isOnline ? 'Online' : 'Offline'}; local storage ${storage.status}; ${pendingQueueCount} mutations pending`}
          disabled={!refreshJob && storage.status !== 'error'}
          onPress={() => void (refreshJob ? refreshJob.cancel() : storage.retry())}
          style={[s.themeToggle, !showActionLabels && s.iconAction, { backgroundColor: storageColors.bg, borderWidth: 1, borderColor: storageColors.border }]}
        >
          {refreshJob ? (isPhone ? <View style={s.cancelProgress}><ActivityIndicator size={28} color={themeColors.primary} /><X size={12} color={themeColors.primary} strokeWidth={3} style={s.cancelProgressIcon} /></View> : <ActivityIndicator size="small" color={themeColors.primary} />) : storage.status === 'error' ? <RefreshCw size={14} color={storageColors.text} /> : isOnline ? <Wifi size={14} color={storageColors.text} /> : <WifiOff size={14} color={storageColors.text} />}
          {!refreshJob && pendingQueueCount > 0 && <View style={[s.queueBadge, { backgroundColor: storageColors.border }]}><Text style={s.queueBadgeText}>{pendingQueueCount > 99 ? '99+' : pendingQueueCount}</Text></View>}
          {showActionLabels && <Text style={[s.toggleText, { color: storageColors.text }]}>{refreshJob ? `${refreshJob.text} · ${refreshJob.id.slice(-6).toUpperCase()}` : storage.status === 'ready' ? `${isOnline ? 'Online' : 'Offline'} · Storage ready` : storage.status === 'error' ? '↻ Storage' : '◌ Preparing'}</Text>}
          {refreshJob && !isPhone && <X size={13} color={themeColors.textSecondary} />}
        </AppPressable>
        <AppPressable onPress={() => setMode(mode === 'light' ? 'dark' : 'light')} style={[s.themeToggle, !showActionLabels && s.iconAction, { backgroundColor: themeColors.primarySoft }]}>
          {mode === 'light' ? <Sun size={14} color={themeColors.primary} /> : <Moon size={14} color={themeColors.primary} />}
          {showActionLabels && <Text style={[s.toggleText, { color: themeColors.primary }]}>{mode === 'light' ? 'Light' : 'Dark'}</Text>}
        </AppPressable>
        <AppPressable accessibilityLabel="Open user menu" onPress={() => setMenuOpen(true)} style={[s.avatar, isPhone && s.phoneControl, { backgroundColor: themeColors.primarySoft }]}>
          <Text style={[s.avatarText, { color: themeColors.primary }]}>{userInitials}</Text>
        </AppPressable>
      </View>
      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={s.menuOverlay}>
          <Pressable style={s.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={[s.themeMenu, { backgroundColor: themeColors.surface, borderColor: themeColors.outline }]}>
            <Text style={[s.menuName, { color: themeColors.text }]}>{userName}</Text>
            <Text style={[s.menuRole, { color: themeColors.textSecondary }]}>{userRole}</Text>
            <View style={[s.menuDivider, { backgroundColor: themeColors.outline }]} />
            <MenuOption icon={<UserRound size={17} color={themeColors.text} />} label="My profile" onPress={closeThen(onProfile)} />
            <MenuOption icon={<UserRound size={17} color={themeColors.text} />} label="Debug user" onPress={closeThen(onDebugUser)} />
            <MenuOption icon={<Repeat2 size={17} color={themeColors.text} />} label="Switch business" onPress={closeThen(onSwitchBusiness)} />
            <MenuOption icon={<Settings size={17} color={themeColors.text} />} label="Settings" onPress={closeThen(onSettings)} />
            <View style={[s.menuDivider, { backgroundColor: themeColors.outline }]} />
            <MenuOption icon={<LogOut size={17} color={themeColors.error} />} label="Sign out" destructive onPress={closeThen(onLogout)} />
          </View>
        </View>
      </Modal>
      {children}
    </View>
  );
}

function MenuOption({ icon, label, destructive, onPress }: { icon: ReactNode; label: string; destructive?: boolean; onPress: () => void }) {
  const { themeColors } = useAppTheme();
  return <AppPressable style={s.themeOption} onPress={onPress}><View style={s.themeIcon}>{icon}</View><Text style={[s.themeText, { color: destructive ? themeColors.error : themeColors.text }]}>{label}</Text></AppPressable>;
}

const s = StyleSheet.create({
  header: { position: 'relative', zIndex: 30, elevation: 10, height: 72, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  phoneHeader: { height: 64, paddingHorizontal: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, marginRight: 8 },
  logoFrame: { width: 36, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'flex-start' },
  phoneLogoFrame: { width: 30, height: 34 }, brandCopy: { minWidth: 0, flex: 1, justifyContent: 'center' }, phoneBrandCopy: { maxWidth: '100%' }, desktopBrandCopy: { maxWidth: 440 },
  burger: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navigationState: { position: 'absolute', right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }, title: { fontSize: 15, lineHeight: 19, fontWeight: '800' }, phoneTitle: { fontSize: 14, lineHeight: 17, fontWeight: '800' },
  businessTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, flexShrink: 1, minWidth: 0 }, businessTagText: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  branchRow: { minWidth: 0, minHeight: 20, marginTop: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }, branchText: { fontSize: 11, fontWeight: '500', flexShrink: 1, maxWidth: 160 }, phoneBranchText: { maxWidth: 100 }, dotSeparator: { fontSize: 10, marginHorizontal: 1 },
  counterStatus: { height: 20, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 3.5, flexShrink: 0 }, phoneCounterStatus: { paddingHorizontal: 5, gap: 3 }, counterStatusText: { fontSize: 10, fontWeight: '800' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  themeToggle: { height: 34, paddingHorizontal: 10, borderRadius: 17, alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center' }, iconAction: { width: 32, paddingHorizontal: 0 }, phoneControl: { width: 32, height: 32, borderRadius: 16 }, toggleText: { fontSize: 11, fontWeight: '900' },
  queueBadge: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }, queueBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' }, cancelProgress: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }, cancelProgressIcon: { position: 'absolute' }, avatarText: { fontSize: 12, fontWeight: '800' },
  themeMenu: { position: 'absolute', zIndex: 40, top: 72, right: 16, width: 210, padding: 8, borderRadius: 16, borderWidth: 1, boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.14)', elevation: 20 }, menuOverlay: { flex: 1 }, menuBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' }, menuName: { fontSize: 14, fontWeight: '900', paddingHorizontal: 8, paddingTop: 6 }, menuRole: { fontSize: 11, paddingHorizontal: 8, paddingTop: 2, paddingBottom: 6 }, menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 6, marginHorizontal: 4 },
  themeOption: { height: 38, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10 }, themeIcon: { width: 18, alignItems: 'center' }, themeText: { fontSize: 13, fontWeight: '800' },
});
