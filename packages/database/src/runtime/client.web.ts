/**
 * Web persistence is implemented by webClient.ts using IndexedDB.
 *
 * Keep this platform module free of expo-sqlite imports: Metro resolves it for
 * web builds, preventing the native WASM worker from entering the web bundle.
 */
export const hasNativeDatabase = false;
let configuredProfile: "store" | "admin" = "store";
export function configureDatabaseProfile(profile: "store" | "admin"): void {
    configuredProfile = profile;
}
export function getConfiguredDatabaseProfile(): "store" | "admin" {
    return configuredProfile;
}

export function getSQLiteClient(): never {
    throw new Error("SQLite is only available in the native application.");
}

export function getDatabase(): never {
    throw new Error(
        "Drizzle SQLite is only available in the native application.",
    );
}
