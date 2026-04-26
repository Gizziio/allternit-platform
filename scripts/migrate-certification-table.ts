/**
 * One-off migration to add the Certification table to the SQLite database.
 */

import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";

const dataDir = join(process.cwd(), "data");
try {
  mkdirSync(dataDir, { recursive: true });
} catch {
  // ignore
}

const dbPath = join(dataDir, "allternit.db");
const sqlite = new Database(dbPath);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS "Certification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "courseCode" TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  "tier" TEXT NOT NULL,
  "completedAt" INTEGER NOT NULL DEFAULT (unixepoch()),
  "capstoneUrl" TEXT,
  "score" INTEGER,
  "verified" INTEGER NOT NULL DEFAULT 0
);
`);

// Add unique constraint if not exists
const indexes = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Certification'`).all() as { name: string }[];
if (!indexes.some((i) => i.name.includes('Certification_userId_courseCode'))) {
  sqlite.exec(`CREATE UNIQUE INDEX "Certification_userId_courseCode_unique" ON "Certification"("userId", "courseCode");`);
}

console.log(`✅ Certification table ready in ${dbPath}`);
sqlite.close();
