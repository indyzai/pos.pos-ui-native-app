import type { FeatureRequest } from "@indyzai/pos-application";
import type { AuthSession } from "@indyzai/pos-auth/session";
import type { LocalRecord, LocalDatabase } from "@indyzai/pos-database";
import {
    resolveTableMutation,
    type TableOutboxPayload,
} from "@indyzai/pos-database/table-mutations";
import { hasEntitlement, type AppSurface } from "@indyzai/pos-permissions";
import {
    validatePrinterConfig,
    type NativePrinterConfig,
} from "@indyzai/pos-printing";
import type { CounterPrinter } from "./types";

export const printerFields =
    "id name counterId branchId type printerTypes connectionType address port paperSize status isDefault isActive copies autoPrint config";
export function nativeConfig(printer: CounterPrinter): NativePrinterConfig {
    const config = printer.config?.native as NativePrinterConfig | undefined;
    if (!config)
        throw new Error(
            "Configure a native command profile before connecting this printer.",
        );
    validatePrinterConfig(config);
    return config;
}
export function validatePrinter(printer: CounterPrinter) {
    if (!printer.name.trim() || !printer.counterId)
        throw new Error("Enter a name and select a counter.");
    const config = nativeConfig(printer);
    if (printer.type === "thermal" && config.language !== "ESC_POS")
        throw new Error("Receipt printers require ESC/POS.");
    if (printer.type !== "thermal" && config.language === "ESC_POS")
        throw new Error("Label printers require TSPL or ZPL.");
    if (printer.connectionType === "usb") {
        for (const field of [
            "usbVendorId",
            "usbProductId",
            "usbInterfaceId",
            "usbEndpointAddress",
        ] as const)
            if (!Number.isInteger(config[field]) || Number(config[field]) < 0)
                throw new Error(
                    "Discover and select the connected USB printer.",
                );
    } else if (printer.connectionType === "bluetooth") {
        const address = printer.address ?? "";
        if (/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(address)) {
            if (
                !config.bluetoothServiceUuid?.trim() ||
                !config.bluetoothCharacteristicUuid?.trim()
            )
                throw new Error(
                    "Enter the BLE service and writable characteristic UUIDs.",
                );
        } else if (!/^([\dA-F]{2}:){5}[\dA-F]{2}$/i.test(address))
            throw new Error("Select a Bluetooth printer.");
    } else if (printer.connectionType === "network") {
        if (!printer.address?.trim() || /[\s/]/.test(printer.address))
            throw new Error(
                "Enter a printer hostname or IP address without a URL prefix.",
            );
        if (
            !/^\d+$/.test(printer.port ?? "") ||
            Number(printer.port) < 1 ||
            Number(printer.port) > 65535
        )
            throw new Error("Enter a TCP port between 1 and 65535.");
    } else throw new Error("Choose USB, Bluetooth or network.");
}

