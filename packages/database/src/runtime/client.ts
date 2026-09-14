import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { Platform } from "react-native";
import * as schema from "./schema";
import type { DatabaseAppProfile } from "../types";

export const hasNativeDatabase = Platform.OS !== "web";

let appProfile: DatabaseAppProfile = "store";
const sqliteByProfile: Partial<
    Record<DatabaseAppProfile, SQLite.SQLiteDatabase>
> = {};
const databaseByProfile: Partial<
    Record<DatabaseAppProfile, ReturnType<typeof drizzle<typeof schema>>>
> = {};

export function databaseNameForProfile(profile: DatabaseAppProfile): string {
    return profile === "admin" ? "indyz-pos-admin.db" : "indyz-pos.db";
}

export function getConfiguredDatabaseProfile(): DatabaseAppProfile {
    return appProfile;
}

export function configureDatabaseProfile(profile: DatabaseAppProfile): void {
    appProfile = profile;
}

export function getSQLiteClient(): SQLite.SQLiteDatabase {
    if (!hasNativeDatabase)
        throw new Error("SQLite is only available in the native application.");
    return (sqliteByProfile[appProfile] ??= SQLite.openDatabaseSync(
        databaseNameForProfile(appProfile),
        {
            enableChangeListener: true,
        },
    ));
}

export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
    return (databaseByProfile[appProfile] ??= drizzle(getSQLiteClient(), {
        schema,
    }));
}
