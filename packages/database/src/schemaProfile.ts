import { getAppCollections } from "./roleManifest";
import type { CollectionName, DatabaseAppProfile } from "./types";

const systemTables = new Set([
    "schema_metadata",
    "billing_metadata",
    "sync_jobs",
]);

/** Selects CREATE TABLE/INDEX statements belonging to one application profile. */
export function schemaSqlForProfile(
    sql: string,
    profile: DatabaseAppProfile,
): string {
    const tables = getAppCollections(profile);
    return sql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean)
        .filter((statement) => {
            const match = statement.match(
                /(?:CREATE TABLE| ON)\s+[`"]?([a-z0-9_]+)[`"]?/i,
            );
            if (!match) return true;
            const table = match[1];
            return (
                systemTables.has(table) || tables.has(table as CollectionName)
            );
        })
        .join(";\n");
}
