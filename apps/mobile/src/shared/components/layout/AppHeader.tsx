import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { AppHeader as SharedHeader, showSnackbar, useAppHeader, useNetworkStatus } from '@indyzai/pos-ui';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { useOfflineQueueCount } from '@indyzai/pos-database';
import { authApi } from '../../../auth/authApi';
import { useAuthSession } from '../../../auth/AuthSessionContext';
import { OpenCounterSessionDialog } from '../../../features/counter-session/components/OpenCounterSessionDialog';
import { CounterSessionSummaryDialog } from '../../../features/counter-session/components/CounterSessionSummaryDialog';

type Props = { title?: string; subtitle?: string; initials?: string; onMenuToggle?: () => void; navigationCollapsed?: boolean };

export function AppHeader({ title = 'IndyzAI POS', initials, onMenuToggle, navigationCollapsed = false }: Props) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const local = useLocalDatabase();
  const pendingQueueCount = useOfflineQueueCount();
  const isOnline = useNetworkStatus(authApi, { pendingSyncCount: pendingQueueCount });
  const { counterDialogRequest, featureRefresh, refreshJob } = useAppHeader();
  const router = useRouter();
  const { session, user, refreshSession } = useAuthSession();
  const tenant = session?.tenant ?? null;
  const organization = session?.organization;
  const activeSession = organization?.activeSession;
  const fallbackBranch = organization?.branches.find((branch) => branch.counters.length) ?? organization?.branches[0];
  const fallbackCounter = fallbackBranch?.counters[0];
  const activeBranch = organization?.branches.find((branch) => branch.id === activeSession?.branchId || branch.counters.some((counter) => counter.id === activeSession?.counterId));
  const activeCounter = activeBranch?.counters.find((counter) => counter.id === activeSession?.counterId);
  const branchName = activeSession?.branchName || activeBranch?.name || fallbackBranch?.name || 'No branch';
  const counterName = activeSession?.counterName || activeCounter?.name || fallbackCounter?.name || 'No counter';
  const isCounterOpen = activeSession?.status?.toUpperCase() === 'OPEN';
  useEffect(() => { if (counterDialogRequest && !isCounterOpen) setCounterOpen(true); }, [counterDialogRequest, isCounterOpen]);
  const userInitials = useMemo(() => {
    if (initials) return initials;
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
    return (name || user?.email || 'User').split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  }, [initials, user]);
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const role = tenant?.role ?? user?.tenants?.[0]?.role ?? user?.role;
  const switchBusiness = () => {
    const tenants = user?.tenants ?? [];
    if (tenants.length < 2) return showSnackbar('Switch business', 'There are no other businesses linked to this account.');
    showSnackbar('Switch business', 'Choose the business you want to use.', [...tenants.map((item) => ({ text: item.name || 'Unnamed business', onPress: () => void authApi.selectTenant(item.id).then(refreshSession) })), { text: 'Cancel', style: 'cancel' }]);
  };
  return <SharedHeader variant="pos" title={title} businessName={organization?.name || tenant?.name} branchName={branchName} counterName={counterName}
    isCounterOpen={isCounterOpen} userInitials={userInitials} userName={userName} userRole={role ? `${role[0]?.toUpperCase()}${role.slice(1)}` : 'Team member'}
    isOnline={isOnline} pendingQueueCount={pendingQueueCount} storage={local} refreshJob={refreshJob}
    onCounterPress={() => isCounterOpen ? setSummaryOpen(true) : setCounterOpen(true)} onProfile={() => router.push('/profile')}
    onDebugUser={() => showSnackbar('Debug user', session?.user ? JSON.stringify(session.user, null, 2) : 'No stored user found.')}
    onSwitchBusiness={switchBusiness} onSettings={() => router.push('/settings')} onLogout={async () => { await authApi.logout(); await refreshSession(); router.replace('/login'); }}
    onMenuToggle={onMenuToggle} navigationCollapsed={navigationCollapsed}>
    <OpenCounterSessionDialog visible={counterOpen} token={session?.token} tenantId={session ? String(session.tenant.id) : undefined} branchName={fallbackBranch?.name} counterId={fallbackCounter?.id} counterName={fallbackCounter?.name} currencyCode={String(organization?.settings.currency ?? 'INR').toUpperCase()} onClose={() => setCounterOpen(false)} onOpened={async () => { await refreshSession(); await featureRefresh?.(); }} />
    <CounterSessionSummaryDialog visible={summaryOpen} token={session?.token} tenantId={session ? String(session.tenant.id) : undefined} session={activeSession} currencyCode={String(organization?.settings.currency ?? 'INR').toUpperCase()} onClose={() => setSummaryOpen(false)} onClosed={async () => { await refreshSession(); await featureRefresh?.(); }} />
  </SharedHeader>;
}
