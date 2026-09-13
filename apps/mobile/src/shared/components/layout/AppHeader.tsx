import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  AppHeader as SharedHeader,
  BusinessContextDialog,
  showSnackbar,
  useAppHeader,
  useNetworkStatus,
} from '@indyzai/pos-ui';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { useOfflineQueueCount } from '@indyzai/pos-database';
import { authApi } from '../../../auth/authApi';
import { useAuthSession } from '../../../auth/AuthSessionContext';
import { OpenCounterSessionDialog } from '../../../features/counter-session/components/OpenCounterSessionDialog';
import { CounterSessionSummaryDialog } from '../../../features/counter-session/components/CounterSessionSummaryDialog';

type Props = {
  title?: string;
  subtitle?: string;
  initials?: string;
  onMenuToggle?: () => void;
  navigationCollapsed?: boolean;
};

export function AppHeader({
  title = 'IndyzAI POS',
  initials,
  onMenuToggle,
  navigationCollapsed = false,
}: Props) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [switchingBusiness, setSwitchingBusiness] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<{ id: string; name: string } | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<{ id: string; name: string } | null>(null);
  const local = useLocalDatabase();
  const pendingQueueCount = useOfflineQueueCount();
  const isOnline = useNetworkStatus(authApi, { pendingSyncCount: pendingQueueCount });
  const { counterDialogRequest, featureRefresh, refreshJob } = useAppHeader();
  const router = useRouter();
  const { session, user, refreshSession } = useAuthSession();
  const tenant = session?.tenant ?? null;
  const organization = session?.organization;
  const activeSession = organization?.activeSession;
  const fallbackBranch =
    organization?.branches.find((branch) => branch.counters.length) ?? organization?.branches[0];
  const fallbackCounter = fallbackBranch?.counters[0];
  const activeBranch = organization?.branches.find(
    (branch) =>
      branch.id === activeSession?.branchId ||
      branch.counters.some((counter) => counter.id === activeSession?.counterId),
  );
  const activeCounter = activeBranch?.counters.find((counter) => counter.id === activeSession?.counterId);
  const branchName =
    activeSession?.branchName ||
    activeBranch?.name ||
    selectedBranch?.name ||
    fallbackBranch?.name ||
    'No branch';
  const counterName =
    activeSession?.counterName ||
    activeCounter?.name ||
    selectedCounter?.name ||
    fallbackCounter?.name ||
    'No counter';
  const isCounterOpen = activeSession?.status?.toUpperCase() === 'OPEN';
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
  const role = tenant?.role ?? user?.tenants?.[0]?.role ?? user?.role;
  const changeBusiness = async (tenantId: string) => {
    setSwitchingBusiness(true);
    try {
      await authApi.selectTenant(tenantId);
      setSelectedBranch(null);
      setSelectedCounter(null);
      await refreshSession();
    } catch (error) {
      showSnackbar('Could not switch business', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSwitchingBusiness(false);
    }
  };
  return (
    <SharedHeader
      variant="pos"
      title={title}
      businessName={organization?.name || tenant?.name}
      branchName={branchName}
      counterName={counterName}
      isCounterOpen={isCounterOpen}
      userInitials={userInitials}
      userName={userName}
      userRole={role ? `${role[0]?.toUpperCase()}${role.slice(1)}` : 'Team member'}
      isOnline={isOnline}
      pendingQueueCount={pendingQueueCount}
      storage={local}
      refreshJob={refreshJob}
      onCounterPress={() => (isCounterOpen ? setSummaryOpen(true) : setCounterOpen(true))}
      onProfile={() => router.push('/profile')}
      onDebugUser={() =>
        showSnackbar(
          'Debug user',
          session?.user ? JSON.stringify(session.user, null, 2) : 'No stored user found.',
        )
      }
      onSwitchBusiness={() => setWorkspaceOpen(true)}
      onSettings={() => router.push('/settings')}
      onLogout={async () => {
        await authApi.logout();
        await refreshSession();
        router.replace('/login');
      }}
      onMenuToggle={onMenuToggle}
      navigationCollapsed={navigationCollapsed}
    >
      <BusinessContextDialog
        visible={workspaceOpen}
        businessId={tenant?.id}
        businesses={(user?.tenants ?? []).map((item) => ({
          id: item.id,
          name: item.name || 'Unnamed business',
        }))}
        branches={organization?.branches ?? []}
        loading={switchingBusiness}
        onBusinessChange={changeBusiness}
        onClose={() => setWorkspaceOpen(false)}
        onConfirm={(branch, counter) => {
          setSelectedBranch(branch);
          setSelectedCounter(counter);
          setWorkspaceOpen(false);
          if (activeSession?.counterId === counter.id && activeSession.status.toUpperCase() === 'OPEN')
            return;
          setCounterOpen(true);
        }}
      />
      <OpenCounterSessionDialog
        visible={counterOpen}
        token={session?.token}
        tenantId={session ? String(session.tenant.id) : undefined}
        branchName={selectedBranch?.name || fallbackBranch?.name}
        counterId={selectedCounter?.id || fallbackCounter?.id}
        counterName={selectedCounter?.name || fallbackCounter?.name}
        currencyCode={String(organization?.settings.currency ?? 'INR').toUpperCase()}
        onClose={() => setCounterOpen(false)}
        onOpened={async () => {
          await refreshSession();
          await featureRefresh?.();
        }}
      />
      <CounterSessionSummaryDialog
        visible={summaryOpen}
        token={session?.token}
        tenantId={session ? String(session.tenant.id) : undefined}
        session={activeSession}
        currencyCode={String(organization?.settings.currency ?? 'INR').toUpperCase()}
        onClose={() => setSummaryOpen(false)}
        onClosed={async () => {
          await refreshSession();
          await featureRefresh?.();
        }}
      />
    </SharedHeader>
  );
}
