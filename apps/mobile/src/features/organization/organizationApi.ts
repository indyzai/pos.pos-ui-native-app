import { requestPos } from '../../core/api/posApi';
import type { CounterSession } from '../sales/salesOutbox';

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
export async function loadOrganizationDetails(token: string, tenantId: string): Promise<OrganizationDetails> {
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
): Promise<void> {
  const data = await requestPos<{ closeCounter?: { id?: string; status?: string } }>(
    token,
    tenantId,
    `mutation CloseCounter($sessionId: Float!, $input: CloseCounterInput!) {
      closeCounter(sessionId: $sessionId, input: $input) { id status }
    }`,
    { sessionId: Number(sessionId), input: { closingBalance, ...(remarks ? { remarks } : {}) } },
  );
  if (!data.closeCounter?.id || data.closeCounter.status?.toUpperCase() !== 'CLOSED') {
    throw new Error('The counter session was not closed.');
  }
}

export async function openCounterSession(
  token: string,
  tenantId: string,
  counterId: string,
  openingBalance: number,
): Promise<void> {
  const data = await requestPos<{ openCounter?: { id?: string } }>(
    token,
    tenantId,
    `mutation OpenCounter($input: OpenCounterInput!) {
      openCounter(input: $input) { id status counterId branchId }
    }`,
    { input: { counterId: Number(counterId), openingBalance } },
  );
  if (!data.openCounter?.id) throw new Error('The counter session was not opened.');
}

export function requiresOpenCounter(settings: Record<string, unknown> | undefined): boolean {
  const features = (settings?.features ?? {}) as Record<string, unknown>;
  const configured =
    features.requireOpenCounterForBilling ??
    features.requireCounterSessionForBilling ??
    settings?.requireOpenCounterForBilling ??
    settings?.requireCounterSessionForBilling;
  return configured === undefined ? true : configured !== false;
}
