import type { PendingSale } from '../sales/salesOutbox';
import type { WaybillJob } from './types';

type Request = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const createWaybillMutation = `
  mutation CreateBillingWaybill($input: CreateLogisticsRecordInput!) {
    createLogisticsRecord(input: $input) { id referenceNumber status }
  }
`;

export function waybillJobFromSale(
  sale: PendingSale,
  bill: { id: string; billId: string },
): WaybillJob | undefined {
  const details = sale.input.details as Record<string, unknown> | undefined;
  const draft = details?.waybillDraft as Record<string, unknown> | undefined;
  if (!draft) return undefined;
  return {
    id: sale.id,
    saleOfflineId: sale.id,
    status: 'PENDING',
    createdAt: sale.createdAt,
    payload: {
      type: 'WAYBILL',
      referenceNumber: `WB-${bill.billId || bill.id}`,
      ...(draft.branchId ? { fromBranchId: String(draft.branchId) } : {}),
      details: { ...draft, invoiceId: bill.id, invoiceNumber: bill.billId },
    },
  };
}

export async function syncWaybillJobs(
  jobs: WaybillJob[],
  request: Request,
  persist: () => Promise<void>,
): Promise<void> {
  while (jobs.length) {
    const job = jobs[0];
    try {
      const result = await request<{ createLogisticsRecord: { id: string } }>(createWaybillMutation, {
        input: job.payload,
      });
      if (!result.createLogisticsRecord?.id) throw new Error('Server did not acknowledge the waybill.');
    } catch (error) {
      job.status = 'FAILED';
      job.error = error instanceof Error ? error.message : 'Unable to sync waybill.';
      await persist();
      throw error;
    }
    jobs.shift();
    await persist();
  }
}
