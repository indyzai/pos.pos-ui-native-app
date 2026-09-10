import { kvStore } from '../../storage/kvStore';
import type { DenominationCounts } from './types';

const key = (tenantId: string, counterId: string, currencyCode: string) =>
  `indyz.counter-denominations.v1:${tenantId}:${counterId}:${currencyCode}`;

export async function loadDenominationCounts(
  tenantId: string,
  counterId: string,
  currencyCode: string,
): Promise<DenominationCounts> {
  const value = await kvStore.get(key(tenantId, counterId, currencyCode));
  if (!value) return {};
  try {
    return JSON.parse(value) as DenominationCounts;
  } catch {
    return {};
  }
}

export function saveDenominationCounts(
  tenantId: string,
  counterId: string,
  currencyCode: string,
  counts: DenominationCounts,
): Promise<void> {
  return kvStore.set(key(tenantId, counterId, currencyCode), JSON.stringify(counts));
}
