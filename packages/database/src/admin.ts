import { Platform } from "react-native";
import type { DatabaseScope, LocalDatabase } from "./types";

export async function createAdminLocalDatabase(
    scope: DatabaseScope,
): Promise<LocalDatabase> {
    const runtime =
        Platform.OS === "web"
            ? await import("./runtime/localDatabase.web")
            : await import("./runtime/localDatabase");
    return runtime.createLocalDatabase({ ...scope, appProfile: "admin" });
}
