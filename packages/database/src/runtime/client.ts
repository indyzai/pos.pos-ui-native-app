import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { Platform } from "react-native";
import * as schema from "./schema";

export const hasNativeDatabase = Platform.OS !== "web";

let sqlite: SQLite.SQLiteDatabase | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getSQLiteClient(): SQLite.SQLiteDatabase {
    if (!hasNativeDatabase)
        throw new Error("SQLite is only available in the native application.");
    return (sqlite ??= SQLite.openDatabaseSync("indyz-pos.db", {
        enableChangeListener: true,
    }));
}

export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
    return (database ??= drizzle(getSQLiteClient(), { schema }));
}
