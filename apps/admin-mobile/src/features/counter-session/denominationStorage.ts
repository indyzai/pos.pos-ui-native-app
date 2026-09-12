import { kvStore } from '../../storage/kvStore';
import type { DenominationCounts } from './types';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';

export type DenominationCountScope = 'opening' | 'closing';

const key = (tenantId: string, counterId: string, currencyCode: string, scope: DenominationCountScope) =>
    appStorageKeys.admin.counterDenominations(
        tenantId,
        counterId,
        currencyCode,
        scope === 'opening' ? undefined : scope,
    );

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