export function createPrinterConfigurationApi(
    request: FeatureRequest,
    surface: AppSurface,
    getContext: () => {
        session: AuthSession;
        database: LocalDatabase;
        scope: string;
    },
) {
    function context() {
        const { session, database, scope } = getContext();
        if (!session || !database)
            throw new Error("Local workspace is not ready.");
        return { session, database, scope };
    }
    function check(c: ReturnType<typeof context>) {
        if (
            getContext().database !== c.database ||
            getContext().session.token !== c.session.token
        )
            throw new Error("Workspace changed.");
    }
    async function fetch(
        c: ReturnType<typeof context>,
        counterId?: string,
        signal?: AbortSignal,
    ) {
        const data = await request<{ counterPrinters: CounterPrinter[] }>(
            c.session.token,
            String(c.session.tenant.id),
            `query NativePrinters($counterId: ID) { counterPrinters(counterId: $counterId) { ${printerFields} } }`,
            { counterId },
            signal,
        );
        check(c);
        if (!Array.isArray(data.counterPrinters))
            throw new Error("Printer response was incomplete.");
        return data.counterPrinters;
    }
    let pushing: Promise<void> | undefined;
    return {
        async load() {
            return (
                await context()
                    .database.collection<LocalRecord<CounterPrinter>>(
                        "printers",
                    )
                    .list()
            )
                .sort((a, b) => {
                    const pending = (row: LocalRecord<CounterPrinter>) =>
                        ["PENDING", "RUNNING"].includes(row.syncStatus) ? 1 : 0;
                    return pending(b) - pending(a) || b.updatedAt - a.updatedAt;
                })
                .map((row) => row.payload);
        },
        async refresh(counterId?: string, signal?: AbortSignal) {
            const c = context(),
                repo =
                    c.database.collection<LocalRecord<CounterPrinter>>(
                        "printers",
                    );
            const before = await repo.list();
            const printers = await fetch(c, counterId, signal);
            await c.database.transaction(["printers"], async () => {
                check(c);
                if (signal?.aborted) return;
                const current = await repo.list();
                for (const printer of printers) {
                    const row = current.find(
                        (item) =>
                            item.remoteId === printer.id ||
                            item.id === printer.config?.clientPrinterId,
                    );
                    if (
                        row &&
                        (["PENDING", "RUNNING", "FAILED", "CONFLICT"].includes(
                            row.syncStatus,
                        ) ||
                            before.find((item) => item.id === row.id)
                                ?.updatedAt !== row.updatedAt)
                    )
                        continue;
                    await repo.put({
                        id: row?.id ?? `${c.scope}:printer:${printer.id}`,
                        scope: c.scope,
                        tenantId: c.database.scope.tenantId,
                        storeId: printer.branchId,
                        remoteId: printer.id,
                        payload: printer,
                        syncStatus: "API",
                        serverVersion: 0,
                        updatedAt: Date.now(),
                    });
                }
                for (const row of current)
                    if (
                        (!counterId || row.payload.counterId === counterId) &&
                        ["API", "SYNCED"].includes(row.syncStatus) &&
                        before.find((item) => item.id === row.id)?.updatedAt ===
                            row.updatedAt &&
                        !printers.some((item) => item.id === row.remoteId)
                    )
                        await repo.remove(row.id);
            });
        },
        async pushPending(signal?: AbortSignal) {
            if (pushing) return pushing;
            pushing = (async () => {
                const c = context(),
                    outbox =
                        c.database.collection<
                            LocalRecord<TableOutboxPayload<CounterPrinter>>
                        >("sync_outbox");
                for (const candidate of await outbox.list()) {
                    const job = await outbox.get(candidate.id);
                    if (!job || job.deletedAt) continue;
                    if (
                        job.payload.entityType !== "PRINTER" ||
                        !["PENDING", "RUNNING"].includes(job.syncStatus)
                    )
                        continue;
                    check(c);
                    if (signal?.aborted) return;
                    const all = await outbox.list();
                    if (
                        job.payload.dependencyJobIds.some(
                            (id) =>
                                !all.some(
                                    (row) =>
                                        row.payload.offlineId === id &&
                                        row.syncStatus === "SYNCED",
                                ),
                        )
                    )
                        continue;
                    let attempted = job;
                    try {
                        if (
                            !hasEntitlement(
                                "organization.manage",
                                c.session.tenant.role,
                                c.session.user.role,
                                surface,
                            )
                        )
                            throw new Error(
                                "Save shared printer configuration in the Admin app with administrator access.",
                            );
                        const printer = job.payload.data;
                        validatePrinter(printer);
                        if (
                            !c.session.organization?.branches.some(
                                (branch) =>
                                    branch.id === printer.branchId &&
                                    branch.counters.some(
                                        (counter) =>
                                            counter.id === printer.counterId,
                                    ),
                            )
                        )
                            throw new Error(
                                "The selected counter is no longer available in this workspace. Refresh organization details before saving.",
                            );
                        let remoteId = (
                            await c.database
                                .collection("printers")
                                .get(job.payload.localId)
                        )?.remoteId;
                        // Legacy SQLite adapters use the local ID for a NOT NULL remote_id.
                        if (remoteId === job.payload.localId) remoteId = null;
                        // The deployed create API has no idempotency key. Recover acknowledged/lost
                        // creates by their durable marker, but never automatically create twice.
                        if (!remoteId)
                            remoteId = (
                                await fetch(c, printer.counterId, signal)
                            ).find(
                                (item) =>
                                    item.config?.clientPrinterId ===
                                    job.payload.localId,
                            )?.id;
                        if (
                            !remoteId &&
                            (job.payload.data.config?.nativeCreateAttempted ||
                                (job.payload.attempts ?? 0) > 0 ||
                                job.syncStatus === "RUNNING")
                        )
                            throw new Error(
                                "Previous create outcome is uncertain. Refresh this counter and verify the server before creating another printer.",
                            );
                        attempted = {
                            ...job,
                            syncStatus: "RUNNING",
                            updatedAt: Date.now(),
                            payload: {
                                ...job.payload,
                                attempts: (job.payload.attempts ?? 0) + 1,
                                data: {
                                    ...printer,
                                    config: {
                                        ...printer.config,
                                        ...(!remoteId
                                            ? { nativeCreateAttempted: true }
                                            : {}),
                                    },
                                },
                            },
                        };
                        await outbox.put(attempted);
                        const input = {
                            name: printer.name.trim(),
                            counterId: printer.counterId,
                            connectionType: printer.connectionType,
                            address: printer.address,
                            port: printer.port,
                            type: printer.type,
                            printerTypes: printer.printerTypes,
                            paperSize: printer.paperSize,
                            isDefault: printer.isDefault,
                            isActive: printer.isActive,
                            config: {
                                ...printer.config,
                                clientPrinterId: job.payload.localId,
                            },
                        };
                        if (!remoteId) {
                            const response = await request<{
                                createCounterPrinter: CounterPrinter;
                            }>(
                                c.session.token,
                                String(c.session.tenant.id),
                                `mutation CreateNativePrinter($input: CreateCounterPrinterInput!) { createCounterPrinter(input:$input) { ${printerFields} } }`,
                                { input },
                                signal,
                            );
                            check(c);
                            remoteId = response.createCounterPrinter?.id;
                            if (!remoteId)
                                throw new Error(
                                    "Server did not acknowledge printer creation.",
                                );
                            const repo =
                                    c.database.collection<
                                        LocalRecord<CounterPrinter>
                                    >("printers"),
                                row = await repo.get(job.payload.localId);
                            if (row)
                                await repo.put({
                                    ...row,
                                    remoteId,
                                    updatedAt: Date.now(),
                                });
                        }
                        const response = await request<{
                            updateCounterPrinter: CounterPrinter;
                        }>(
                            c.session.token,
                            String(c.session.tenant.id),
                            `mutation UpdateNativePrinter($id: ID!, $input: UpdateCounterPrinterInput!) { updateCounterPrinter(id:$id,input:$input) { ${printerFields} } }`,
                            {
                                id: remoteId,
                                input: {
                                    ...input,
                                    copies: nativeConfig(printer).copies,
                                    autoPrint: printer.autoPrint,
                                },
                            },
                            signal,
                        );
                        check(c);
                        if (!response.updateCounterPrinter?.id)
                            throw new Error(
                                "Server did not acknowledge printer settings.",
                            );
                        if (await outbox.get(job.id)) {
                            await resolveTableMutation(
                                c.database,
                                { table: "printers" },
                                {
                                    jobId: job.payload.offlineId,
                                    serverId: remoteId,
                                    payload: response.updateCounterPrinter,
                                },
                            );
                            if (printer.isDefault) {
                                const repo =
                                    c.database.collection<
                                        LocalRecord<CounterPrinter>
                                    >("printers");
                                for (const row of await repo.list())
                                    if (
                                        row.id !== job.payload.localId &&
                                        row.payload.counterId ===
                                            printer.counterId &&
                                        row.payload.isDefault &&
                                        ["API", "SYNCED"].includes(
                                            row.syncStatus,
                                        )
                                    )
                                        await repo.put({
                                            ...row,
                                            payload: {
                                                ...row.payload,
                                                isDefault: false,
                                            },
                                            updatedAt: Date.now(),
                                        });
                            }
                        }
                    } catch (error) {
                        check(c);
                        if (await outbox.get(job.id)) {
                            await outbox.put({
                                ...attempted,
                                syncStatus: "FAILED",
                                updatedAt: Date.now(),
                                payload: {
                                    ...attempted.payload,
                                    errorMessage:
                                        error instanceof Error
                                            ? error.message
                                            : "Printer save failed.",
                                },
                            });
                            const repo =
                                    c.database.collection<
                                        LocalRecord<CounterPrinter>
                                    >("printers"),
                                row = await repo.get(job.payload.localId);
                            if (row)
                                await repo.put({
                                    ...row,
                                    syncStatus: "FAILED",
                                    updatedAt: Date.now(),
                                });
                        }
                    }
                }
            })();
            try {
                await pushing;
            } finally {
                pushing = undefined;
            }
        },
    };
}
