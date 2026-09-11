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
import type { CartItem, CheckoutPayment, Product } from './types/billing';
import type {
  BillingOrderContext,
  BillingPaymentMethod,
  BillingTaxRate,
  Customer,
  ServiceUser,
} from './types/billing';
import { billingReferenceRepository } from './data/billingReferenceRepository';
import type { BillingCalculationPolicy } from './domain/billingTotals';
import { requiresOpenCounter } from '../organization/organizationApi';
import { waybillRepository } from '../logistics/waybillRepository';
import { syncWaybillJobs, waybillJobFromSale } from '../logistics/waybillSync';
import { productBatchRepository } from './data/productBatchRepository';
import { normalizeProductBatches } from './domain/productBatches';
import type { ProductBatch } from './types/billing';
import { scrapPurchaseRepository } from '../scrap/scrapPurchaseRepository';
import { scrapPurchaseJob, syncScrapPurchaseJobs } from '../scrap/scrapSync';
import { canManageScrap } from '../scrap/permissions';

type Context = { key: string; tenant: string; token: string };
export type BillingCache = {
  products: Product[];
  customers: Customer[];
  paymentMethods: BillingPaymentMethod[];
  serviceUsers: ServiceUser[];
  productBatches: ProductBatch[];
  taxRates: BillingTaxRate[];
  session: CounterSession | null;
  queue: PendingSale[];
  updated?: string;
};
const fallbackPaymentMethods: BillingPaymentMethod[] = [
  {
    id: 'cash',
    name: 'Cash',
    code: 'CASH',
    isActive: true,
    isQuickAccess: true,
    isBankRelated: false,
    bankAccountIds: [],
    bankAccounts: [],
  },
  {
    id: 'upi',
    name: 'UPI',
    code: 'UPI',
    isActive: true,
    isQuickAccess: true,
    isBankRelated: true,
    bankAccountIds: [],
    bankAccounts: [],
  },
  {
    id: 'card',
    name: 'Card',
    code: 'CARD',
    isActive: true,
    isQuickAccess: true,
    isBankRelated: true,
    bankAccountIds: [],
    bankAccounts: [],
  },
];
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
  const [snapshot, customers, paymentMethods, serviceUsers, productBatches, taxRates] = await Promise.all([
    readBillingSnapshot(c.key),
    billingReferenceRepository.readCustomers(c.key),
    billingReferenceRepository.readPaymentMethods(c.key),
    billingReferenceRepository.readServiceUsers(c.key),
    productBatchRepository.read(c.key),
    billingReferenceRepository.readTaxRates(c.key),
  ]);
  return {
    ...snapshot,
    customers,
    paymentMethods: paymentMethods.length ? paymentMethods : fallbackPaymentMethods,
    serviceUsers,
    productBatches,
    taxRates,
  };
}
const write = (c: Context, value: BillingCache) => writeBillingSnapshot(c.key, value);
async function request<T>(
  c: Context,
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  if ((await context()).key !== c.key) throw new Error('Business changed. Please retry.');
  return requestPos<T>(c.token, c.tenant, query, variables, signal);
}

