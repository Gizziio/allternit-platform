import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema-sqlite.ts",
  out: "./src/lib/db/migrations-sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/a2rchitech.db",
  },
});
