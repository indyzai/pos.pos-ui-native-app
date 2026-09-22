import {
    assertFeatureContext,
    type FeatureContext,
    type FeatureRequest,
} from "@indyzai/pos-application";
import type { LocalDatabase, LocalRecord } from "@indyzai/pos-database";
import {
    createTableMutation,
    resolveTableMutation,
    type TableOutboxPayload,
} from "@indyzai/pos-database/table-mutations";
import { SerialQueue } from "@indyzai/pos-sync";
import type { Customer } from "@indyzai/feature-billing/types/billing";

export type LocalCustomer = Customer & {
    pendingSync?: boolean;
    syncError?: string;
};
type Context = FeatureContext & { database: LocalDatabase };
type Options = {
    getContext: (database?: LocalDatabase | null) => Context;
    request: FeatureRequest;
    createId: () => string;
    mapCustomer: (value: Record<string, unknown>) => Customer;
};
const query = `query PosCustomers($type: PartyType, $skip: Int!, $take: Int!) {
    parties(type: $type, skip: $skip, take: $take) {
        id name type contactNumber phone email addressLine gstin creditLimit balance
    }
}`;
const mutation = `mutation CreatePosCustomer($input: NewPartyInput!) {
    saveParty(input: $input) { id name phone email addressLine gstin creditLimit balance }
}`;

/** Local writes never wait for the API. The shared outbox processor calls pushPending. */
export function createCustomersApi(options: Options) {
    const queue = new SerialQueue();
    const assertCurrent = (context: Context) => {
        const current = options.getContext();
        assertFeatureContext(context, current);
        if (context.database !== current.database)
            throw new Error("Your workspace changed. Please retry.");
    };
    return {
        create(input: Omit<Customer, "id" | "type">) {
            return queue.run(async () => {
                const context = options.getContext();
                const name = input.name.trim();
                if (!name) throw new Error("Enter a customer name.");
                const customer: LocalCustomer = {
                    ...input,
                    name,
                    id: `offline-${options.createId()}`,
                    type: "CUSTOMER",
                    pendingSync: true,
                };
                await createTableMutation(
                    context.database,
                    { table: "customers", entityType: "CUSTOMER" },
                    {
                        payload: customer,
                        localId: customer.id,
                        operation: "CREATE",
                    },
                );
                return customer;
            });
        },
        pushPending(signal?: AbortSignal, database?: LocalDatabase | null) {
            return queue.run(async () => {
                const context = options.getContext(database);
                assertCurrent(context);
                const repository =
                    context.database.collection<LocalRecord<LocalCustomer>>(
                        "customers",
                    );
                const outbox =
                    context.database.collection<
                        LocalRecord<TableOutboxPayload<LocalCustomer>>
                    >("sync_outbox");
                // Upgrade pending records from before customer creation used sync_outbox.
                const existing = await outbox.list({ includeDeleted: true });
                for (const record of await repository.list({
                    syncStatus: "PENDING",
                })) {
                    if (
                        existing.some(
                            (job) =>
                                job.payload.table === "customers" &&
                                job.payload.localId === record.id,
                        )
                    )
                        continue;
                    await createTableMutation(
                        context.database,
                        { table: "customers", entityType: "CUSTOMER" },
                        {
                            payload: record.payload,
                            localId: record.id,
                            operation: "CREATE",
                        },
                    );
                }
                for (const job of await outbox.list({ includeDeleted: true })) {
                    if (
                        job.payload.entityType !== "CUSTOMER" ||
                        !["PENDING", "RUNNING"].includes(job.syncStatus)
                    )
                        continue;
                    signal?.throwIfAborted();
                    assertCurrent(context);
                    if (job.payload.operation !== "CREATE")
                        throw new Error(
                            "Customer update synchronization is not configured.",
                        );
                    await outbox.put({
                        ...job,
                        syncStatus: "RUNNING",
                        updatedAt: Date.now(),
                    });
                    try {
                        const customer = job.payload.data;
                        const data = await options.request<{
                            saveParty: Record<string, unknown>;
                        }>(
                            context.token,
                            context.tenant,
                            mutation,
                            {
                                input: {
                                    clientMutationId:
                                        job.payload.idempotencyKey,
                                    name: customer.name,
                                    type: "CUSTOMER",
                                    phone: customer.phone,
                                    email: customer.email,
                                    addressLine: customer.address,
                                    gstin: customer.gstin,
                                    creditLimit: customer.creditLimit,
                                },
                            },
                            signal,
                        );
                        assertCurrent(context);
                        if (!data.saveParty?.id)
                            throw new Error(
                                "Server did not acknowledge the customer.",
                            );
                        const saved = options.mapCustomer(data.saveParty);
                        await resolveTableMutation(
                            context.database,
                            { table: "customers" },
                            {
                                jobId: job.payload.offlineId,
                                serverId: String(saved.id),
                                payload: { ...saved, pendingSync: false },
                            },
                        );
                    } catch (error) {
                        assertCurrent(context);
                        await outbox.put({
                            ...job,
                            syncStatus: "PENDING",
                            updatedAt: Date.now(),
                        });
                        throw error;
                    }
                }
            });
        },
        sync(signal?: AbortSignal, database?: LocalDatabase | null) {
            return queue.run(async () => {
                const context = options.getContext(database);
                assertCurrent(context);
                const remote: Customer[] = [];
                for (let skip = 0; ; skip += 200) {
                    signal?.throwIfAborted();
                    const data = await options.request<{
                        parties: Record<string, unknown>[];
                    }>(
                        context.token,
                        context.tenant,
                        query,
                        { type: "CUSTOMER", skip, take: 200 },
                        signal,
                    );
                    assertCurrent(context);
                    if (!Array.isArray(data.parties))
                        throw new Error(
                            "The customers response is incomplete.",
                        );
                    remote.push(...data.parties.map(options.mapCustomer));
                    if (data.parties.length < 200) break;
                }
                signal?.throwIfAborted();
                const repository =
                    context.database.collection<LocalRecord<LocalCustomer>>(
                        "customers",
                    );
                await context.database.transaction(["customers"], async () => {
                    assertCurrent(context);
                    const current = await repository.list({
                        includeDeleted: true,
                    });
                    const pending = current.filter(
                        (row) => row.syncStatus !== "SYNCED",
                    );
                    const pendingIds = new Set(
                        pending.flatMap((row) => [
                            row.remoteId,
                            row.payload.id,
                        ]),
                    );
                    const records: LocalRecord<LocalCustomer>[] = remote
                        .filter((row) => !pendingIds.has(row.id))
                        .map((customer) => ({
                            id:
                                current.find(
                                    (row) => row.remoteId === customer.id,
                                )?.id ??
                                `${context.scope}:customers:${customer.id}`,
                            scope: context.scope,
                            tenantId: context.database.scope.tenantId,
                            storeId: context.database.scope.storeIds[0] ?? null,
                            remoteId: customer.id,
                            payload: customer,
                            serverVersion: 0,
                            syncStatus: "SYNCED",
                            updatedAt: Date.now(),
                            deletedAt: null,
                        }));
                    await repository.replace([...records, ...pending]);
                });
            });
        },
    };
}
