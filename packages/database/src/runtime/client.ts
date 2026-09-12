import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { Platform } from "react-native";
import * as schema from "./schema";
import type { DatabaseAppProfile } from "../types";

export const hasNativeDatabase = Platform.OS !== "web";

let sqlite: SQLite.SQLiteDatabase | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
let appProfile: DatabaseAppProfile = "store";

export function configureDatabaseProfile(profile: DatabaseAppProfile): void {
    if (sqlite && profile !== appProfile) {
        throw new Error(
            "The local database profile cannot change while it is open.",
        );
    }
    appProfile = profile;
}

export function getSQLiteClient(): SQLite.SQLiteDatabase {
    if (!hasNativeDatabase)
        throw new Error("SQLite is only available in the native application.");
    const databaseName =
        appProfile === "admin" ? "indyz-pos-admin.db" : "indyz-pos.db";
    return (sqlite ??= SQLite.openDatabaseSync(databaseName, {
        enableChangeListener: true,
    }));
}

export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
    return (database ??= drizzle(getSQLiteClient(), { schema }));
}
