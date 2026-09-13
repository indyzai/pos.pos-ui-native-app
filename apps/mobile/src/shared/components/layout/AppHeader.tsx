import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
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
import type { ReactNode } from 'react';
import { colors } from '@indyzai/pos-ui/tokens';
import { useAppTheme } from '@indyzai/pos-ui';
import { AppPressable } from '@indyzai/pos-ui';
import { PosLogo } from '@indyzai/pos-ui';
import { authApi } from '../../../auth/authApi';
import { useAuthSession } from '../../../auth/AuthSessionContext';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { useOfflineQueueCount } from '@indyzai/pos-database';
import { useAppHeader, useNetworkStatus } from '@indyzai/pos-ui';
import { OpenCounterSessionDialog } from '../../../features/counter-session/components/OpenCounterSessionDialog';
import { CounterSessionSummaryDialog } from '../../../features/counter-session/components/CounterSessionSummaryDialog';

type Props = {
  title?: string;
  subtitle?: string;
  initials?: string;
  onMenuToggle?: () => void;
  navigationCollapsed?: boolean;
};

/** Shared POS app header with store identity, user badge, and appearance controls. */
export function AppHeader({
  title = 'IndyzAI POS',
  subtitle = 'Counter 01',
  initials,
  onMenuToggle,
  navigationCollapsed = false,
}: Props) {
  const { width } = useWindowDimensions();
  const isPhone = width < 600;
  const showActionLabels = width >= 768;
  const [menuOpen, setMenuOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [sessionSummaryOpen, setSessionSummaryOpen] = useState(false);
  const local = useLocalDatabase();
  const pendingQueueCount = useOfflineQueueCount();
  const isOnline = useNetworkStatus(authApi);
  const { counterDialogRequest, featureRefresh, refreshJob } = useAppHeader();
  const router = useRouter();
  const { isDark, mode, setMode, themeColors } = useAppTheme();
  const { session, user, refreshSession } = useAuthSession();
  const selectedTenant = session?.tenant ?? null;
  const organization = session?.organization;
  const businessName = organization?.name || selectedTenant?.name;
  const activeCounterSession = organization?.activeSession;
  const fallbackBranch =
    organization?.branches.find((branch) => branch.counters.length) ?? organization?.branches[0];
  const fallbackCounter = fallbackBranch?.counters[0];
  const activeBranch = organization?.branches.find(
    (branch) =>
      branch.id === activeCounterSession?.branchId ||
      branch.counters.some((counter) => counter.id === activeCounterSession?.counterId),
  );
  const activeCounter = activeBranch?.counters.find(
    (counter) => counter.id === activeCounterSession?.counterId,
  );
  const branchName =
    activeCounterSession?.branchName || activeBranch?.name || fallbackBranch?.name || 'No branch';
  const counterName =
    activeCounterSession?.counterName || activeCounter?.name || fallbackCounter?.name || 'No counter';
  const isCounterOpen = activeCounterSession?.status?.toUpperCase() === 'OPEN';
  useEffect(() => {
    if (counterDialogRequest && !isCounterOpen) setCounterOpen(true);
  }, [counterDialogRequest, isCounterOpen]);

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

  const counterColors = isCounterOpen
    ? {
        bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
        border: isDark ? '#059669' : '#10B981',
        text: isDark ? '#34D399' : '#047857',
      }
    : {
        bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
        border: isDark ? '#DC2626' : '#EF4444',
        text: isDark ? '#F87171' : '#B91C1C',
      };

  const storageColors = refreshJob
    ? {
        bg: themeColors.surfaceMuted,
        border: themeColors.primary,
        text: themeColors.primary,
      }
    : local.status === 'error'
      ? {
          bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
          border: themeColors.error,
          text: themeColors.error,
        }
      : !isOnline
        ? {
            bg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB',
            border: isDark ? '#D97706' : '#F59E0B',
            text: isDark ? '#FBBF24' : '#B45309',
          }
        : {
            bg: isDark ? 'rgba(14, 165, 233, 0.14)' : '#F0F9FF',
            border: isDark ? '#0284C7' : '#0EA5E9',
            text: isDark ? '#38BDF8' : '#0284C7',
          };

  const handleLogout = async () => {
    setMenuOpen(false);
    await authApi.logout();
    await refreshSession();
    router.replace('/login');
  };
  const handleDebugUser = async () => {
    const storedUser = session?.user;
    showSnackbar('Debug user', storedUser ? JSON.stringify(storedUser, null, 2) : 'No stored user found.');
  };
  const handleSwitchBusiness = () => {
    const tenants = user?.tenants ?? [];
    if (tenants.length < 2) {
      showSnackbar('Switch business', 'There are no other businesses linked to this account.');
      return;
    }
    showSnackbar('Switch business', 'Choose the business you want to use.', [
      ...tenants.map((tenant) => ({
        text: tenant.name || 'Unnamed business',
        onPress: () => {
          void authApi.selectTenant(tenant.id).then(() => refreshSession());
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  return (
    <View
      style={[
        s.header,
        isPhone && s.phoneHeader,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.outline,
          boxShadow: isDark ? '0px 3px 10px rgba(0, 0, 0, 0.24)' : 'none',
        },
      ]}
    >
      <View style={s.brand}>
        {onMenuToggle && (
          <AppPressable
            accessibilityLabel={navigationCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            onPress={onMenuToggle}
            style={[s.burger, isPhone && s.phoneControl]}
          >
            <Menu size={isPhone ? 19 : 21} color={themeColors.textSecondary} />
            <View style={[s.navigationState, { backgroundColor: themeColors.primary }]}>
              {navigationCollapsed ? (
                <ChevronRight size={9} color="#fff" strokeWidth={3} />
              ) : (
                <ChevronLeft size={9} color="#fff" strokeWidth={3} />
              )}
            </View>
          </AppPressable>
        )}
        <PosLogo size={isPhone ? 28 : 34} />
        <View style={[s.brandCopy, isPhone ? s.phoneBrandCopy : s.desktopBrandCopy]}>
          {isPhone ? (
            <Text numberOfLines={1} style={[s.title, s.phoneTitle, { color: themeColors.text }]}>
              {businessName || title}
            </Text>
          ) : (
            <View style={s.titleRow}>
              <Text numberOfLines={1} style={[s.title, { color: themeColors.text }]}>
                {title}
              </Text>
              {Boolean(businessName) && (
                <View
                  style={[
                    s.businessTag,
                    {
                      backgroundColor: themeColors.primarySoft,
                      borderColor: themeColors.primary + '28',
                    },
                  ]}
                >
                  <Building2 size={10} color={themeColors.primary} strokeWidth={2.4} />
                  <Text numberOfLines={1} style={[s.businessTagText, { color: themeColors.primary }]}>
                    {businessName}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View style={s.branchRow}>
            <Store size={isPhone ? 11 : 12} color={themeColors.textSecondary} strokeWidth={2.2} />
            <Text
              numberOfLines={1}
              style={[s.branchText, isPhone && s.phoneBranchText, { color: themeColors.textSecondary }]}
            >
              {branchName}
            </Text>
            {!isPhone && <Text style={[s.dotSeparator, { color: themeColors.outline }]}>·</Text>}
            <AppPressable
              accessibilityLabel={
                isCounterOpen ? `View ${counterName} session` : `Open ${counterName} session`
              }
              onPress={() => (isCounterOpen ? setSessionSummaryOpen(true) : setCounterOpen(true))}
              style={[
                s.counterStatus,
                isPhone && s.phoneCounterStatus,
                {
                  backgroundColor: counterColors.bg,
                  borderColor: counterColors.border,
                },
              ]}
            >
              {isCounterOpen ? (
                <UnlockKeyhole size={isPhone ? 10 : 12} color={counterColors.text} strokeWidth={2.5} />
              ) : (
                <LockKeyhole size={isPhone ? 10 : 12} color={counterColors.text} strokeWidth={2.5} />
              )}
              <Text numberOfLines={1} style={[s.counterStatusText, { color: counterColors.text }]}>
                {isPhone
                  ? isCounterOpen
                    ? 'Open'
                    : 'Closed'
                  : `${counterName} · ${isCounterOpen ? 'Open' : 'Closed'}`}
              </Text>
            </AppPressable>
          </View>
        </View>
      </View>
      <View style={s.headerActions}>
        <AppPressable
          accessibilityLabel={
            refreshJob
              ? `Cancel ${refreshJob.text}, job ${refreshJob.id}`
              : local.status === 'error'
                ? local.error || 'Retry local storage'
                : `${isOnline ? 'Online' : 'Offline'}; local storage ${local.status}; ${pendingQueueCount} mutations pending`
          }
          disabled={!refreshJob && local.status !== 'error'}
          onPress={() => void (refreshJob ? refreshJob.cancel() : local.retry())}
          style={[
            s.themeToggle,
            !showActionLabels && s.iconAction,
            {
              backgroundColor: storageColors.bg,
              borderWidth: 1,
              borderColor: storageColors.border,
            },
          ]}
        >
          {refreshJob ? (
            isPhone ? (
              <View style={s.cancelProgress}>
                <ActivityIndicator size={28} color={themeColors.primary} />
                <X size={12} color={themeColors.primary} strokeWidth={3} style={s.cancelProgressIcon} />
              </View>
            ) : (
              <ActivityIndicator size="small" color={themeColors.primary} />
            )
          ) : local.status === 'error' ? (
            <RefreshCw size={14} color={storageColors.text} />
          ) : isOnline ? (
            <Wifi size={14} color={storageColors.text} />
          ) : (
            <WifiOff size={14} color={storageColors.text} />
          )}
          {!refreshJob && pendingQueueCount > 0 && (
            <View style={[s.queueBadge, { backgroundColor: storageColors.border }]}>
              <Text style={s.queueBadgeText}>{pendingQueueCount > 99 ? '99+' : pendingQueueCount}</Text>
            </View>
          )}
          {showActionLabels && (
            <Text style={[s.toggleText, { color: storageColors.text }]}>
              {refreshJob
                ? `${refreshJob.text} · ${refreshJob.id.slice(-6).toUpperCase()}`
                : local.status === 'ready'
                  ? `${isOnline ? 'Online' : 'Offline'} · Storage ready`
                  : local.status === 'error'
                    ? '↻ Storage'
                    : '◌ Preparing'}
            </Text>
          )}
          {refreshJob && !isPhone && <X size={13} color={themeColors.textSecondary} />}
        </AppPressable>
        <AppPressable
          onPress={() => setMode(mode === 'light' ? 'dark' : 'light')}
          style={[
            s.themeToggle,
            !showActionLabels && s.iconAction,
            { backgroundColor: themeColors.primarySoft },
          ]}
        >
          {mode === 'light' ? (
            <Sun size={14} color={themeColors.primary} />
          ) : (
            <Moon size={14} color={themeColors.primary} />
          )}
          {showActionLabels && (
            <Text style={[s.toggleText, { color: themeColors.primary }]}>
              {mode === 'light' ? 'Light' : 'Dark'}
            </Text>
          )}
        </AppPressable>
        <AppPressable
          accessibilityLabel="Open user menu"
          onPress={() => setMenuOpen((open) => !open)}
          style={[s.avatar, isPhone && s.phoneControl, { backgroundColor: themeColors.primarySoft }]}
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
      <OpenCounterSessionDialog
        visible={counterOpen}
        token={session?.token}
        tenantId={session ? String(session.tenant.id) : undefined}
        branchName={fallbackBranch?.name}
        counterId={fallbackCounter?.id}
        counterName={fallbackCounter?.name}
        currencyCode={String(organization?.settings.currency ?? 'INR').toUpperCase()}
        onClose={() => setCounterOpen(false)}
        onOpened={async () => {
          await refreshSession();
          await featureRefresh?.();
        }}
      />
      <CounterSessionSummaryDialog
        visible={sessionSummaryOpen}
        token={session?.token}
        tenantId={session ? String(session.tenant.id) : undefined}
        session={activeCounterSession}
        currencyCode={String(organization?.settings.currency ?? 'INR').toUpperCase()}
        onClose={() => setSessionSummaryOpen(false)}
        onClosed={async () => {
          await refreshSession();
          await featureRefresh?.();
        }}
      />
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
    height: 72,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  phoneHeader: { height: 64, paddingHorizontal: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  brandCopy: { minWidth: 0, flexShrink: 1 },
  phoneBrandCopy: { maxWidth: 240 },
  desktopBrandCopy: { maxWidth: 440 },
  burger: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navigationState: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  title: { fontSize: 15, fontWeight: '800' },
  phoneTitle: { fontSize: 14, fontWeight: '800' },
  businessTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  businessTagText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  branchRow: {
    minWidth: 0,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  branchText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
    maxWidth: 160,
  },
  phoneBranchText: {
    maxWidth: 100,
  },
  dotSeparator: {
    fontSize: 10,
    marginHorizontal: 1,
  },
  counterStatus: {
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    flexShrink: 0,
  },
  phoneCounterStatus: {
    paddingHorizontal: 5,
    gap: 3,
  },
  counterStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  themeToggle: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  iconAction: { width: 32, paddingHorizontal: 0 },
  phoneControl: { width: 32, height: 32, borderRadius: 16 },
  toggleText: { fontSize: 11, fontWeight: '900' },
  queueBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  cancelProgress: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cancelProgressIcon: { position: 'absolute' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  themeMenu: {
    position: 'absolute',
    zIndex: 40,
    top: 72,
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
