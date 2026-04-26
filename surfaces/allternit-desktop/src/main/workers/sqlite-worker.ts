/**
 * SQLite Worker — off-main-thread database operations.
 * Uses Node.js built-in node:sqlite (Node 22+).
 * Falls back to a no-op shim if not available.
 */

import { workerData, parentPort } from 'node:worker_threads';
import { MessagePort } from 'node:worker_threads';

// node:sqlite is available in Node 22.5+. We use dynamic import + unknown typing
// to avoid a hard compile-time dependency on types that may not be present.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DatabaseClass: (new (path: string) => any) | null = null;
try {
  const sqlite = await import('node:sqlite' as string) as { DatabaseSync: new (path: string) => unknown };
  DatabaseClass = sqlite.DatabaseSync as new (path: string) => unknown as never;
} catch {
  // Will report errors on each call below
}

const port: MessagePort = workerData.port;
const dbPath: string = workerData.dbPath ?? ':memory:';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any | null = null;

function getDb() {
  if (!DatabaseClass) throw new Error('node:sqlite not available in this Node.js version (need 22.5+)');
  if (!db) db = new DatabaseClass(dbPath);
  return db;
}

port.on('message', (msg: { id?: string; type: string; payload?: unknown }) => {
  const { id, type, payload } = msg;
  try {
    let result: unknown;

    if (type === 'execQuery') {
      const { sql, params } = payload as { sql: string; params?: unknown[] };
      const stmt = getDb().prepare(sql);
      result = params ? stmt.all(...params) : stmt.all();
    } else if (type === 'execRaw') {
      const { sql } = payload as { sql: string };
      getDb().exec(sql);
      result = null;
    } else if (type === 'runMigration') {
      const { sql } = payload as { sql: string };
      getDb().exec(sql);
      result = { migrated: true };
    } else if (type === 'close') {
      db?.close();
      db = null;
      result = null;
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }

    if (id) port.postMessage({ id, payload: result });
  } catch (err) {
    if (id) port.postMessage({ id, error: (err as Error).message });
  }
});
