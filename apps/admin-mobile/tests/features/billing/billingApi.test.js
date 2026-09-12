import { beforeEach, expect, mock, test } from 'bun:test';
const storage = new Map();
let tenant = '1';
let failWrite = false;
const customers = new Map();
const paymentMethods = new Map();
const serviceUsers = new Map();
const waybillJobs = new Map();
const productBatches = new Map();
const scrapPurchaseJobs = new Map();
const taxRates = new Map();
const clone = (value) => structuredClone(value);
mock.module('../../../src/features/billing/data/billingRepository', () => ({
    readBillingSnapshot: async (key) => clone(storage.get(key) ?? { products: [], session: null, queue: [] }),
    writeBillingSnapshot: async (key, value) => {
        if (failWrite) throw new Error('Disk full');
        storage.set(key, clone(value));
    },
}));
mock.module('../../../src/features/billing/data/billingReferenceRepository', () => ({
    billingReferenceRepository: {
        readCustomers: async (key) => clone(customers.get(key) ?? []),
        replaceCustomers: async (key, value) => customers.set(key, clone(value)),
        readPaymentMethods: async (key) => clone(paymentMethods.get(key) ?? []),
        replacePaymentMethods: async (key, value) => paymentMethods.set(key, clone(value)),
        readServiceUsers: async (key) => clone(serviceUsers.get(key) ?? []),
        replaceServiceUsers: async (key, value) => serviceUsers.set(key, clone(value)),
        readTaxRates: async (key) => clone(taxRates.get(key) ?? []),
        replaceTaxRates: async (key, value) => taxRates.set(key, clone(value)),
    },
}));
mock.module('../../../src/features/logistics/waybillRepository', () => ({
    waybillRepository: {
        read: async (key) => clone(waybillJobs.get(key) ?? []),
        replace: async (key, value) => waybillJobs.set(key, clone(value)),
    },
}));
mock.module('../../../src/features/billing/data/productBatchRepository', () => ({
    productBatchRepository: {
        read: async (key) => clone(productBatches.get(key) ?? []),
        replace: async (key, value) => productBatches.set(key, clone(value)),
    },
}));
mock.module('../../../src/features/scrap/scrapPurchaseRepository', () => ({
    scrapPurchaseRepository: {
        read: async (key) => clone(scrapPurchaseJobs.get(key) ?? []),
        replace: async (key, value) => scrapPurchaseJobs.set(key, clone(value)),
    },
}));
mock.module('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
mock.module('../../../src/features/auth/AuthSessionContext', () => ({
    getActiveAuthSession: () => ({
        user: { id: 'user' },
        tenant: { id: tenant, role: 'owner' },
        token: 'test-token',
        organization: { activeSession: { id: '2', counterId: '3', status: 'OPEN' } },
    }),
}));
const { billingApi } = await import('../../../src/features/billing/billingApi');
const key = 'indyz.billing.v1:user:1';
const items = [{ id: '42', price: 10, quantity: 2, taxRate: 5 }];
beforeEach(() => {
    storage.clear();
    customers.clear();
    paymentMethods.clear();
    serviceUsers.clear();
    waybillJobs.clear();
    productBatches.clear();
    scrapPurchaseJobs.clear();
    taxRates.clear();
    tenant = '1';
    failWrite = false;
    process.env.EXPO_PUBLIC_POS_API_URL = 'https://example.test/graphql';
    storage.set(key, { products: [], session: { id: '2', counterId: '3', status: 'OPEN' }, queue: [] });
});
test('concurrent sales are retained', async () => {
    await Promise.all([billingApi.checkout(key, items, 'Cash'), billingApi.checkout(key, items, 'Cash')]);
    const { cache } = await billingApi.load();
    expect(cache.queue).toHaveLength(2);
    expect(cache.queue[0].input.totalAmount).toBe(21);
    expect(cache.queue[0].id).not.toBe(cache.queue[1].id);
});
test('customized restaurant lines retain the original product and line metadata', async () => {
    await billingApi.checkout(
        key,
        [
            {
                ...items[0],
                lineId: '42:large,no-onion',
                customization: {
                    key: 'large,no-onion',
                    label: 'Large, No onion',
                    priceAdjustment: 30,
                    notes: 'Serve hot',
                },
            },
        ],
        'Cash',
        undefined,
        0,
        undefined,
        { orderMode: 'DINE_IN', tableId: '7', tableName: 'T7' },
    );
    const input = (await billingApi.load()).cache.queue[0].input;
    expect(input.items[0].productId).toBe(42);
    expect(input.details.itemCustomizations[0]).toMatchObject({ productId: '42', notes: 'Serve hot' });
    expect(input.details).toMatchObject({ orderMode: 'DINE_IN', tableId: '7' });
});

test('pharmacy prescription context is retained in the queued sale', async () => {
    await billingApi.checkout(
        key,
        [{ ...items[0], details: { prescriptionRequired: true }, quantity: 1 }],
        'CASH',
        undefined,
        0,
        undefined,
        { doctorName: 'Dr Rao', prescriptionReference: 'RX-42' },
    );
    const input = (await billingApi.load()).cache.queue[0].input;
    expect(input.details).toMatchObject({
        doctorName: 'Dr Rao',
        prescriptionReference: 'RX-42',
    });
});
test('wholesale sale retains a draft waybill until the bill has a server invoice', async () => {
    await billingApi.checkout(
        key,
        items,
        'CASH',
        undefined,
        0,
        { id: '7', name: 'Buyer', address: 'Buyer address', gstin: 'GST-7' },
        { autoCreateWaybill: true, waybillSeller: { name: 'Seller', address: 'Seller address' } },
    );
    const details = (await billingApi.load()).cache.queue[0].input.details;
    expect(details.waybillDraft).toMatchObject({
        sellerName: 'Seller',
        buyerName: 'Buyer',
        destinationAddress: 'Buyer address',
    });
    expect(details.waybillDraft.invoiceNumber).toBeUndefined();
});
test('scrap exchange is durably queued and linked to the sale payment', async () => {
    await billingApi.checkout(key, items, {
        method: 'CASH',
        scrap: {
            id: 'SCRAP-offline-7',
            total: 5,
            items: [{ productId: '7', productName: 'Old battery', quantity: 1, unitPrice: 5 }],
        },
    });
    expect(scrapPurchaseJobs.get(key)).toEqual([
        expect.objectContaining({ id: 'SCRAP-offline-7', status: 'PENDING' }),
    ]);
    const input = (await billingApi.load()).cache.queue[0].input;
    expect(input.payments).toEqual([
        { paymentMethod: 'SCRAP', amountPaid: 5, referenceNumber: 'SCRAP-offline-7' },
        { paymentMethod: 'CASH', amountPaid: 16 },
    ]);
});
test('failed upload retains sale and reuses offlineId', async () => {
    const { id, receiptNumber } = await billingApi.checkout(key, items, 'Cash');
    expect(receiptNumber).toMatch(/^POS-\d{8}-3-[A-Z0-9]{6}$/);
    globalThis.fetch = async () => {
        throw new Error('Offline');
    };
    await expect(billingApi.sync()).rejects.toThrow('Offline');
    expect((await billingApi.load()).cache.queue[0].id).toBe(id);
    globalThis.fetch = async (_url, options) => {
        expect(JSON.parse(options.body).variables.newBillData.offlineId).toBe(id);
        return { ok: true, json: async () => ({ data: { saveBill: { id: '99' } } }) };
    };
    await billingApi.sync();
    expect((await billingApi.load()).cache.queue).toHaveLength(0);
});
test('storage failure and business switch reject checkout', async () => {
    failWrite = true;
    await expect(billingApi.checkout(key, items, 'Cash')).rejects.toThrow('Disk full');
    failWrite = false;
    tenant = 'other';
    await expect(billingApi.checkout(key, items, 'Cash')).rejects.toThrow('Business changed');
    expect((await billingApi.load()).cache.queue).toHaveLength(0);
});

test('catalog refresh maps and persists products for offline billing', async () => {
    globalThis.fetch = async (_url, options) => {
        const query = JSON.parse(options.body).query;
        if (query.includes('query Catalog')) {
            return {
                ok: true,
                json: async () => ({
                    data: {
                        products: [
                            {
                                id: 42,
                                name: 'Offline tea',
                                skuCode: 'TEA-42',
                                imageUrl: 'https://example.test/tea.png',
                                details: { isQuickItem: true, serviceDurationMinutes: 45 },
                                price: 20,
                                quantity: 7,
                                barcode: '8901000000042',
                                category: { name: 'Beverages', type: 'INVENTORY' },
                                tax: { percentage: 5 },
                            },
                        ],
                    },
                }),
            };
        }
        if (query.includes('BillingCustomers')) {
            return { ok: true, json: async () => ({ data: { parties: [] } }) };
        }
        if (query.includes('BillingPaymentTypes')) {
            return { ok: true, json: async () => ({ data: { paymentTypes: [] } }) };
        }
        if (query.includes('BillingTechnicians')) {
            return {
                ok: true,
                json: async () => ({
                    data: {
                        parties: [
                            {
                                id: 8,
                                name: 'Technician A',
                                phone: '123',
                                details: { specialization: 'Repair' },
                            },
                        ],
                    },
                }),
            };
        }
        if (query.includes('BillingTaxRates')) {
            return {
                ok: true,
                json: async () => ({
                    data: { taxes: [{ id: 5, name: 'GST 5%', percentage: 5, isActive: true }] },
                }),
            };
        }
        return {
            ok: true,
            json: async () => ({
                data: {
                    organization: {
                        id: '1',
                        name: 'Test business',
                        config: {},
                        activeSession: { id: '2', counterId: '3', status: 'OPEN' },
                    },
                },
            }),
        };
    };
    await billingApi.refresh();
    const { cache } = await billingApi.load();
    expect(cache.products).toEqual([
        expect.objectContaining({
            id: '42',
            name: 'Offline tea',
            sku: 'TEA-42',
            imageUrl: 'https://example.test/tea.png',
            quick: true,
            category: 'Beverages',
            categoryType: 'INVENTORY',
            details: expect.objectContaining({ serviceDurationMinutes: 45 }),
            stock: 7,
            taxRate: 5,
        }),
    ]);
    expect(cache.serviceUsers).toEqual([
        expect.objectContaining({ id: '8', name: 'Technician A', specialization: 'Repair' }),
    ]);
    expect(cache.productBatches).toEqual([]);
    expect(cache.taxRates).toEqual([{ id: '5', name: 'GST 5%', percentage: 5, isActive: true }]);
});
