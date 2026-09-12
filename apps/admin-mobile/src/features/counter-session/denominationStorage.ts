import { kvStore } from '../../storage/kvStore';
import type { DenominationCounts } from './types';

export type DenominationCountScope = 'opening' | 'closing';

const key = (tenantId: string, counterId: string, currencyCode: string, scope: DenominationCountScope) =>
    `indyz.admin.counter-denominations.v1:${tenantId}:${counterId}:${currencyCode}${scope === 'opening' ? '' : `:${scope}`}`;

export async function loadDenominationCounts(
    tenantId: string,
    counterId: string,
    currencyCode: string,
    scope: DenominationCountScope = 'opening',
): Promise<DenominationCounts> {
    const value = await kvStore.get(key(tenantId, counterId, currencyCode, scope));
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
    scope: DenominationCountScope = 'opening',
): Promise<void> {
    return kvStore.set(key(tenantId, counterId, currencyCode, scope), JSON.stringify(counts));
}
