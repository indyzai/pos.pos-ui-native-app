import * as Crypto from 'expo-crypto';
import type { QueuedMutation } from '../../sync/types';
import type { CartItem, PaymentMethod } from '../billing/types/billing';

export type CounterSession = { id: string; counterId: string; status: string };
export type SaleInput = Record<string, unknown>;
export type PendingSale = QueuedMutation<SaleInput> & { input: SaleInput };

type CreateSaleParams = {
  items: CartItem[];
  payment: PaymentMethod;
  session: CounterSession | null;
};

type SaleRequest = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const createBillMutation = `
  mutation CreateBill($newBillData: NewBillInput!) {
    saveBill(newBillData: $newBillData) { id }
  }
`;

/** Creates a durable, idempotent sale payload before any UI cart is cleared. */
export function createPendingSale({ items, payment, session }: CreateSaleParams): PendingSale {
  if (!session) throw new Error('Open a counter session in POS web, then refresh billing before selling.');
  if (
    !items.length ||
    items.some(
      (item) =>
        !Number.isFinite(Number(item.id)) ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1,
    )
  ) {
    throw new Error('The cart contains an invalid product or quantity.');
  }

  const lines = items.map((item) => ({
    productId: Number(item.id),
    quantity: item.quantity,
    unitPrice: item.price,
    discountAmount: 0,
    taxAmount: Math.round(item.price * item.quantity * (item.taxRate || 0)) / 100,
    lineTotal: Math.round(item.price * item.quantity * 100) / 100,
  }));
  const subtotal = Math.round(lines.reduce((total, line) => total + line.lineTotal, 0) * 100) / 100;
  const taxAmount = Math.round(lines.reduce((total, line) => total + line.taxAmount, 0) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  const id = Crypto.randomUUID();
  const input: SaleInput = {
    offlineId: id,
    items: lines,
    payments: [{ paymentMethod: payment.toUpperCase(), amountPaid: totalAmount }],
    counterId: Number(session.counterId),
    counterSessionId: Number(session.id),
    subtotal,
    taxAmount,
    discountAmount: 0,
    totalAmount,
    status: 'COMPLETED',
    saleDate: new Date().toISOString(),
  };

  return { id, operation: 'CREATE', payload: input, input, createdAt: new Date().toISOString() };
}

/** Replays sales one at a time, retaining the failed head item and its offlineId for a safe retry. */
export async function syncPendingSales(
  queue: PendingSale[],
  request: SaleRequest,
  persist: () => Promise<void>,
): Promise<void> {
  while (queue.length) {
    const sale = queue[0];
    try {
      const data = await request<{ saveBill: { id: string } }>(createBillMutation, {
        newBillData: sale.input,
      });
      if (!data.saveBill?.id) throw new Error('Server did not acknowledge the bill.');
    } catch (error) {
      sale.error = error instanceof Error ? error.message : 'Unable to sync bill.';
      await persist();
      throw error;
    }
    queue.shift();
    await persist();
  }
}
