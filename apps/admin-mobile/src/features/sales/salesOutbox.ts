import * as Crypto from 'expo-crypto';
import type { QueuedMutation } from '../../sync/types';
import type {
    BillingOrderContext,
    CartItem,
    CheckoutPayment,
    Customer,
    PaymentMethod,
} from '../billing/types/billing';
import { calculateBillingTotals, type BillingCalculationPolicy } from '../billing/domain/billingTotals';
import { provisionalReceiptNumber } from '../billing/domain/receiptNumber';

export type CounterSession = {
    id: string;
    counterId: string;
    status: string;
    branchId?: string;
    counterName?: string;
    branchName?: string;
    sessionNumber?: string;
    openedAt?: string;
    openingBalance?: number;
    expectedBalance?: number;
    salesSummary?: {
        cash: number;
        card: number;
        upi: number;
        scrap: number;
        miscIncome: number;
        miscExpense: number;
        totalSales: number;
    };
};
export type SaleInput = Record<string, unknown>;
export type PendingSale = QueuedMutation<SaleInput> & { input: SaleInput; receiptNumber: string };

type CreateSaleParams = {
    items: CartItem[];
    payment: PaymentMethod | CheckoutPayment;
    session: CounterSession | null;
    requireOpenSession?: boolean;
    policy?: BillingCalculationPolicy;
    orderDiscount?: number;
    customer?: Customer;
    invoicePrefix?: string;
    orderContext?: BillingOrderContext;
};

type SaleRequest = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const createBillMutation = `
  mutation CreateBill($newBillData: NewBillInput!) {
    saveBill(newBillData: $newBillData) { id billId }
  }
`;

/** Creates a durable, idempotent sale payload before any UI cart is cleared. */
export function createPendingSale({
    items,
    payment,
    session,
    requireOpenSession = true,
    policy = { taxCalculation: 'exclusive', roundOffTotal: false },
    orderDiscount = 0,
    customer,
    invoicePrefix,
    orderContext,
}: CreateSaleParams): PendingSale {
    if (!session && requireOpenSession) throw new Error('Open a counter session before creating a bill.');
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

    const totals = calculateBillingTotals(items, policy, orderDiscount);
    const itemDiscountTotal = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const afterItemDiscount = Math.max(0, totals.subtotal - itemDiscountTotal);
    const appliedOrderDiscount = Math.min(afterItemDiscount, Math.max(0, orderDiscount));
    const orderDiscountRatio = afterItemDiscount > 0 ? appliedOrderDiscount / afterItemDiscount : 0;
    const lines = items.map((item) => {
        const lineTotal = Math.round(item.price * item.quantity * 100) / 100;
        const discountedLine = Math.max(0, lineTotal - (item.discount || 0)) * (1 - orderDiscountRatio);
        const rate = Math.max(0, item.taxRate || 0);
        const lineTax =
            policy.taxCalculation === 'inclusive'
                ? (discountedLine * rate) / (100 + rate)
                : (discountedLine * rate) / 100;
        return {
            productId: Number(item.id),
            quantity: item.quantity,
            unitPrice: item.price,
            discountAmount: item.discount || 0,
            taxAmount: Math.round(lineTax * 100) / 100,
            lineTotal,
        };
    });
    const checkoutPayment: CheckoutPayment = typeof payment === 'string' ? { method: payment } : payment;
    const id = Crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const receiptNumber = provisionalReceiptNumber(id, createdAt, invoicePrefix, session?.counterId);
    const scrapValue = checkoutPayment.scrap?.total || 0;
    const primaryPayment = Math.max(0, Math.round((totals.total - scrapValue) * 100) / 100);
    const payments = [
        ...(scrapValue > 0
            ? [{ paymentMethod: 'SCRAP', amountPaid: scrapValue, referenceNumber: checkoutPayment.scrap!.id }]
            : []),
        ...(primaryPayment > 0
            ? [
                  {
                      paymentMethod: checkoutPayment.method.toUpperCase(),
                      amountPaid: primaryPayment,
                      ...(checkoutPayment.referenceNumber
                          ? { referenceNumber: checkoutPayment.referenceNumber }
                          : {}),
                      ...(checkoutPayment.bankAccountId
                          ? { bankAccountId: checkoutPayment.bankAccountId }
                          : {}),
                  },
              ]
            : []),
    ];
    const input: SaleInput = {
        offlineId: id,
        ...(customer ? { partyId: Number(customer.id) } : {}),
        items: lines,
        payments,
        ...(session ? { counterId: Number(session.counterId), counterSessionId: Number(session.id) } : {}),
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        discountAmount: totals.discount,
        totalAmount: totals.total,
        details: {
            ...(checkoutPayment.tenderedAmount !== undefined
                ? { tenderedAmount: checkoutPayment.tenderedAmount }
                : {}),
            ...(checkoutPayment.changeDue !== undefined ? { changeDue: checkoutPayment.changeDue } : {}),
            ...(totals.rounding ? { roundingAdjustment: totals.rounding } : {}),
            taxCalculation: policy.taxCalculation,
            provisionalReceiptNumber: receiptNumber,
            ...(checkoutPayment.scrap ? { scrapExchange: checkoutPayment.scrap } : {}),
            ...orderContext,
            ...(orderContext?.autoCreateWaybill && customer?.address
                ? {
                      waybillDraft: {
                          sellerName: orderContext.waybillSeller?.name || '',
                          sellerGstin: orderContext.waybillSeller?.gstin || '',
                          sellerAddress: orderContext.waybillSeller?.address || '',
                          sellerState: orderContext.waybillSeller?.state || '',
                          buyerName: customer.name,
                          buyerGstin: customer.gstin || '',
                          buyerAddress: customer.address,
                          items: items.map((item) => ({
                              productId: item.id,
                              productName: item.name,
                              quantity: item.quantity,
                              value: Math.max(0, item.price * item.quantity - (item.discount || 0)),
                              taxRate: item.taxRate || 0,
                          })),
                          totalValue: totals.subtotal - totals.discount,
                          totalTax: totals.tax,
                          totalAmount: totals.total,
                          transport: { transporterName: '', vehicleNumber: '', transportMode: 'road' },
                          originAddress: orderContext.waybillSeller?.address || '',
                          destinationAddress: customer.address,
                          branchId: session?.branchId,
                          branchName: session?.branchName,
                          status: 'draft',
                      },
                  }
                : {}),
            itemCustomizations: items
                .filter((item) => item.customization)
                .map((item) => ({
                    lineId: item.lineId,
                    productId: item.id,
                    ...item.customization,
                })),
        },
        status: 'COMPLETED',
        saleDate: createdAt,
    };

    return { id, operation: 'CREATE', payload: input, input, receiptNumber, createdAt };
}

/** Replays sales one at a time, retaining the failed head item and its offlineId for a safe retry. */
export async function syncPendingSales(
    queue: PendingSale[],
    request: SaleRequest,
    persist: () => Promise<void>,
    onSynced?: (sale: PendingSale, bill: { id: string; billId: string }) => Promise<void>,
): Promise<void> {
    while (queue.length) {
        const sale = queue[0];
        try {
            const data = await request<{ saveBill: { id: string; billId: string } }>(createBillMutation, {
                newBillData: sale.input,
            });
            if (!data.saveBill?.id) throw new Error('Server did not acknowledge the bill.');
            await onSynced?.(sale, data.saveBill);
        } catch (error) {
            sale.error = error instanceof Error ? error.message : 'Unable to sync bill.';
            await persist();
            throw error;
        }
        queue.shift();
        await persist();
    }
}
