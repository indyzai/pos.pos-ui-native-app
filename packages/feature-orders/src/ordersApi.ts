import { SerialQueue } from "@indyzai/pos-sync";
import {
    assertFeatureContext,
    type FeatureContext,
    type FeatureRequest,
} from "@indyzai/pos-application";
import type { ordersRepository } from "./ordersRepository";
import type { RefundRecord, SalesOrder } from "./types";
import { buildPendingRefund, type RefundSelection } from "./refundPolicy";

const ordersQuery = `query MobileOrders($skip: Int!, $take: Int!) { bills(skip: $skip, take: $take) { id billId offlineId subtotal taxAmount discountAmount totalAmount status type saleDate counterId counterSessionId branchId customerName paymentMethod paymentType { id name code icon } items { productId name quantity unitPrice discountAmount taxAmount lineTotal } } }`;
const refundsQuery = `query MobileRefunds { saleRefunds { id offlineId creditNoteNumber originalInvoiceNumber originalSaleId items subtotal tax total reason refundMethod status createdAt } }`;
const refundMutation = `mutation MobileCreateRefund($input: CreateRefundInput!) { createSaleRefund(input: $input) { id offlineId creditNoteNumber originalInvoiceNumber originalSaleId items subtotal tax total reason refundMethod status createdAt } }`;

export interface OrdersApiOptions {
    getContext: () => FeatureContext;
    request: FeatureRequest;
    createId: () => string;
    repository: typeof ordersRepository;
}

export function createOrdersApi(options: OrdersApiOptions) {
    const queue = new SerialQueue();
    const repository = options.repository;
    const assertCurrent = (context: FeatureContext) =>
        assertFeatureContext(context, options.getContext());
    const request = async <T>(
        context: FeatureContext,
        query: string,
        variables: Record<string, unknown> = {},
        signal?: AbortSignal,
    ): Promise<T> => {
        assertCurrent(context);
        const result = await options.request<T>(
            context.token,
            context.tenant,
            query,
            variables,
            signal,
        );
        assertCurrent(context);
        return result;
    };
    return {
        async load() {
            const context = options.getContext();
            const [orders, refunds] = await Promise.all([
                repository.readOrders(context.scope),
                repository.readRefunds(context.scope),
            ]);
            assertCurrent(context);
            return { scope: context.scope, orders, refunds };
        },
        refresh(signal?: AbortSignal) {
            return queue.run(async () => {
                const context = options.getContext();
                const bills: SalesOrder[] = [];
                for (let skip = 0; ; skip += 200) {
                    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AbortError');
                    const page = await request<{ bills: SalesOrder[] }>(
                        context,
                        ordersQuery,
                        { skip, take: 200 },
                        signal,
                    );
                    if (!Array.isArray(page.bills))
                        throw new Error("The orders response is incomplete.");
                    bills.push(...page.bills);
                    if (page.bills.length < 200) break;
                }
                const [remote, local] = await Promise.all([
                    request<{ saleRefunds: RefundRecord[] }>(
                        context,
                        refundsQuery,
                        {},
                        signal,
                    ),
                    repository.readRefunds(context.scope),
                ]);
                if (!Array.isArray(remote.saleRefunds))
                    throw new Error("The refunds response is incomplete.");
                const remoteIds = new Set(
                    remote.saleRefunds.map((refund) => refund.offlineId),
                );
                const pending = local.filter(
                    (refund) =>
                        ["PENDING_SYNC", "FAILED"].includes(refund.status) &&
                        !remoteIds.has(refund.offlineId),
                );
                assertCurrent(context);
                if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AbortError');
                await Promise.all([
                    repository.replaceOrders(context.scope, bills),
                    repository.replaceRefunds(context.scope, [
                        ...remote.saleRefunds,
                        ...pending,
                    ]),
                ]);
            });
        },
        createRefund(
            order: SalesOrder,
            selections: RefundSelection[],
            reason: string,
            refundMethod: string,
        ) {
            return queue.run(async () => {
                const context = options.getContext();
                const refunds = await repository.readRefunds(context.scope);
                const refund = buildPendingRefund(
                    order,
                    selections,
                    refunds,
                    reason,
                    refundMethod,
                    options.createId(),
                    new Date().toISOString(),
                );
                assertCurrent(context);
                await repository.replaceRefunds(context.scope, [
                    ...refunds,
                    refund,
                ]);
                return refund;
            });
        },
        sync(signal?: AbortSignal) {
            return queue.run(async () => {
                const context = options.getContext();
                const refunds = await repository.readRefunds(context.scope);
                for (const refund of refunds.filter((item) =>
                    item.status === "PENDING_SYNC" && (item.attempts ?? 0) < 3,
                )) {
                    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AbortError');
                    try {
                        const { id: _id, syncError: _error, attempts: _attempts, ...input } = refund;
                        const response = await request<{
                            createSaleRefund: RefundRecord;
                        }>(
                            context,
                            refundMutation,
                            { input: { ...input, status: "completed" } },
                            signal,
                        );
                        if (!response.createSaleRefund?.id)
                            throw new Error(
                                "Server did not acknowledge the refund.",
                            );
                        Object.assign(refund, response.createSaleRefund, {
                            syncError: undefined,
                            attempts: 0,
                        });
                    } catch (error) {
                        assertCurrent(context);
                        const attempts = (refund.attempts ?? 0) + 1;
                        refund.attempts = attempts;
                        refund.status = attempts >= 3 ? "FAILED" : "PENDING_SYNC";
                        refund.syncError =
                            error instanceof Error
                                ? error.message
                                : "Unable to sync refund.";
                        await repository.replaceRefunds(context.scope, refunds);
                        throw error;
                    }
                    assertCurrent(context);
                    await repository.replaceRefunds(context.scope, refunds);
                }
            });
        },
    };
}
