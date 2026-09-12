import { and, eq } from 'drizzle-orm';
import type { Product } from '../types/billing';
import type { CounterSession, PendingSale } from '../../sales/salesOutbox';
import { getDatabase, hasNativeDatabase } from '@indyzai/pos-database/client';
import { initializeDatabase } from '@indyzai/pos-database/migrations';
import { billingMetadata, products, sales } from '@indyzai/pos-database/schema';
import { readWebBillingSnapshot, writeWebBillingSnapshot } from '@indyzai/pos-database/web-client';

export type BillingSnapshot = {
    products: Product[];
    session: CounterSession | null;
    queue: PendingSale[];
    updated?: string;
};

const metadataId = (scope: string) => `${scope}:billing`;
const productId = (scope: string, remoteId: string) => `${scope}:product:${remoteId}`;
const saleId = (scope: string, offlineId: string) => `${scope}:sale:${offlineId}`;

function parseProductDetails(value: string | null): Product['details'] {
    if (!value) return undefined;
    try {
        return JSON.parse(value) as Product['details'];
    } catch {
        return undefined;
    }
}

const productFromRow = (product: typeof products.$inferSelect): Product => ({
    id: product.remoteId,
    name: product.name,
    category: product.category,
    categoryType: (product.categoryType as Product['categoryType']) ?? undefined,
    price: product.price,
    stock: product.stock,
    barcode: product.barcode ?? undefined,
    sku: product.sku ?? undefined,
    imageUrl: product.imageUrl ?? undefined,
    quick: product.quick,
    taxRate: product.taxRate,
    details: parseProductDetails(product.details),
    emoji: '📦',
    color: '#E7EDFF',
});

function pendingSaleFromRow(sale: typeof sales.$inferSelect): PendingSale | null {
    try {
        const input = JSON.parse(sale.payload) as Record<string, unknown>;
        return {
            id: sale.offlineId,
            operation: 'CREATE',
            payload: input,
            input,
            createdAt: sale.createdAt,
            receiptNumber:
                String(
                    (input.details as Record<string, unknown> | undefined)?.provisionalReceiptNumber || '',
                ) || sale.offlineId,
            error: sale.errorMessage ?? undefined,
        };
    } catch {
        return null;
    }
}

function parseMetadata(
    metadata: typeof billingMetadata.$inferSelect | undefined,
): Pick<BillingSnapshot, 'session' | 'updated'> {
    if (!metadata) return { session: null };
    try {
        return {
            session: JSON.parse(metadata.session) as CounterSession | null,
            updated: metadata.updated ?? undefined,
        };
    } catch {
        return { session: null, updated: metadata.updated ?? undefined };
    }
}

export async function readBillingSnapshot(scope: string): Promise<BillingSnapshot> {
    if (!hasNativeDatabase) {
        return (
            (await readWebBillingSnapshot<BillingSnapshot>(scope)) ?? {
                products: [],
                session: null,
                queue: [],
            }
        );
    }
    initializeDatabase();
    const nativeDatabase = getDatabase();
    const productRows = nativeDatabase.select().from(products).where(eq(products.scope, scope)).all();
    const saleRows = nativeDatabase
        .select()
        .from(sales)
        .where(and(eq(sales.scope, scope), eq(sales.status, 'PENDING')))
        .all()
        .concat(
            nativeDatabase
                .select()
                .from(sales)
                .where(and(eq(sales.scope, scope), eq(sales.status, 'FAILED')))
                .all(),
        );
    const [metadata] = nativeDatabase
        .select()
        .from(billingMetadata)
        .where(eq(billingMetadata.id, metadataId(scope)))
        .all();
    const parsedMetadata = parseMetadata(metadata);
    return {
        products: productRows.map(productFromRow),
        queue: saleRows
            .map(pendingSaleFromRow)
            .filter((sale): sale is PendingSale => sale !== null)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
        ...parsedMetadata,
    };
}

/** Persists catalog, counter metadata and sales in one SQLite transaction. Calls are serialized by billingApi. */
export async function writeBillingSnapshot(scope: string, snapshot: BillingSnapshot): Promise<void> {
    if (!hasNativeDatabase) {
        await writeWebBillingSnapshot(scope, snapshot);
        return;
    }
    initializeDatabase();
    getDatabase().transaction((tx) => {
        const existingSales = tx.select().from(sales).where(eq(sales.scope, scope)).all();
        const pendingIds = new Set(snapshot.queue.map((sale) => sale.id));
        tx.delete(products).where(eq(products.scope, scope)).run();
        for (const product of snapshot.products) {
            tx.insert(products)
                .values({
                    id: productId(scope, product.id),
                    scope,
                    remoteId: product.id,
                    name: product.name,
                    category: product.category,
                    categoryType: product.categoryType ?? null,
                    price: product.price,
                    stock: product.stock,
                    barcode: product.barcode ?? null,
                    sku: product.sku ?? null,
                    imageUrl: product.imageUrl ?? null,
                    quick: product.quick ?? false,
                    taxRate: product.taxRate ?? 0,
                    details: product.details ? JSON.stringify(product.details) : null,
                })
                .onConflictDoUpdate({
                    target: products.id,
                    set: {
                        name: product.name,
                        category: product.category,
                        categoryType: product.categoryType ?? null,
                        price: product.price,
                        stock: product.stock,
                        barcode: product.barcode ?? null,
                        sku: product.sku ?? null,
                        imageUrl: product.imageUrl ?? null,
                        quick: product.quick ?? false,
                        taxRate: product.taxRate ?? 0,
                        details: product.details ? JSON.stringify(product.details) : null,
                    },
                })
                .run();
        }
        for (const sale of existingSales) {
            if (!pendingIds.has(sale.offlineId) && sale.status !== 'SYNCED') {
                tx.update(sales)
                    .set({ status: 'SYNCED', errorMessage: null })
                    .where(eq(sales.id, sale.id))
                    .run();
            }
        }
        for (const sale of snapshot.queue) {
            tx.insert(sales)
                .values({
                    id: saleId(scope, sale.id),
                    scope,
                    offlineId: sale.id,
                    payload: JSON.stringify(sale.input),
                    status: sale.error ? 'FAILED' : 'PENDING',
                    errorMessage: sale.error ?? null,
                    createdAt: sale.createdAt,
                })
                .onConflictDoUpdate({
                    target: sales.id,
                    set: {
                        payload: JSON.stringify(sale.input),
                        status: sale.error ? 'FAILED' : 'PENDING',
                        errorMessage: sale.error ?? null,
                    },
                })
                .run();
        }
        tx.insert(billingMetadata)
            .values({
                id: metadataId(scope),
                scope,
                session: JSON.stringify(snapshot.session),
                updated: snapshot.updated ?? null,
            })
            .onConflictDoUpdate({
                target: billingMetadata.id,
                set: { session: JSON.stringify(snapshot.session), updated: snapshot.updated ?? null },
            })
            .run();
    });
}