export const billingApi = {
  load: () =>
    syncQueue.run(async () => {
      const c = await context();
      return { key: c.key, cache: await read(c) };
    }),
  refresh: (signal?: AbortSignal) =>
    syncQueue.run(async () => {
      const c = await context();
      const cache = await read(c);
      const products = await fetchCatalog((query, variables) => request(c, query, variables, signal));
      const [customerData, paymentData, serviceUserData, taxData] = await Promise.all([
        request<{ parties: Array<Record<string, unknown>> }>(
          c,
          `query BillingCustomers($skip: Int!, $take: Int!) { parties(type: CUSTOMER, skip: $skip, take: $take) { id name phone contactNumber email addressLine gstin creditLimit balance } }`,
          { skip: 0, take: 500 },
          signal,
        ),
        request<{ paymentTypes: Array<Record<string, unknown>> }>(
          c,
          `query BillingPaymentTypes { paymentTypes { id name code icon isActive isQuickAccess isBankRelated bankAccountIds defaultBankAccountId bankAccounts { id accountName bankName upiId isDefault isActive } } }`,
          {},
          signal,
        ),
        request<{ parties: Array<Record<string, unknown>> }>(
          c,
          `query BillingTechnicians($skip: Int!, $take: Int!) { parties(type: TECHNICIAN, skip: $skip, take: $take) { id name phone email details } }`,
          { skip: 0, take: 500 },
          signal,
        ),
        request<{ taxes: Array<Record<string, unknown>> }>(
          c,
          `query BillingTaxRates { taxes { id name percentage isActive } }`,
          {},
          signal,
        ),
      ]);
      const organization = await loadOrganizationDetails(c.token, c.tenant, signal);
      const customers = customerData.parties.map((party) => ({
        id: String(party.id),
        name: String(party.name),
        phone: String(party.phone || party.contactNumber || '') || undefined,
        email: String(party.email || '') || undefined,
        gstin: String(party.gstin || '') || undefined,
        address: String(party.addressLine || '') || undefined,
        creditLimit: party.creditLimit == null ? undefined : Number(party.creditLimit),
        balance: party.balance == null ? undefined : Number(party.balance),
      }));
      const paymentMethods = paymentData.paymentTypes
        .filter((item) => item.isActive !== false)
        .map((item) => ({
          id: String(item.id),
          name: String(item.name),
          code: String(item.code).toUpperCase(),
          icon: item.icon ? String(item.icon) : undefined,
          isActive: item.isActive !== false,
          isQuickAccess: item.isQuickAccess === true,
          isBankRelated: item.isBankRelated === true,
          bankAccountIds: Array.isArray(item.bankAccountIds) ? item.bankAccountIds.map(Number) : [],
          defaultBankAccountId:
            item.defaultBankAccountId == null ? undefined : Number(item.defaultBankAccountId),
          bankAccounts: Array.isArray(item.bankAccounts)
            ? item.bankAccounts.map((account: any) => ({
                id: Number(account.id),
                accountName: String(account.accountName),
                bankName: String(account.bankName),
                upiId: account.upiId ? String(account.upiId) : undefined,
                isDefault: account.isDefault === true,
                isActive: account.isActive !== false,
              }))
            : [],
        }));
      const serviceUsers: ServiceUser[] = serviceUserData.parties.map((party) => {
        const details = (party.details || {}) as Record<string, unknown>;
        return {
          id: String(party.id),
          name: String(party.name),
          phone: String(party.phone || '') || undefined,
          email: String(party.email || '') || undefined,
          specialization: String(details.specialization || '') || undefined,
          isActive: details.isActive !== false,
        };
      });
      const taxRates: BillingTaxRate[] = taxData.taxes
        .filter((tax) => tax.isActive !== false && Number.isFinite(Number(tax.percentage)))
        .map((tax) => ({
          id: String(tax.id),
          name: String(tax.name),
          percentage: Math.max(0, Number(tax.percentage)),
          isActive: true,
        }));
      cache.products = products;
      cache.customers = customers;
      cache.paymentMethods = paymentMethods.length ? paymentMethods : fallbackPaymentMethods;
      cache.serviceUsers = serviceUsers;
      cache.productBatches = normalizeProductBatches(products);
      cache.taxRates = taxRates;
      cache.session = organization?.activeSession ?? null;
      cache.updated = new Date().toISOString();
      await Promise.all([
        write(c, cache),
        billingReferenceRepository.replaceCustomers(c.key, customers),
        billingReferenceRepository.replacePaymentMethods(c.key, cache.paymentMethods),
        billingReferenceRepository.replaceServiceUsers(c.key, serviceUsers),
        productBatchRepository.replace(c.key, cache.productBatches),
        billingReferenceRepository.replaceTaxRates(c.key, taxRates),
      ]);
    }),
  checkout: (
    key: string,
    items: CartItem[],
    payment: CheckoutPayment,
    policy: BillingCalculationPolicy,
    orderDiscount = 0,
    customer?: Customer,
    orderContext?: BillingOrderContext,
  ) =>
    syncQueue.run(async () => {
      const c = await context();
      if (c.key !== key) throw new Error('Business changed. Start a new cart.');
      const cache = await read(c);
      const auth = getActiveAuthSession();
      const requireOpenSession = requiresOpenCounter(auth?.organization?.settings);
      const currentSession = auth?.organization ? auth.organization.activeSession : cache.session;
      const sale = createPendingSale({
        items,
        payment,
        policy,
        orderDiscount,
        session: currentSession,
        requireOpenSession,
        customer,
        invoicePrefix:
          typeof auth?.organization?.settings?.invoicePrefix === 'string'
            ? auth.organization.settings.invoicePrefix
            : undefined,
        orderContext,
      });
      if (payment.scrap) {
        if (!canManageScrap(auth?.tenant.role)) throw new Error('Your role cannot accept scrap exchanges.');
        if (!currentSession) throw new Error('Open a counter session before accepting scrap.');
        const jobs = await scrapPurchaseRepository.read(c.key);
        jobs.push(scrapPurchaseJob(payment.scrap, currentSession, customer));
        await scrapPurchaseRepository.replace(c.key, jobs);
      }
      cache.queue.push(sale);
      try {
        await write(c, cache); // Never clear the cart until this durable write succeeds.
      } catch (error) {
        if (payment.scrap) {
          const jobs = await scrapPurchaseRepository.read(c.key);
          await scrapPurchaseRepository.replace(
            c.key,
            jobs.filter((job) => job.id !== payment.scrap?.id),
          );
        }
        throw error;
      }
      return { id: sale.id, receiptNumber: sale.receiptNumber };
    }),
  createCustomer: (key: string, input: { name: string; phone?: string; email?: string; gstin?: string }) =>
    syncQueue.run(async () => {
      const c = await context();
      if (c.key !== key) throw new Error('Business changed. Please retry.');
      const data = await request<{ saveParty: Record<string, unknown> }>(
        c,
        `mutation CreateBillingCustomer($input: NewPartyInput!) { saveParty(input: $input) { id name phone email addressLine gstin creditLimit balance } }`,
        { input: { ...input, type: 'CUSTOMER' } },
      );
      const party = data.saveParty;
      const customer: Customer = {
        id: String(party.id),
        name: String(party.name),
        phone: String(party.phone || '') || undefined,
        email: String(party.email || '') || undefined,
        gstin: String(party.gstin || '') || undefined,
        address: String(party.addressLine || '') || undefined,
        creditLimit: party.creditLimit == null ? undefined : Number(party.creditLimit),
        balance: party.balance == null ? undefined : Number(party.balance),
      };
      const current = await billingReferenceRepository.readCustomers(c.key);
      await billingReferenceRepository.replaceCustomers(c.key, [customer, ...current]);
      return customer;
    }),
  sync: (signal?: AbortSignal) =>
    syncQueue.run(async () => {
      const c = await context();
      const cache = await read(c);
      const scrapJobs = await scrapPurchaseRepository.read(c.key);
      await syncScrapPurchaseJobs(
        scrapJobs,
        (query, variables) => request(c, query, variables, signal),
        () => scrapPurchaseRepository.replace(c.key, scrapJobs),
      );
      const waybillJobs = await waybillRepository.read(c.key);
      await syncPendingSales(
        cache.queue,
        (query, variables) => request(c, query, variables, signal),
        () => write(c, cache),
        async (sale, bill) => {
          const job = waybillJobFromSale(sale, bill);
          if (!job || waybillJobs.some((item) => item.id === job.id)) return;
          waybillJobs.push(job);
          await waybillRepository.replace(c.key, waybillJobs);
        },
      );
      await syncWaybillJobs(
        waybillJobs,
        (query, variables) => request(c, query, variables, signal),
        () => waybillRepository.replace(c.key, waybillJobs),
      );
    }),
};
