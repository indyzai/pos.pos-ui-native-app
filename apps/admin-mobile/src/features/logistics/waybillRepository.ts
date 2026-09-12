import { and, eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '../../db/client';
import { initializeDatabase } from '../../db/migrations';
import { waybillJobs } from '../../db/schema';
import { readWebScopedRecords, replaceWebScopedRecords, webStores } from '../../db/webClient';
import type { WaybillJob } from './types';

const storageId = (scope: string, id: string) => `${scope}:waybill-job:${id}`;

export const waybillRepository = {
    async read(scope: string): Promise<WaybillJob[]> {
        if (!hasNativeDatabase) {
            const rows = await readWebScopedRecords<WaybillJob & { storageId: string; scope: string }>(
                webStores.waybillJobs,
                scope,
            );
            return rows.map(({ storageId: _id, scope: _scope, ...job }) => job);
        }
        initializeDatabase();
        return getDatabase()
            .select()
            .from(waybillJobs)
            .where(and(eq(waybillJobs.scope, scope)))
            .all()
            .flatMap((row) => {
                try {
                    return [
                        {
                            id: row.saleOfflineId,
                            saleOfflineId: row.saleOfflineId,
                            payload: JSON.parse(row.payload) as Record<string, unknown>,
                            status: row.status as WaybillJob['status'],
                            error: row.errorMessage || undefined,
                            createdAt: row.createdAt,
                        },
                    ];
                } catch {
                    return [];
                }
            });
    },
    async replace(scope: string, jobs: WaybillJob[]): Promise<void> {
        if (!hasNativeDatabase) return replaceWebScopedRecords(webStores.waybillJobs, scope, jobs);
        initializeDatabase();
        getDatabase().transaction((tx) => {
            tx.delete(waybillJobs).where(eq(waybillJobs.scope, scope)).run();
            for (const job of jobs)
                tx.insert(waybillJobs)
                    .values({
                        id: storageId(scope, job.id),
                        scope,
                        saleOfflineId: job.saleOfflineId,
                        payload: JSON.stringify(job.payload),
                        status: job.status,
                        errorMessage: job.error || null,
                        createdAt: job.createdAt,
                    })
                    .run();
        });
    },
};
