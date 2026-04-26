import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema-sqlite";
import { mkdirSync } from "fs";
import { join } from "path";

// Ensure data directory exists
const dataDir = join(process.cwd(), "data");
try {
  mkdirSync(dataDir, { recursive: true });
} catch {
  // Directory may already exist
}

// Create a proxy db that only initializes better-sqlite3 when first called
export const db = new Proxy({} as any, {
  get(target, prop) {
    if (!target._initialized) {
      console.log("[DB] Initializing SQLite connection...");
      const Database = require("better-sqlite3");
      
      let dbPath: string;
      const envUrl = process.env.DATABASE_URL;
      
      if (envUrl && envUrl.startsWith('file:')) {
        dbPath = envUrl.slice(5);
      } else {
        dbPath = join(dataDir, "allternit.db");
      }
      
      console.log(`[DB] Using database path: ${dbPath}`);
      const sqlite = new Database(dbPath);
      target._db = drizzle(sqlite, { schema });
      target._initialized = true;
    }
    return target._db[prop];
  }
});
