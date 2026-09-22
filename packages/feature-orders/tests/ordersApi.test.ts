import { expect, test } from "bun:test";
import { createOrdersApi, type OrdersApiOptions } from "../src/ordersApi";
import type { SalesOrder, RefundRecord } from "../src/types";
import { buildPendingRefund } from "../src/refundPolicy";

test("duplicate product selections cannot refund the same quantity twice", () => {
    expect(() =>
        buildPendingRefund(
            { id: "sale1", items: [] } as unknown as SalesOrder,
            [
                { productId: "p1", quantity: 1 },
                { productId: "p1", quantity: 1 },
            ],
            [],
            "",
            "CASH",
            "id",
            "2026-01-01",
        ),
    ).toThrow("only appear once");
});

function fixture() {
    let context = {
        scope: "admin:user:tenant",
        tenant: "tenant",
        token: "token",
    };
    let orders: SalesOrder[] = [];
    let refunds: RefundRecord[] = [];
    let writes = 0;
    const repository: OrdersApiOptions["repository"] = {
        readOrders: async () => structuredClone(orders),
        readRefunds: async () => structuredClone(refunds),
        replaceOrders: async (scope, rows) => {
            expect(scope).toBe(context.scope);
            writes++;
            orders = rows;
        },
        replaceRefunds: async (scope, rows) => {
            expect(scope).toBe(context.scope);
            writes++;
            refunds = rows;
        },
    };
    return {
        repository,
        getContext: () => context,
        switchUser: () => {
            context = { ...context, scope: "other-user" };
        },
        getOrders: () => orders,
        getWrites: () => writes,
    };
}

test("refresh retrieves all order pages before persisting local data", async () => {
    const state = fixture();
    const offsets: number[] = [];
    const request: OrdersApiOptions["request"] = async <T>(
        _token: string,
        _tenant: string,
        query: string,
        variables?: Record<string, unknown>,
    ) => {
        if (query.includes("MobileOrders")) {
            const skip = Number(variables?.skip);
            offsets.push(skip);
            return {
                bills: Array.from({ length: skip === 0 ? 200 : 1 }, (_, i) => ({
                    id: String(skip + i),
                })),
            } as T;
        }
        return { saleRefunds: [] } as T;
    };
    const api = createOrdersApi({ ...state, createId: () => "id", request });
    await api.refresh();
    expect(offsets).toEqual([0, 200]);
    expect((await api.load()).orders).toHaveLength(201);
});

test("a late response after a user switch never overwrites local orders", async () => {
    const state = fixture();
    const request: OrdersApiOptions["request"] = async <T>() => {
        state.switchUser();
        return { bills: [] } as T;
    };
    const api = createOrdersApi({ ...state, createId: () => "id", request });
    await expect(api.refresh()).rejects.toThrow("workspace changed");
    expect(state.getWrites()).toBe(0);
});

test("failed pagination leaves the previously loaded orders untouched", async () => {
    const state = fixture();
    const request: OrdersApiOptions["request"] = async <T>(
        _token: string,
        _tenant: string,
        _query: string,
        variables?: Record<string, unknown>,
    ) => {
        if (Number(variables?.skip) > 0) throw new Error("Offline");
        return {
            bills: Array.from({ length: 200 }, (_, i) => ({ id: String(i) })),
        } as T;
    };
    const api = createOrdersApi({ ...state, createId: () => "id", request });
    await expect(api.refresh()).rejects.toThrow("Offline");
    expect(state.getWrites()).toBe(0);
});
