import { settingsApi } from '../settings/settingsApi';
import { queueOpenCounter, queueCloseCounter } from '@indyzai/feature-organization/counterSessionApi';
import { getActiveDatabase, type LocalRecord } from '@indyzai/pos-database';
import { requestPos } from '../../core/api/posApi';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { createOrganizationCache } from '@indyzai/feature-organization/organizationCache';
const organizationCache = createOrganizationCache('store');
async function cacheCounter(token: string, tenantId: string, activeSession: CounterSession | null) {
  const session = getActiveAuthSession();
  if (!session || session.token !== token || String(session.tenant.id) !== tenantId) return;
  const organization =
    session.organization ?? (await organizationCache.read(String(session.user.id), tenantId));
  if (organization)
    await organizationCache.write(String(session.user.id), tenantId, { ...organization, activeSession });
}

import type { CounterSession } from '@indyzai/feature-billing/salesOutbox';

import { requiresOpenCounter as _requiresOpenCounter } from '@indyzai/feature-organization/organizationSettings';
export function requiresOpenCounter(settings: Record<string, unknown> | undefined): boolean {
  return _requiresOpenCounter(settings);
}

export type OrganizationDetails = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  activeSession: CounterSession | null;
  branches: OrganizationBranch[];
};

export type OrganizationCounter = { id: string; name: string; status?: string };
export type OrganizationBranch = { id: string; name: string; counters: OrganizationCounter[] };

/** Loads the shared business settings and current counter session in one request. */
export async function refreshOrganizationDetails(
  token: string,
  tenantId: string,
  signal?: AbortSignal,
): Promise<OrganizationDetails> {
  const data = await requestPos<{
    organization: {
      id: string;
      name: string;
      config?: Record<string, unknown>;
      activeSession: CounterSession | null;
      branches?: Array<{
        id: string | number;
        name: string;
        counters?: Array<{ id: string | number; name: string; status?: string }>;
      }>;
    };
  }>(
    token,
    tenantId,
    `query OrganizationBootstrap($id: String!) {
    organization(id: $id) {
      id name
      activeSession {
        id counterId branchId status sessionNumber openedAt openingBalance expectedBalance
        salesSummary { cash card upi scrap miscIncome miscExpense totalSales }
      }
      config { businessType logoUrl primaryColor timezone language currency taxId features }
      branches { id name counters { id name } }
    }
  }`,
    { id: tenantId },
    signal,
  );
  const organization = data.organization;
  if (!organization?.id) throw new Error('Organization details were not returned.');
  const activeSession = organization.activeSession;
  const branches = (organization.branches ?? []).map((branch) => ({
    id: String(branch.id),
    name: branch.name || 'Branch',
    counters: (branch.counters ?? []).map((counter) => ({
      id: String(counter.id),
      name: counter.name || 'Counter',
      status: counter.status,
    })),
  }));
  const sessionBranch = branches.find((branch) => branch.id === String(activeSession?.branchId ?? ''));
  const sessionCounter = sessionBranch?.counters.find(
    (counter) => counter.id === String(activeSession?.counterId ?? ''),
  );
  return {
    id: String(organization.id),
    name: organization.name || 'Business',
    settings: organization.config ?? {},
    branches,
    activeSession:
      activeSession?.status?.toUpperCase() === 'OPEN'
        ? {
            id: String(activeSession.id),
            counterId: String(activeSession.counterId),
            branchId: activeSession.branchId ? String(activeSession.branchId) : sessionBranch?.id,
            counterName: sessionCounter?.name,
            branchName: sessionBranch?.name,
            status: activeSession.status,
            sessionNumber: activeSession.sessionNumber,
            openedAt: activeSession.openedAt,
            openingBalance: Number(activeSession.openingBalance || 0),
            expectedBalance:
              activeSession.expectedBalance == null ? undefined : Number(activeSession.expectedBalance),
            salesSummary: activeSession.salesSummary
              ? {
                  cash: Number(activeSession.salesSummary.cash || 0),
                  card: Number(activeSession.salesSummary.card || 0),
                  upi: Number(activeSession.salesSummary.upi || 0),
                  scrap: Number(activeSession.salesSummary.scrap || 0),
                  miscIncome: Number(activeSession.salesSummary.miscIncome || 0),
                  miscExpense: Number(activeSession.salesSummary.miscExpense || 0),
                  totalSales: Number(activeSession.salesSummary.totalSales || 0),
                }
              : undefined,
          }
        : null,
  };
}

export async function closeCounterSession(
  token: string,
  tenantId: string,
  sessionId: string,
  closingBalance: number,
  remarks?: string,
) {
  const queued = await queueCloseCounter(tenantId, sessionId, closingBalance, remarks);
  await cacheCounter(token, tenantId, null);
  return queued;
}

export async function openCounterSession(
  token: string,
  tenantId: string,
  counterId: string,
  openingBalance: number,
) {
  const queued = await queueOpenCounter(tenantId, counterId, openingBalance);
  await cacheCounter(token, tenantId, queued.record);
  return queued;
}

export async function updateOrganizationFeatures(
  token: string,
  tenantId: string,
  features: Record<string, boolean>,
) {
  const session = getActiveAuthSession();
  if (!session || String(session.tenant.id) !== tenantId)
    throw new Error('Your workspace changed. Please retry.');
  return settingsApi.saveBusinessSettings(features);
}

export async function loadOrganizationDetails(
  token: string,
  tenantId: string,
  signal?: AbortSignal,
): Promise<OrganizationDetails> {
  const session = getActiveAuthSession();
  const cached = session ? await organizationCache.read(String(session.user.id), tenantId) : null;
  if (!cached) return refreshOrganizationDetails(token, tenantId, signal);
  signal?.throwIfAborted();
  const database = getActiveDatabase();
  const shifts =
    database?.scope.tenantId === tenantId && database.scope.userId === String(session?.user.id)
      ? await database.collection<LocalRecord<CounterSession>>('shifts').list()
      : [];
  const activeSession = shifts.length
    ? (shifts.find((row) => row.payload.status.toUpperCase() === 'OPEN')?.payload ?? null)
    : cached.activeSession;
  return { ...cached, activeSession };
}
