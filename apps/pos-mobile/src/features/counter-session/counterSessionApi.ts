import { queuePettyCash } from '@indyzai/feature-organization/counterSessionApi';
import { getActiveDatabase, applyBootstrapCollections } from '@indyzai/pos-database';
import { requestPos } from '../../core/api/posApi';
import { closeCounterSession, openCounterSession } from '../organization/organizationApi';
import type { CurrencyDenomination } from './types';

const denominationQuery = `
  query CurrencyDenominations($currencyCode: String!) {
    currencyDenominations(currencyCode: $currencyCode) {
      id currencyCode value label sortOrder
    }
  }
`;

export const counterSessionApi = {
  async recordPettyCash(
    token: string,
    tenantId: string,
    input: {
      type: 'INCOME' | 'EXPENSE';
      amount: number;
      description?: string;
      counterSessionId: string;
      branchId?: string;
    },
  ) {
    await queuePettyCash(tenantId, input);
  },
  async getDenominations(token: string, tenantId: string, currencyCode: string) {
    const database = getActiveDatabase();
    if (!database || database.scope.tenantId !== tenantId)
      throw new Error('Your local workspace is still initializing.');
    return (await database.collection('currency_denominations').list())
      .map(({ payload }) => payload as CurrencyDenomination)
      .filter((item) => item.currencyCode === currencyCode)
      .map((item) => ({ ...item, value: Number(item.value), sortOrder: Number(item.sortOrder) }))
      .filter((item) => Number.isFinite(item.value) && item.value > 0)
      .sort((left, right) => left.sortOrder - right.sortOrder || right.value - left.value);
  },
  async refreshDenominations(token: string, tenantId: string, currencyCode: string, signal?: AbortSignal) {
    const database = getActiveDatabase();
    if (!database || database.scope.tenantId !== tenantId)
      throw new Error('Your local workspace is still initializing.');
    const data = await requestPos<{ currencyDenominations: CurrencyDenomination[] }>(
      token,
      tenantId,
      denominationQuery,
      { currencyCode },
      signal,
    );
    signal?.throwIfAborted();
    if (getActiveDatabase() !== database) throw new Error('Your workspace changed. Please retry.');
    if (!Array.isArray(data.currencyDenominations)) throw new Error('Incomplete denomination response.');
    await applyBootstrapCollections(database, { currency_denominations: data.currencyDenominations });
  },
  open: openCounterSession,
  close: closeCounterSession,
};
