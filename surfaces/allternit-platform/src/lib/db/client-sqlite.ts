import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
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

const sqlite = new Database(join(dataDir, "allternit.db"));
export const db = drizzle(sqlite, { schema });
