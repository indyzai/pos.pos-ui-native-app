import { getActiveAuthSession } from "@indyzai/pos-auth/session";
import {
    getActiveDatabase,
    createScopeKey,
    type LocalRecord,
} from "@indyzai/pos-database";
import {
    resolveTableMutation,
    type TableOutboxPayload,
} from "@indyzai/pos-database/table-mutations";
import { hasEntitlement, type AppSurface } from "@indyzai/pos-permissions";
import type { FeatureRequest } from "@indyzai/pos-application";
import { featureToggleLabels } from "@indyzai/feature-flags";
import {
    settingsFields,
    validateSettingsPatch,
    type SettingsRecord,
    type SettingsValues,
} from "./settingsSchema";

export function createSettingsApi(
    request: FeatureRequest,
    surface: AppSurface,
) {
    const context = () => {
        const session = getActiveAuthSession(),
            database = getActiveDatabase();
        if (!session || !database)
            throw new Error("Local workspace is not ready.");
        return {
            session,
            database,
            id: `${createScopeKey(database.scope)}:app_settings:business`,
        };
    };
    const assertCurrent = (c: ReturnType<typeof context>) => {
        if (
            getActiveDatabase() !== c.database ||
            getActiveAuthSession()?.token !== c.session.token
        )
            throw new Error(
                "Workspace changed. Retry in the current business.",
            );
    };
    let pushing: Promise<void> | undefined;
    return {
        async refresh(signal?: AbortSignal) {
            const c = context();
            const repository =
                c.database.collection<LocalRecord<SettingsRecord>>(
                    "app_settings",
                );
            const before = await repository.get(c.id);
            const response = await request<{
                getAllSettings: {
                    values?: SettingsValues;
                    organization?: {
                        config?: {
                            businessType?: string;
                            features?: Record<string, boolean>;
                        };
                    };
                };
            }>(
                c.session.token,
                String(c.session.tenant.id),
                "query NativeSettings { getAllSettings { values organization } }",
                {},
                signal,
            );
            assertCurrent(c);
            if (signal?.aborted) return;
            if (!response.getAllSettings?.values)
                throw new Error("Settings response was incomplete.");
            const config = response.getAllSettings.organization?.config;
            const values: SettingsValues = {};
            // Never cache credentials, opaque integration secrets or unsupported server fields.
            const known = new Set(settingsFields.map((field) => field.key));
            for (const [key, value] of Object.entries(
                response.getAllSettings.values,
            ))
                if (
                    known.has(key) &&
                    ["string", "boolean", "number"].includes(typeof value)
                )
                    values[key] = value;
            if (config?.businessType) values.businessType = config.businessType;
            for (const [key, value] of Object.entries(config?.features ?? {}))
                if (known.has(key)) values[key] = value;
            await c.database.transaction(["app_settings"], async () => {
                assertCurrent(c);
                if (signal?.aborted) return;
                const current = await repository.get(c.id);
                if (
                    current?.updatedAt !== before?.updatedAt ||
                    (current &&
                        ["PENDING", "RUNNING", "FAILED", "CONFLICT"].includes(
                            current.syncStatus,
                        ))
                )
                    return;
                await repository.put({
                    id: c.id,
                    scope: createScopeKey(c.database.scope),
                    tenantId: c.database.scope.tenantId,
                    remoteId: c.id,
                    payload: { id: c.id, values },
                    syncStatus: "API",
                    serverVersion: 0,
                    updatedAt: Date.now(),
                });
            });
        },
        async pushPending(signal?: AbortSignal) {
            if (pushing) return pushing;
            pushing = (async () => {
                const c = context();
                const outbox =
                    c.database.collection<
                        LocalRecord<TableOutboxPayload<SettingsRecord>>
                    >("sync_outbox");
                for (const original of await outbox.list({
                    includeDeleted: true,
                })) {
                    if (
                        original.payload.entityType !== "SETTINGS" ||
                        !["PENDING", "RUNNING"].includes(original.syncStatus) ||
                        (original.payload.attempts ?? 0) >= 3
                    )
                        continue;
                    assertCurrent(c);
                    if (signal?.aborted) return;
                    const job = await outbox.get(original.id);
                    if (
                        !job ||
                        job.deletedAt ||
                        !["PENDING", "RUNNING"].includes(job.syncStatus)
                    )
                        continue;
                    const jobs = await outbox.list({ includeDeleted: true });
                    if (
                        job.payload.dependencyJobIds.some(
                            (id) =>
                                !jobs.some(
                                    (row) =>
                                        row.payload.offlineId === id &&
                                        row.syncStatus === "SYNCED",
                                ),
                        )
                    )
                        continue;
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
                                "Business settings require administrator access in the Admin app.",
                            );
                        await outbox.put({
                            ...job,
                            syncStatus: "RUNNING",
                            updatedAt: Date.now(),
                        });
                        const patch = validateSettingsPatch(
                            job.payload.data.patch ?? {},
                        );
                        const config: Record<string, unknown> = {};
                        for (const key of [
                            "businessType",
                            "currency",
                            "timezone",
                            "language",
                            "primaryColor",
                            "phone",
                            "address",
                            "city",
                            "state",
                        ])
                            if (key in patch) config[key] = patch[key];
                        if (typeof config.businessType === "string")
                            config.businessType =
                                config.businessType.toUpperCase();
                        if ("gstin" in patch) config.taxId = patch.gstin;
                        const features = Object.fromEntries(
                            Object.entries(patch).filter(
                                ([key, value]) =>
                                    key in featureToggleLabels &&
                                    typeof value === "boolean",
                            ),
                        );
                        if (Object.keys(features).length)
                            config.features = {
                                ...((c.session.organization?.settings
                                    .features as object) ?? {}),
                                ...features,
                            };
                        const organization = {
                            ...("businessName" in patch
                                ? { name: patch.businessName }
                                : {}),
                            ...(Object.keys(config).length ? { config } : {}),
                        };
                        const response = await request<{
                            updateAllSettings: boolean;
                        }>(
                            c.session.token,
                            String(c.session.tenant.id),
                            "mutation SaveNativeSettings($input: UpdateAllSettingsInput!) { updateAllSettings(input: $input) }",
                            {
                                input: {
                                    values: patch,
                                    ...(Object.keys(organization).length
                                        ? { organization }
                                        : {}),
                                },
                            },
                            signal,
                        );
                        assertCurrent(c);
                        if (!(await outbox.get(job.id))) continue;
                        if (!response.updateAllSettings)
                            throw new Error(
                                "Settings were not acknowledged by the server.",
                            );
                        await resolveTableMutation(
                            c.database,
                            { table: "app_settings" },
                            {
                                jobId: job.payload.offlineId,
                                serverId: job.payload.localId,
                            },
                        );
                    } catch (error) {
                        assertCurrent(c);
                        if (!(await outbox.get(job.id))) continue;
                        const attempts = (job.payload.attempts ?? 0) + 1;
                        await outbox.put({
                            ...job,
                            syncStatus: attempts >= 3 ? "FAILED" : "PENDING",
                            updatedAt: Date.now(),
                            payload: {
                                ...job.payload,
                                attempts,
                                errorMessage:
                                    error instanceof Error
                                        ? error.message
                                        : "Settings sync failed.",
                            },
                        });
                        if (attempts >= 3) {
                            const repository =
                                c.database.collection<
                                    LocalRecord<SettingsRecord>
                                >("app_settings");
                            const current = await repository.get(
                                job.payload.localId,
                            );
                            if (current)
                                await repository.put({
                                    ...current,
                                    syncStatus: "FAILED",
                                    updatedAt: Date.now(),
                                });
                        }
                        throw error;
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
