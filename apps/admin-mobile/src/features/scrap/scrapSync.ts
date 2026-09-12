import type { CounterSession } from '../sales/salesOutbox';
import type { Customer, ScrapExchange } from '../billing/types/billing';
import type { ScrapPurchaseJob } from './types';

type Request = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

export function scrapPurchaseJob(
    exchange: ScrapExchange,
    session: CounterSession,
    customer?: Customer,
): ScrapPurchaseJob {
    return {
        id: exchange.id,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        payload: {
            billId: exchange.id,
            items: exchange.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxAmount: 0,
                discountAmount: 0,
                lineTotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
            })),
            subtotal: exchange.total,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: exchange.total,
            ...(customer ? { partyId: Number(customer.id) } : {}),
            ...(session.branchId ? { branchId: Number(session.branchId) } : {}),
            counterId: Number(session.counterId),
            counterSessionId: Number(session.id),
            status: 'DRAFT',
        },
    };
}

const mutation = `mutation MobileRecordScrap($input: NewScrapPurchaseInput!) { recordScrapPurchase(input: $input) { id billId } }`;

export async function syncScrapPurchaseJobs(
    jobs: ScrapPurchaseJob[],
    request: Request,
    persist: () => Promise<void>,
): Promise<void> {
    while (jobs.length) {
        const job = jobs[0];
        try {
            const data = await request<{ recordScrapPurchase: { id: string; billId: string } }>(mutation, {
                input: job.payload,
            });
            if (!data.recordScrapPurchase?.id)
                throw new Error('Server did not acknowledge the scrap purchase.');
        } catch (error) {
            job.status = 'FAILED';
            job.error = error instanceof Error ? error.message : 'Unable to sync scrap purchase.';
            await persist();
            throw error;
        }
        jobs.shift();
        await persist();
    }
}
