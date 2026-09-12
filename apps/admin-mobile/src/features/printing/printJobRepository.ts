import { and, eq, ne } from 'drizzle-orm';
import { getDatabase, hasNativeDatabase } from '../../db/client';
import { initializeDatabase } from '../../db/migrations';
import { printJobs } from '../../db/schema';
import { readWebPrintJobs, writeWebPrintJob } from '../../db/webClient';
import type { LocalPrintJob } from './types';

const storageId = (scope: string, id: string) => `${scope}:print-job:${id}`;

export async function listPendingPrintJobs(scope: string): Promise<LocalPrintJob[]> {
    if (!hasNativeDatabase) {
        const rows = await readWebPrintJobs<LocalPrintJob & { scope: string; storageId: string }>(scope);
        return rows
            .filter((row) => row.status !== 'COMPLETED')
            .map(({ scope: _scope, storageId: _id, ...job }) => job);
    }
    initializeDatabase();
    return getDatabase()
        .select()
        .from(printJobs)
        .where(and(eq(printJobs.scope, scope), ne(printJobs.status, 'COMPLETED')))
        .all()
        .flatMap((row) => {
            try {
                return [JSON.parse(row.payload) as LocalPrintJob];
            } catch {
                return [];
            }
        });
}

export async function savePrintJob(scope: string, job: LocalPrintJob): Promise<void> {
    if (!hasNativeDatabase) return writeWebPrintJob(scope, job);
    initializeDatabase();
    getDatabase()
        .insert(printJobs)
        .values({
            id: storageId(scope, job.id),
            scope,
            payload: JSON.stringify(job),
            status: job.status,
            createdAt: job.createdAt,
        })
        .onConflictDoUpdate({
            target: printJobs.id,
            set: { payload: JSON.stringify(job), status: job.status },
        })
        .run();
}
