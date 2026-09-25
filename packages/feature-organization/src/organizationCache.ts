import { eq } from "drizzle-orm";
import {
    configureDatabaseProfile,
    getDatabase,
    hasNativeDatabase,
} from "@indyzai/pos-database/client";
import { initializeDatabase } from "@indyzai/pos-database/migrations";
import { organizations } from "@indyzai/pos-database/schema";
import { kvStore } from "@indyzai/pos-storage-native";
import type { AuthOrganizationDetails } from "@indyzai/pos-auth/session";

/** Bootstrap metadata is readable before the scoped database provider mounts. */
export function createOrganizationCache(profile: "store" | "admin") {
    const key = (userId: string, tenantId: string) =>
        `organization-cache.${profile}.${encodeURIComponent(userId)}.${encodeURIComponent(tenantId)}`;
    const prepare = () => {
        configureDatabaseProfile(profile);
        initializeDatabase();
    };
    return {
        async read(
            userId: string,
            tenantId: string,
        ): Promise<AuthOrganizationDetails | null> {
            const id = key(userId, tenantId);
            let value: string | null | undefined;
            if (hasNativeDatabase) {
                prepare();
                value = getDatabase()
                    .select()
                    .from(organizations)
                    .where(eq(organizations.id, id))
                    .get()?.payload;
            } else value = await kvStore.get(id);
            if (!value) return null;
            try {
                const data = JSON.parse(value) as AuthOrganizationDetails;
                return String(data.id) === tenantId &&
                    Array.isArray(data.branches) &&
                    data.settings
                    ? data
                    : null;
            } catch {
                return null;
            }
        },
        async write(
            userId: string,
            tenantId: string,
            value: AuthOrganizationDetails,
        ): Promise<void> {
            if (String(value.id) !== tenantId)
                throw new Error("Organization cache scope mismatch.");
            const id = key(userId, tenantId);
            if (!hasNativeDatabase) {
                await kvStore.set(id, JSON.stringify(value));
                return;
            }
            prepare();
            const record = {
                id,
                scope: id,
                tenantId,
                remoteId: tenantId,
                payload: JSON.stringify(value),
                serverVersion: 0,
                syncStatus: "API",
                updatedAt: Date.now(),
            };
            getDatabase()
                .insert(organizations)
                .values(record)
                .onConflictDoUpdate({ target: organizations.id, set: record })
                .run();
        },
    };
}
