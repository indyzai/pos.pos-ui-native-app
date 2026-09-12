import * as Crypto from 'expo-crypto';
import { requestPos } from '../../core/api/posApi';
import { SerialQueue } from '../../sync/serialQueue';
import { getActiveAuthSession } from '../auth/AuthSessionContext';
import { ordersRepository } from './ordersRepository';
import type { RefundRecord, SalesOrder } from './types';
import { buildPendingRefund, type RefundSelection } from './refundPolicy';

const queue = new SerialQueue();
const ordersQuery = `query MobileOrders($skip: Int!, $take: Int!) { bills(skip: $skip, take: $take) { id billId offlineId subtotal taxAmount discountAmount totalAmount status type saleDate customerName paymentMethod items { productId name quantity unitPrice discountAmount taxAmount lineTotal } } }`;
const refundsQuery = `query MobileRefunds { saleRefunds { id offlineId creditNoteNumber originalInvoiceNumber originalSaleId items subtotal tax total reason refundMethod status createdAt } }`;
const refundMutation = `mutation MobileCreateRefund($input: CreateRefundInput!) { createSaleRefund(input: $input) { id offlineId creditNoteNumber originalInvoiceNumber originalSaleId items subtotal tax total reason refundMethod status createdAt } }`;

function context() {
    const session = getActiveAuthSession();
    if (!session) throw new Error('Your workspace is still initializing.');
    return {
        scope: `indyz.admin.orders.v1:${session.user.id}:${session.tenant.id}`,
        token: session.token,
        tenant: String(session.tenant.id),
    };
}

const request = <T>(
    c: ReturnType<typeof context>,
    query: string,
    variables: Record<string, unknown> = {},
    signal?: AbortSignal,
) => requestPos<T>(c.token, c.tenant, query, variables, signal);

export const ordersApi = {
    load: () =>
        queue.run(async () => {
            const c = context();
            const [orders, refunds] = await Promise.all([
                ordersRepository.readOrders(c.scope),
                ordersRepository.readRefunds(c.scope),
            ]);
            return { scope: c.scope, orders, refunds };
        }),
    refresh: (signal?: AbortSignal) =>
        queue.run(async () => {
            const c = context();
            const [orderData, refundData, localRefunds] = await Promise.all([
                request<{ bills: SalesOrder[] }>(c, ordersQuery, { skip: 0, take: 200 }, signal),
                request<{ saleRefunds: RefundRecord[] }>(c, refundsQuery, {}, signal),
                ordersRepository.readRefunds(c.scope),
            ]);
            const pending = localRefunds.filter(
                (refund) => refund.status === 'PENDING_SYNC' || refund.status === 'FAILED',
            );
            const remoteIds = new Set(refundData.saleRefunds.map((refund) => refund.offlineId));
            const refunds = [
                ...refundData.saleRefunds,
                ...pending.filter((refund) => !remoteIds.has(refund.offlineId)),
            ];
            await Promise.all([
                ordersRepository.replaceOrders(c.scope, orderData.bills),
                ordersRepository.replaceRefunds(c.scope, refunds),
            ]);
        }),
    createRefund: (order: SalesOrder, selections: RefundSelection[], reason: string, refundMethod: string) =>
        queue.run(async () => {
            const c = context();
            const refunds = await ordersRepository.readRefunds(c.scope);
            const offlineId = Crypto.randomUUID();
            const refund = buildPendingRefund(
                order,
                selections,
                refunds,
                reason,
                refundMethod,
                offlineId,
                new Date().toISOString(),
            );
            refunds.push(refund);
            await ordersRepository.replaceRefunds(c.scope, refunds);
            return refund;
        }),
    sync: (signal?: AbortSignal) =>
        queue.run(async () => {
            const c = context();
            const refunds = await ordersRepository.readRefunds(c.scope);
            for (const refund of refunds.filter(
                (item) => item.status === 'PENDING_SYNC' || item.status === 'FAILED',
            )) {
                try {
                    const { id: _id, syncError: _error, ...input } = refund;
                    const data = await request<{ createSaleRefund: RefundRecord }>(
                        c,
                        refundMutation,
                        { input: { ...input, status: 'completed' } },
                        signal,
                    );
                    Object.assign(refund, data.createSaleRefund, { syncError: undefined });
                } catch (error) {
                    refund.status = 'FAILED';
                    refund.syncError = error instanceof Error ? error.message : 'Unable to sync refund.';
                    await ordersRepository.replaceRefunds(c.scope, refunds);
                    throw error;
                }
                await ordersRepository.replaceRefunds(c.scope, refunds);
            }
        }),
};
