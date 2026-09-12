import { eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '@indyzai/pos-database/client';
import { initializeDatabase } from '@indyzai/pos-database/migrations';
import { customers, paymentMethods, serviceUsers, taxRates } from '@indyzai/pos-database/schema';
import { readWebScopedRecords, replaceWebScopedRecords, webStores } from '@indyzai/pos-database/web-client';
import type { BillingPaymentMethod, BillingTaxRate, Customer, ServiceUser } from '../types/billing';

type ReferenceRecord = Customer | BillingPaymentMethod | ServiceUser | BillingTaxRate;
type ReferenceTable = typeof customers | typeof paymentMethods | typeof serviceUsers | typeof taxRates;

async function readCollection<T extends ReferenceRecord>(
    scope: string,
    table: ReferenceTable,
    webStore:
        | typeof webStores.customers
        | typeof webStores.paymentMethods
        | typeof webStores.serviceUsers
        | typeof webStores.taxRates,
): Promise<T[]> {
    if (!hasNativeDatabase) {
        const rows = await readWebScopedRecords<T & { storageId: string; scope: string }>(webStore, scope);
        return rows.map(({ storageId: _storageId, scope: _scope, ...record }) => record as unknown as T);
    }
    initializeDatabase();
    return getDatabase()
        .select()
        .from(table)
        .where(eq(table.scope, scope))
        .all()
        .flatMap((row) => {
            try {
                return [JSON.parse(row.payload) as T];
            } catch {
                return [];
            }
        });
}

async function replaceCollection<T extends ReferenceRecord>(
    scope: string,
    records: T[],
    table: ReferenceTable,
    webStore:
        | typeof webStores.customers
        | typeof webStores.paymentMethods
        | typeof webStores.serviceUsers
        | typeof webStores.taxRates,
): Promise<void> {
    if (!hasNativeDatabase) return replaceWebScopedRecords(webStore, scope, records);
    initializeDatabase();
    getDatabase().transaction((tx) => {
        tx.delete(table).where(eq(table.scope, scope)).run();
        for (const record of records)
            tx.insert(table)
                .values({
                    id: `${scope}:${webStore}:${record.id}`,
                    scope,
                    remoteId: record.id,
                    payload: JSON.stringify(record),
                })
                .run();
    });
}

export const billingReferenceRepository = {
    readCustomers: (scope: string) => readCollection<Customer>(scope, customers, webStores.customers),
    replaceCustomers: (scope: string, records: Customer[]) =>
        replaceCollection(scope, records, customers, webStores.customers),
    readPaymentMethods: (scope: string) =>
        readCollection<BillingPaymentMethod>(scope, paymentMethods, webStores.paymentMethods),
    replacePaymentMethods: (scope: string, records: BillingPaymentMethod[]) =>
        replaceCollection(scope, records, paymentMethods, webStores.paymentMethods),
    readServiceUsers: (scope: string) =>
        readCollection<ServiceUser>(scope, serviceUsers, webStores.serviceUsers),
    replaceServiceUsers: (scope: string, records: ServiceUser[]) =>
        replaceCollection(scope, records, serviceUsers, webStores.serviceUsers),
    readTaxRates: (scope: string) => readCollection<BillingTaxRate>(scope, taxRates, webStores.taxRates),
    replaceTaxRates: (scope: string, records: BillingTaxRate[]) =>
        replaceCollection(scope, records, taxRates, webStores.taxRates),
};
