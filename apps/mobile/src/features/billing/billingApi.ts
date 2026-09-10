import { requestPos } from '../../core/api/posApi';
import { SerialQueue } from '../../sync/serialQueue';
import { readBillingSnapshot, writeBillingSnapshot } from './data/billingRepository';
import { getActiveAuthSession } from '../auth/AuthSessionContext';
import { loadOrganizationDetails } from '../organization/organizationApi';
import { fetchCatalog } from '../products/catalogApi';
import {
  createPendingSale,
  syncPendingSales,
  type CounterSession,
  type PendingSale,
} from '../sales/salesOutbox';
import type { CartItem, PaymentMethod, Product } from './types/billing';
import { requiresOpenCounter } from '../organization/organizationApi';

type Context = { key: string; tenant: string; token: string };
export type BillingCache = {
  products: Product[];
  session: CounterSession | null;
  queue: PendingSale[];
  updated?: string;
};
const empty = (): BillingCache => ({ products: [], session: null, queue: [] });
const syncQueue = new SerialQueue();
async function context(): Promise<Context> {
  const session = getActiveAuthSession();
  if (!session) throw new Error('Your workspace is still initializing. Please try again.');
  return {
    key: `indyz.billing.v1:${session.user.id}:${session.tenant.id}`,
    tenant: String(session.tenant.id),
    token: session.token,
  };
}
async function read(c: Context): Promise<BillingCache> {
  return readBillingSnapshot(c.key);
}
const write = (c: Context, value: BillingCache) => writeBillingSnapshot(c.key, value);
async function request<T>(c: Context, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if ((await context()).key !== c.key) throw new Error('Business changed. Please retry.');
  return requestPos<T>(c.token, c.tenant, query, variables);
}

export const billingApi = {
  load: () =>
    syncQueue.run(async () => {
      const c = await context();
      return { key: c.key, cache: await read(c) };
    }),
  refresh: () =>
    syncQueue.run(async () => {
      const c = await context();
      const cache = await read(c);
      const products = await fetchCatalog((query, variables) => request(c, query, variables));
      const organization = await loadOrganizationDetails(c.token, c.tenant);
      cache.products = products;
      cache.session = organization?.activeSession ?? null;
      cache.updated = new Date().toISOString();
      await write(c, cache);
    }),
  checkout: (key: string, items: CartItem[], payment: PaymentMethod) =>
    syncQueue.run(async () => {
      const c = await context();
      if (c.key !== key) throw new Error('Business changed. Start a new cart.');
      const cache = await read(c);
      const auth = getActiveAuthSession();
      const requireOpenSession = requiresOpenCounter(auth?.organization?.settings);
      const currentSession = auth?.organization ? auth.organization.activeSession : cache.session;
      const sale = createPendingSale({ items, payment, session: currentSession, requireOpenSession });
      cache.queue.push(sale);
      await write(c, cache); // Never clear the cart until this durable write succeeds.
      return sale.id;
    }),
  sync: () =>
    syncQueue.run(async () => {
      const c = await context();
      const cache = await read(c);
      await syncPendingSales(
        cache.queue,
        (query, variables) => request(c, query, variables),
        () => write(c, cache),
      );
    }),
};
