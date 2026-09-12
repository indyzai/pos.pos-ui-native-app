import type { ScrapExchange } from '../billing/types/billing';

export type ScrapPurchaseJob = {
    id: string;
    payload: Record<string, unknown>;
    status: 'PENDING' | 'FAILED';
    error?: string;
    createdAt: string;
};

export type { ScrapExchange };
