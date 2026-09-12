import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "sqlite",
    schema: "./src/runtime/schema/index.ts",
    out: "./drizzle",
});
