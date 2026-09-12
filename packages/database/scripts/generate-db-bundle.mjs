import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(scriptDirectory, "../drizzle/0000_initial.sql");
const outputPath = resolve(
    scriptDirectory,
    "../src/runtime/initialSchema.generated.ts",
);
const sql = readFileSync(migrationPath, "utf8");
const source = `// Generated from drizzle/0000_initial.sql. Do not edit by hand.\nexport const initialSchemaSql = ${JSON.stringify(sql)};\n`;
writeFileSync(outputPath, source);
