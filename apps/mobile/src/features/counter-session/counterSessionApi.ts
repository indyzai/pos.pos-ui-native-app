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
    const data = await requestPos<{ recordMiscellaneousTransaction: boolean }>(
      token,
      tenantId,
      `mutation RecordCounterPettyCash($input: MiscellaneousTransactionInput!) { recordMiscellaneousTransaction(input: $input) }`,
      { input },
    );
    if (!data.recordMiscellaneousTransaction) throw new Error('Server did not acknowledge the cash entry.');
  },
  async getDenominations(token: string, tenantId: string, currencyCode: string) {
    const data = await requestPos<{ currencyDenominations?: CurrencyDenomination[] }>(
      token,
      tenantId,
      denominationQuery,
      { currencyCode },
    );
    return (data.currencyDenominations ?? [])
      .map((item) => ({ ...item, value: Number(item.value), sortOrder: Number(item.sortOrder) }))
      .filter((item) => Number.isFinite(item.value) && item.value > 0)
      .sort((left, right) => left.sortOrder - right.sortOrder || right.value - left.value);
  },
  open: openCounterSession,
  close: closeCounterSession,
};
