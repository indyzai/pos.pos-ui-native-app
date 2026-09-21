import * as Crypto from 'expo-crypto';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import {
  getActiveDatabase,
  localRecordsFromPayloads,
  mapBootstrapCustomer,
  type LocalDatabase,
  type LocalRecord,
} from '@indyzai/pos-database';
import { requestPos } from '../../core/api/posApi';
import type { Customer } from '../billing/types/billing';

export type LocalCustomer = Customer & { pendingSync?: boolean; syncError?: string };
const customerPageSize = 200;
const customersQuery = `query PosCustomers($type: PartyType, $skip: Int!, $take: Int!) {
  parties(type: $type, skip: $skip, take: $take) {
    id name type contactNumber phone email addressLine gstin creditLimit balance
  }
}`;

function context(databaseOverride?: LocalDatabase | null) {
  const session = getActiveAuthSession();
  const database = databaseOverride ?? getActiveDatabase();
  if (!session || !database) throw new Error('Your local workspace is still initializing.');
  return { session, database, repository: database.collection<LocalRecord<LocalCustomer>>('customers') };
}

async function pushPending(databaseOverride?: LocalDatabase | null) {
  const { session, database, repository } = context(databaseOverride);
  const pending = await repository.list({ syncStatus: 'PENDING', includeDeleted: true });
  for (const record of pending) {
    try {
      const data = await requestPos<{ saveParty: Record<string, unknown> }>(
        session.token,
        String(session.tenant.id),
        `mutation CreatePosCustomer($input: NewPartyInput!) {
          saveParty(input: $input) { id name phone email addressLine gstin creditLimit balance }
        }`,
        { input: { ...record.payload, id: undefined, pendingSync: undefined, syncError: undefined } },
      );
      const customer = mapBootstrapCustomer(data.saveParty) as Customer;
      await database.transaction(['customers'], async () => {
        await repository.remove(record.id);
        await repository.put(localRecordsFromPayloads(database, 'customers', [customer])[0]);
      });
    } catch (reason) {
      await repository.put({
        ...record,
        payload: {
          ...record.payload,
          syncError: reason instanceof Error ? reason.message : 'Customer sync failed.',
        },
      });
      throw reason;
    }
  }
}

export const customersApi = {
  async create(input: Omit<Customer, 'id' | 'type'>) {
    const { database, repository } = context();
    const customer: LocalCustomer = {
      ...input,
      id: `offline-${Crypto.randomUUID()}`,
      name: input.name.trim(),
      type: 'CUSTOMER',
      pendingSync: true,
    };
    const record = localRecordsFromPayloads(database, 'customers', [customer])[0];
    await repository.put({ ...record, syncStatus: 'PENDING' });
    void pushPending().catch(() => undefined);
    return customer;
  },

  async sync(signal?: AbortSignal, databaseOverride?: LocalDatabase | null) {
    await pushPending(databaseOverride);
    const { session, database, repository } = context(databaseOverride);
    const parties: Record<string, unknown>[] = [];
    for (let skip = 0; ; skip += customerPageSize) {
      const data = await requestPos<{ parties: Record<string, unknown>[] }>(
        session.token,
        String(session.tenant.id),
        customersQuery,
        { type: 'CUSTOMER', skip, take: customerPageSize },
        signal,
      );
      const page = data.parties ?? [];
      parties.push(...page);
      if (page.length < customerPageSize) break;
    }
    const pending = await repository.list({ syncStatus: 'PENDING', includeDeleted: true });
    const remote = parties.map((party) => mapBootstrapCustomer(party) as Customer);
    await repository.replace([...localRecordsFromPayloads(database, 'customers', remote), ...pending]);
  },
};
