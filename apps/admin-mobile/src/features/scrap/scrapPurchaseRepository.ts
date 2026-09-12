import { eq } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '@indyzai/pos-database/client';
import { initializeDatabase } from '@indyzai/pos-database/migrations';
import { scrapPurchaseJobs } from '@indyzai/pos-database/schema';
import { readWebScopedRecords, replaceWebScopedRecords, webStores } from '@indyzai/pos-database/web-client';
import type { ScrapPurchaseJob } from './types';

const storageId = (scope: string, id: string) => `${scope}:scrap-purchase-job:${id}`;

export const scrapPurchaseRepository = {
    async read(scope: string): Promise<ScrapPurchaseJob[]> {
        if (!hasNativeDatabase) {
            const rows = await readWebScopedRecords<ScrapPurchaseJob & { storageId: string; scope: string }>(
                webStores.scrapPurchaseJobs,
                scope,
            );
            return rows.map(({ storageId: _storageId, scope: _scope, ...job }) => job);
        }
        initializeDatabase();
        return getDatabase()
            .select()
            .from(scrapPurchaseJobs)
            .where(eq(scrapPurchaseJobs.scope, scope))
            .all()
            .flatMap((row) => {
                try {
                    return [
                        {
                            id: row.remoteId,
                            payload: JSON.parse(row.payload) as Record<string, unknown>,
                            status: row.status as ScrapPurchaseJob['status'],
                            error: row.errorMessage || undefined,
                            createdAt: row.createdAt,
                        },
                    ];
                } catch {
                    return [];
                }
            });
    },
    async replace(scope: string, jobs: ScrapPurchaseJob[]): Promise<void> {
        if (!hasNativeDatabase) return replaceWebScopedRecords(webStores.scrapPurchaseJobs, scope, jobs);
        initializeDatabase();
        getDatabase().transaction((tx) => {
            tx.delete(scrapPurchaseJobs).where(eq(scrapPurchaseJobs.scope, scope)).run();
            for (const job of jobs) {
                tx.insert(scrapPurchaseJobs)
                    .values({
                        id: storageId(scope, job.id),
                        scope,
                        remoteId: job.id,
                        payload: JSON.stringify(job.payload),
                        status: job.status,
                        errorMessage: job.error || null,
                        createdAt: job.createdAt,
                    })
                    .run();
            }
        });
    },
};
